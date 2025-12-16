import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useUncertaintyCalculation } from './useUncertaintyCalculation';

// Mock the math utility to isolate hook logic
vi.mock('../../../utils/uncertaintyMath', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    calculateDerivedUncertainty: vi.fn(() => ({
      combinedUncertaintyNative: 0.5,
      breakdown: [{ variable: 'x', contribution_native: 0.5, ui_absolute_base: 0.5, unit: 'V' }],
      nominalResult: 100,
      error: null
    }))
  };
});

describe('useUncertaintyCalculation Hook', () => {
  const mockOnSave = vi.fn();
  
  // Default valid inputs to ensure useEffect runs successfully
  const defaultSession = { uncReq: { uncertaintyConfidence: 95 } };
  const defaultUutNominal = { value: '10', unit: 'V', name: 'Test Parameter' };
  const defaultUutTolerance = {};
  const defaultTmdes = [];
  const defaultManual = [];

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not calculate if measurement type is derived but inputs are missing', () => {
    const testPoint = {
      measurementType: 'derived',
      equationString: 'y=x',
      variableMappings: { x: 'Volts' },
      is_detailed_uncertainty_calculated: true
    };
    
    // Pass empty TMDEs to trigger the "no calculation" return path
    const { result } = renderHook(() => useUncertaintyCalculation(
        testPoint, defaultSession, [], defaultUutTolerance, defaultUutNominal, defaultManual, mockOnSave
    ));
    
    expect(result.current.calcResults).toBeNull();
  });

  it('performs calculation when type is derived and inputs are valid', async () => {
    const testPoint = {
      measurementType: 'derived',
      equationString: 'y = x * 2',
      variableMappings: { x: 'Volts' },
      is_detailed_uncertainty_calculated: false // Should trigger save
    };
    const tmdes = [{ variableType: 'Volts', measurementPoint: { value: '50', unit: 'V' }, quantity: 1 }];

    const { result } = renderHook(() => useUncertaintyCalculation(
        testPoint, defaultSession, tmdes, defaultUutTolerance, defaultUutNominal, defaultManual, mockOnSave
    ));

    await waitFor(() => {
        expect(result.current.calcResults).not.toBeNull();
    });

    expect(result.current.calcResults.calculatedNominalValue).toBe(100);
    // Check if onDataSave was called with new results
    expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({
        combined_uncertainty: expect.any(Number)
    }));
  });

  it('performs standard (RSS) calculation for direct measurements', async () => {
    const testPoint = {
      measurementType: 'direct',
      is_detailed_uncertainty_calculated: false
    };
    
    // Setup a TMDE with a known tolerance to produce a result
    const tmdes = [{ 
        name: 'Fluke Multimeter',
        quantity: 1,
        measurementPoint: { value: '10', unit: 'V' },
        reading: { high: '1', unit: '%' } // 1% of 10V = 0.1V
    }];

    const { result } = renderHook(() => useUncertaintyCalculation(
        testPoint, defaultSession, tmdes, defaultUutTolerance, defaultUutNominal, defaultManual, mockOnSave
    ));

    await waitFor(() => {
        expect(result.current.calcResults).not.toBeNull();
    });

    const results = result.current.calcResults;
    expect(results.combined_uncertainty).toBeGreaterThan(0);
    expect(results.effective_dof).toBe(Infinity); // Default for simple cases
  });

  it('handles calculation errors gracefully', async () => {
    // Force mock to throw error
    const um = await import('../../../utils/uncertaintyMath');
    um.calculateDerivedUncertainty.mockImplementationOnce(() => ({
        error: "Syntax Error"
    }));

    const testPoint = {
      measurementType: 'derived',
      equationString: 'Bad Eq',
      variableMappings: { x: 'V' }
    };
    const tmdes = [{ variableType: 'V', measurementPoint: { value: '1', unit: 'V' } }];

    const { result } = renderHook(() => useUncertaintyCalculation(
        testPoint, defaultSession, tmdes, defaultUutTolerance, defaultUutNominal, defaultManual, mockOnSave
    ));

    await waitFor(() => {
        expect(result.current.calculationError).toBe("Syntax Error");
    });
  });
});