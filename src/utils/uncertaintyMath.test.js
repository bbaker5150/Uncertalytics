import { describe, it, expect, vi, afterEach } from 'vitest';
import * as um from './uncertaintyMath';

describe('uncertaintyMath.js', () => {

  // Clean up mocks (like console.error spies) after every test
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // 1. Unit Systems & Helpers
  // ==========================================
  describe('Unit System & Helpers', () => {
    it('identifies quantities correctly', () => {
      expect(um.unitSystem.getQuantity('V')).toBe('Voltage');
      expect(um.unitSystem.getQuantity('A')).toBe('Current');
      expect(um.unitSystem.getQuantity('Hz')).toBe('Frequency');
      expect(um.unitSystem.getQuantity('unknown')).toBeNull();
    });

    it('converts to base units correctly', () => {
      // 1 kV = 1000 V
      expect(um.unitSystem.toBaseUnit(1, 'kV')).toBe(1000);
      // 1 mV = 0.001 V
      expect(um.unitSystem.toBaseUnit(1, 'mV')).toBe(0.001);
      // Non-existent unit returns value as-is
      expect(um.unitSystem.toBaseUnit(5, 'flurbo')).toBe(5);
    });

    it('converts from base units correctly', () => {
      // 1000 V -> 1 kV
      expect(um.unitSystem.fromBaseUnit(1000, 'kV')).toBe(1);
      // 0.001 V -> 1 mV
      expect(um.unitSystem.fromBaseUnit(0.001, 'mV')).toBe(1);
    });

    it('getRelevantUnits returns compatible units', () => {
      const voltUnits = um.unitSystem.getRelevantUnits('V');
      expect(voltUnits).toContain('mV');
      expect(voltUnits).toContain('kV');
      expect(voltUnits).not.toContain('A');
    });
  });

  // ==========================================
  // 2. Core Conversions (PPM / Unit)
  // ==========================================
  describe('Conversions (PPM <-> Units)', () => {
    describe('convertToPPM', () => {
      it('calculates ppm for standard units', () => {
        // 1 mV error on 1 V nominal = 1000 ppm
        const result = um.convertToPPM(1, 'mV', 1, 'V');
        expect(result).toBeCloseTo(1000);
      });

      it('calculates ppm for %', () => {
        // 1% of value is always 10,000 ppm
        const result = um.convertToPPM(1, '%', 100, 'V');
        expect(result).toBeCloseTo(10000);
      });

      it('handles same-unit conversions', () => {
        // 0.001 V error on 1 V nominal = 1000 ppm
        const result = um.convertToPPM(0.001, 'V', 1, 'V');
        expect(result).toBeCloseTo(1000);
      });

      it('returns NaN for mismatched quantities', () => {
        // Cannot convert Volts to Amps
        const result = um.convertToPPM(1, 'V', 1, 'A', null, false);
        expect(result).toBeNaN();
      });

      it('returns explanation object when requested', () => {
        const result = um.convertToPPM(1, 'mV', 1, 'V', null, true);
        expect(result).toHaveProperty('value');
        expect(result).toHaveProperty('explanation');
        expect(result.value).toBeCloseTo(1000);
      });
    });

    describe('convertPpmToUnit', () => {
      it('converts ppm back to absolute units', () => {
        // 1000 ppm of 1 V should be 1 mV (0.001 V)
        // convertPpmToUnit returns value in *targetUnit*
        const resInVolts = um.convertPpmToUnit(1000, 'V', { value: 1, unit: 'V' });
        expect(resInVolts).toBeCloseTo(0.001);

        const resInMv = um.convertPpmToUnit(1000, 'mV', { value: 1, unit: 'V' });
        expect(resInMv).toBeCloseTo(1);
      });

      it('converts ppm to %', () => {
        const res = um.convertPpmToUnit(10000, '%', { value: 100, unit: 'V' });
        expect(res).toBeCloseTo(1);
      });
    });
  });

  // ==========================================
  // 3. Statistical Distributions
  // ==========================================
  describe('Distributions', () => {
    it('getKValueFromTDistribution returns correct k', () => {
      expect(um.getKValueFromTDistribution(Infinity)).toBe(1.96);
      expect(um.getKValueFromTDistribution(1000)).toBe(1.96);
      expect(um.getKValueFromTDistribution(60)).toBe(2.0);
      // Interpolation check (approximate)
      const val = um.getKValueFromTDistribution(12.5); // Between 10 (2.23) and 15 (2.13)
      expect(val).toBeLessThan(2.23);
      expect(val).toBeGreaterThan(2.13);
    });

    it('InvNormalDistribution calculates standard normal quantiles', () => {
      // 97.5% roughly corresponds to 1.96 sigma (one-sided for 95% CI)
      expect(um.InvNormalDistribution(0.975)).toBeCloseTo(1.95996, 4);
      expect(um.InvNormalDistribution(0.5)).toBeCloseTo(0, 5);
    });

    it('CumNorm calculates CDF', () => {
      expect(um.CumNorm(0)).toBeCloseTo(0.5, 4);
      expect(um.CumNorm(1.96)).toBeCloseTo(0.975, 3);
    });
  });

  // ==========================================
  // 4. Uncertainty Calculator (The Core Logic)
  // ==========================================
  describe('calculateUncertaintyFromToleranceObject', () => {
    const refPoint = { value: '10', unit: 'V' };

    it('calculates standard uncertainty for a simple Reading spec', () => {
      const tolObj = {
        reading: { high: '1', unit: '%', distribution: '1.732' }
      };

      const res = um.calculateUncertaintyFromToleranceObject(tolObj, refPoint);
      
      expect(res.breakdown.length).toBe(1);
      const item = res.breakdown[0];
      expect(item.name).toBe('Reading');
      // 1% of 10V = 0.1 V -> 10,000 ppm
      expect(item.ppm).toBeCloseTo(10000); 
      // u_i (standard uncertainty in ppm) = 10000 / 1.732 = 5773.67
      expect(item.u_i).toBeCloseTo(5773.67, 1);
    });

    it('combines Reading and Range (RSS)', () => {
      const tolObj = {
        reading: { high: '1', unit: '%', distribution: '1.732' },
        floor: { high: '0.1', unit: 'V', distribution: '2.0' }
      };

      const res = um.calculateUncertaintyFromToleranceObject(tolObj, refPoint);

      const readingUnc = 10000 / 1.732; // ~5773
      const floorUnc = 10000 / 2.0;     // 5000
      const expectedTotal = Math.sqrt(readingUnc**2 + floorUnc**2);

      expect(res.standardUncertainty).toBeCloseTo(expectedTotal, 0);
    });

    it('handles Asymmetric tolerances conservatively', () => {
      const tolObj = {
        floor: { high: '0.2', low: '-0.1', unit: 'V', distribution: '2.0' }
      };

      const res = um.calculateUncertaintyFromToleranceObject(tolObj, refPoint);
      expect(res.breakdown[0].ppm).toBeCloseTo(15000);
    });
  });

  describe('getToleranceErrorSummary', () => {
    it('formats a symmetric tolerance summary', () => {
      const tolObj = {
        id: 'some-id', // REQUIRED: Code checks keys > 1 to avoid empty objects
        reading: { high: '1', unit: '%', distribution: '2' }
      };
      // 1% of 10V = 0.1V
      const summary = um.getToleranceErrorSummary(tolObj, { value: '10', unit: 'V' });
      expect(summary).toContain('±0.100 V');
    });
  });

  // ==========================================
  // 5. Risk Management Managers (TUR, PFA)
  // ==========================================
  describe('Risk Management', () => {
    
    describe('calcTUR', () => {
      it('calculates TUR for standard symmetric limits', () => {
        const tur = um.calcTUR('10', '10', '9', '11', '0.25'); 
        // (11 - 9) / (2 * 0.25) = 2 / 0.5 = 4
        expect(tur).toBeCloseTo(4);
      });

      it('returns empty string for invalid inputs', () => {
        expect(um.calcTUR('10', '10', '9', '11', 'foo')).toBe("");
      });
    });

    describe('PFAMgr (Probability of False Accept)', () => {
      it('calculates PFA for a centered result', () => {
        const res = um.PFAMgr(
          '10', '10', // Nom, Avg
          '9', '11',  // Low, High
          '0.1',      // Meas Unc
          '0.96',     // Meas Rel (Changed from 0 to 0.96 to prevent div/0)
          '10',       // TUR (high)
          '4'         // Req TUR
        );
        
        expect(res).toBeInstanceOf(Array);
        // High TUR means low PFA
        expect(Number(res[0])).toBeLessThan(0.01); 
      });

      it('calculates high PFA for bad process', () => {
        // Uncertainty is equal to Tolerance (TUR = 1:1)
        const res = um.PFAMgr(
          '10', '10', 
          '9', '11', 
          '1.0', 
          '0.96',  // Changed from 0 to 0.96
          '1', 
          '4'
        );
        
        // With TUR 1:1, PFA should be significant.
        expect(Number(res[0])).toBeGreaterThan(0.0);
      });
    });
  });

  // ==========================================
  // 6. Instrument Matching Logic
  // ==========================================
  describe('findInstrumentTolerance', () => {
    const mockInstrument = {
      functions: [
        {
          unit: 'V',
          ranges: [
            { min: 0, max: 10, tolerances: { reading: { high: '1' } }, resolution: '0.001' },
            { min: 10, max: 100, tolerances: { reading: { high: '2' } }, resolution: '0.01' }
          ]
        }
      ]
    };

    it('matches the correct range', () => {
      const res = um.findInstrumentTolerance(mockInstrument, '5', 'V');
      expect(res).not.toBeNull();
      expect(res.rangeMax).toBe(10);
      expect(res.tolerance.reading.high).toBe('1');
    });

    it('matches correct range with unit conversion', () => {
      const res = um.findInstrumentTolerance(mockInstrument, '5000', 'mV');
      expect(res).not.toBeNull();
      expect(res.rangeMax).toBe(10);
      expect(res.rangeUnit).toBe('V');
    });

    it('returns null if out of all ranges', () => {
      const res = um.findInstrumentTolerance(mockInstrument, '500', 'V');
      expect(res).toBeNull();
    });
  });

  // ==========================================
  // 7. Derived Uncertainty (Equation Parsing)
  // ==========================================
  describe('calculateDerivedUncertainty', () => {
    it('calculates Ohm\'s Law (V = I * R) correctly', () => {
      const equation = 'V = I * R';
      const variableMappings = { I: 'current', R: 'resistance' };
      const tmdeTolerances = [
        { 
          variableType: 'current', 
          measurementPoint: { value: '2', unit: 'A' },
          quantity: 1,
          reading: { high: '1', unit: '%' } // 1% of 2A = 0.02A
        },
        { 
          variableType: 'resistance', 
          measurementPoint: { value: '10', unit: 'Ohm' },
          quantity: 1,
          reading: { high: '1', unit: '%' } // 1% of 10Ohm = 0.1Ohm
        }
      ];

      const result = um.calculateDerivedUncertainty(equation, variableMappings, tmdeTolerances);

      expect(result.error).toBeNull();
      // Nominal: 2 * 10 = 20
      expect(result.nominalResult).toBe(20);
      // Sensitivity check: dV/dI = R = 10; dV/dR = I = 2
      const breakdownI = result.breakdown.find(b => b.variable === 'I');
      expect(breakdownI.ci).toBe(10); 
      expect(breakdownI.nominal).toBe(2);
    });

    it('returns an error for invalid syntax', () => {
      // Silence console.error for this expected failure
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = um.calculateDerivedUncertainty('V = I *', { I: 'x' }, []);
      
      expect(result.error).toBeDefined();
      expect(consoleSpy).toHaveBeenCalled(); 
    });

    it('handles missing variable mappings gracefully', () => {
       // Silence console.error for this expected failure
       const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

       const result = um.calculateDerivedUncertainty('y = m * x + b', { m: 'slope' }, []); 
       
       expect(result.error).toContain('Missing TMDE assignments');
       expect(consoleSpy).toHaveBeenCalled();
    });
  });

  // ==========================================
  // 8. Statistical Core Functions (Normal & Bivariate)
  // ==========================================
  describe('Statistical Core Functions', () => {
    describe('InvNormalDistribution (Probit)', () => {
      it('returns correct z-scores for standard probabilities', () => {
        expect(um.InvNormalDistribution(0.5)).toBeCloseTo(0, 5);
        expect(um.InvNormalDistribution(0.84134)).toBeCloseTo(1.0, 3); // 1 Sigma
        expect(um.InvNormalDistribution(0.97725)).toBeCloseTo(2.0, 3); // 2 Sigma
        expect(um.InvNormalDistribution(0.99865)).toBeCloseTo(3.0, 3); // 3 Sigma
      });

      it('handles edge cases (0 and 1)', () => {
        expect(um.InvNormalDistribution(0)).toBeLessThan(-100); // -Infinity approx
        expect(um.InvNormalDistribution(1)).toBeGreaterThan(100); // Infinity approx
      });
    });

    describe('bivariateNormalCDF', () => {
      it('calculates volume under 2D gaussian', () => {
        // No correlation, independent events
        const res = um.bivariateNormalCDF(0, 0, 0); 
        // P(x<0) * P(y<0) = 0.5 * 0.5 = 0.25
        expect(res).toBeCloseTo(0.25, 3);
      });

      it('handles high correlation (r > 0.7)', () => {
        const val = um.bivariateNormalCDF(0, 0, 0.9);
        // Positive correlation increases overlap volume in the quadrant
        expect(val).toBeGreaterThan(0.25); 
      });

      it('handles negative correlation (r < -0.7)', () => {
        const val = um.bivariateNormalCDF(0, 0, -0.9);
        expect(val).toBeLessThan(0.25);
      });
    });
  });

  // ==========================================
  // 9. Risk Management Managers (Guard Banding)
  // ==========================================
  describe('Risk Management Managers', () => {
    it('gbLowMgr calculates guard band for low limit', () => {
      // Nominal 10, TolLow 9, TolHigh 11. (Span +/- 1)
      // MeasUnc 0.3, MeasRel 0.90 => Valid UUT, Valid PFA > 0
      // Strict Req (0.0001) => Force Guard Band
      const res = um.gbLowMgr(
        '0.0001', // Max PFA 0.01%
        '10', '10', '9', '11', '0.3', '0.90'
      );
      // Result should be [NewLimit, Multiplier]
      expect(Array.isArray(res)).toBe(true);
      // Expect multiplier to reduce range (be < 1)
      expect(res[1]).toBeLessThan(1);
      // Expect new low limit to be higher than 9 (tighter)
      expect(res[0]).toBeGreaterThan(9); 
    });

    it('gbUpMgr calculates guard band for upper limit', () => {
      // Nominal 10, TolLow 9, TolHigh 11. (Span +/- 1)
      const res = um.gbUpMgr(
        '0.0001', // Max PFA 0.01%
        '10', '10', '9', '11', '0.3', '0.90'
      );
      expect(Array.isArray(res)).toBe(true);
      // Expect new upper limit to be lower than 11 (tighter)
      expect(res[0]).toBeLessThan(11);
    });

    it('GBMultMgr calculates simple multiplier percentage', () => {
        // 10V +/- 1V (9 to 11)
        // Guard banded to +/- 0.9V (9.1 to 10.9)
        // Multiplier = 0.9 / 1.0 = 0.9
        const res = um.GBMultMgr('0', '10', '10', '9', '11', '9.1', '10.9');
        expect(res).toBeCloseTo(0.9);
    });
  });

  // ==========================================
  // 10. Advanced Risk Managers (CalInt, CalRel)
  // ==========================================
  describe('Advanced Risk Managers', () => {
    // Scenario: Nominal 10, Tol +/- 1 (9-11). Meas Unc 0.25 (TUR 4:1). 
    // High reliability required.
    const args = [
        '10', '10',     // Nom, Avg
        '9', '11',      // Low, High
        '0.25',         // Meas Unc
        '0.95',         // Req Rel (95%)
        '0.98',         // Meas Rel (Observed Reliability - high)
        '4', '4',       // TUR, ReqTUR
        '12',           // Interval (months)
        '0.02'          // Max PFA (2%)
    ];

    it('CalIntMgr calculates adjusted interval', () => {
        // High observed reliability (0.98) vs required (0.95) should extend interval > 12
        const res = um.CalIntMgr(...args);
        expect(Array.isArray(res)).toBe(true);
        expect(res[0]).toBeGreaterThan(12); // New interval
    });

    it('CalRelMgr calculates reliability target', () => {
        const res = um.CalRelMgr(...args);
        expect(Array.isArray(res)).toBe(true);
        expect(res[0]).toBeGreaterThan(0.9); // Pred Rel
    });

    it('calcTAR calculates Test Accuracy Ratio', () => {
        // Tol +/- 1. STD +/- 0.25. TAR = 1 / 0.25 = 4
        const tar = um.calcTAR('10', '10', '9', '11', '9.75', '10.25');
        expect(tar).toBeCloseTo(4);
    });

    it('PFAwGBMgr handles Guard Banded PFA', () => {
        // Check PFA with a guard band applied
        const res = um.PFAwGBMgr(
            '10', '10', 
            '9', '11', 
            '0.25', '0.98', 
            '9.1', '10.9' // Guard banded limits
        );
        expect(Array.isArray(res)).toBe(true);
        // PFA should be very small
        expect(res[0]).toBeLessThan(0.01);
    });
  });

});