import { renderHook, waitFor, act } from '@testing-library/react';
import { useRiskCalculation } from './useRiskCalculation';
import { vi, describe, test, expect } from 'vitest';

// 1. LIGHTWEIGHT MOCK (Prevents loading heavy mathjs)
vi.mock('../../../utils/uncertaintyMath', () => ({
  unitSystem: {
    units: {
      "V": { to_si: 1, quantity: "Voltage" },
      "mV": { to_si: 0.001, quantity: "Voltage" }
    }
  },
  calculateUncertaintyFromToleranceObject: () => ({
    breakdown: [{ absoluteHigh: 10.01, absoluteLow: 9.99, name: "Test Component" }]
  }),
  calcTAR: () => 4,
  calcTUR: () => 4,
  PFAMgr: () => [0.015, 0, 0, 0, 0, 0], // 1.5% PFA
  PFRMgr: () => [0.001, 0, 0],
  gbLowMgr: () => [9.995, 1],
  gbUpMgr: () => [10.005, 1],
  GBMultMgr: () => 0.8,
  PFAwGBMgr: () => [0.001, 0, 0, 0, 0, 0],
  PFRwGBMgr: () => [0, 0, 0],
  CalIntwGBMgr: () => [12, 0.99, 0.99],
  CalIntMgr: () => [12, 0.99, 0.99],
  CalRelMgr: () => [0.99, 0.99],
  resDwn: (v) => v,
  resUp: (v) => v
}));

describe('useRiskCalculation Hook', () => {
  // 2. STABLE DATA CONSTANTS (Prevents unnecessary re-renders)
  const mockSessionData = {
    uncReq: {
      reqPFA: "2",
      reliability: "95",
      neededTUR: "4",
      calInt: "12",
      measRelCalcAssumed: "95",
      guardBandMultiplier: "100"
    },
    uutDescription: "Test UUT"
  };

  const mockTestPointData = {
    uutTolerance: { measuringResolution: "0.001" }
  };

  const mockUutTolerance = { reading: { high: "0.01" } };
  const mockTmdeTolerances = [];
  const mockUutNominal = { value: "10", unit: "V" };
  const mockCalcResults = {
    combined_uncertainty_absolute_base: 0.0025,
    expanded_uncertainty_absolute_base: 0.005,
  };

  test('automatically calculates Limits and TUR on mount', async () => {
    // 3. STABLE CALLBACK (CRITICAL FIX)
    // Defining this outside renderHook prevents the infinite loop
    const onDataSaveSpy = vi.fn(); 

    const { result } = renderHook(() => 
      useRiskCalculation(
        mockSessionData,
        mockTestPointData,
        mockUutTolerance,
        mockTmdeTolerances,
        mockUutNominal,
        mockCalcResults,
        "risk", 
        onDataSaveSpy // <-- Passed as stable reference
      )
    );

    // Verify Auto-Calculation of Limits (10 ± 0.01)
    expect(result.current.riskInputs.LUp).toBe(10.01);
    expect(result.current.riskInputs.LLow).toBe(9.99);

    // Verify Risk Results were generated
    await waitFor(() => {
        expect(result.current.riskResults).not.toBeNull();
    });
    
    // Check values from our mock
    if(result.current.riskResults) {
        expect(result.current.riskResults.pfa).toBe(1.5);
        expect(result.current.riskResults.tur).toBe(4);
    }
  });

  test('updates inputs manually', async () => {
    const onDataSaveSpy = vi.fn();

    const { result } = renderHook(() => 
      useRiskCalculation(
        mockSessionData,
        mockTestPointData,
        mockUutTolerance,
        mockTmdeTolerances,
        mockUutNominal,
        mockCalcResults,
        "risk",
        onDataSaveSpy
      )
    );

    act(() => {
      result.current.setRiskInputs(prev => ({ ...prev, LUp: "12" }));
    });

    expect(result.current.riskInputs.LUp).toBe("12");
  });
});