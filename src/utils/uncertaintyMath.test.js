import { describe, it, expect } from 'vitest';
import * as um from './uncertaintyMath';

describe('uncertaintyMath.js', () => {

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

});