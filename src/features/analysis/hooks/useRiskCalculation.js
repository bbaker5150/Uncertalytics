/**
 * src/hooks/useRiskCalculation.js
 * * This hook manages the Risk Analysis state and logic.
 * It automatically calculates risk metrics (TAR, TUR, PFA, PFR) based on
 * the calculated uncertainty results and the session's risk requirements.
 * * Returns:
 * - riskResults: The calculated metrics object.
 * - riskInputs: State for manual overrides of limits (LLow, LUp).
 * - calculateRiskMetrics: Function to force recalculation.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { 
  unitSystem, 
  calculateUncertaintyFromToleranceObject, 
  calcTAR, 
  calcTUR, 
  PFAMgr, 
  PFRMgr, 
  resDwn, 
  resUp, 
  gbLowMgr, 
  gbUpMgr, 
  GBMultMgr, 
  PFAwGBMgr, 
  PFRwGBMgr, 
  CalIntwGBMgr, 
  CalIntMgr, 
  CalRelMgr 
} from "../../../utils/uncertaintyMath";

export const useRiskCalculation = (
  sessionData,
  testPointData,
  uutToleranceData,
  tmdeTolerancesData,
  uutNominal,
  calcResults, // Must come from useUncertaintyCalculation hook
  analysisMode,
  onDataSave
) => {
  const [riskInputs, setRiskInputs] = useState({
    LLow: "",
    LUp: "",
  });
  const [riskResults, setRiskResults] = useState(null);
  const [notification, setNotification] = useState(null); 
  
  // Ref to store the last calculated metrics to prevent infinite loops
  const prevRiskMetricsRef = useRef(null);

  // --- 1. Auto-Populate Limits from UUT Tolerance ---
  useEffect(() => {
    if (!uutToleranceData || !uutNominal || !uutNominal.value) {
      setRiskInputs((prev) => ({ ...prev, LLow: "", LUp: "" }));
      return;
    }

    const { breakdown } = calculateUncertaintyFromToleranceObject(
      uutToleranceData,
      uutNominal
    );

    const nominalValue = parseFloat(uutNominal.value);

    const specComponents = breakdown.filter(
      (comp) =>
        comp.absoluteHigh !== undefined && comp.absoluteLow !== undefined
    );

    if (specComponents.length === 0) {
      setRiskInputs((prev) => ({ ...prev, LLow: "", LUp: "" }));
      return;
    }

    const totalHighDeviation = specComponents.reduce((sum, comp) => {
      return sum + (comp.absoluteHigh - nominalValue);
    }, 0);

    const totalLowDeviation = specComponents.reduce((sum, comp) => {
      return sum + (comp.absoluteLow - nominalValue);
    }, 0);

    const finalHighLimit = nominalValue + totalHighDeviation;
    const finalLowLimit = nominalValue + totalLowDeviation;

    setRiskInputs((prev) => ({
      ...prev,
      LLow: finalLowLimit,
      LUp: finalHighLimit,
    }));
  }, [uutToleranceData, uutNominal]);

  // --- 2. The Heavy Calculation Logic ---
  const calculateRiskMetrics = useCallback(() => {
    const LLow = parseFloat(riskInputs.LLow);
    const LUp = parseFloat(riskInputs.LUp);

    const pfaRequired = parseFloat(sessionData.uncReq.reqPFA) / 100;
    const reliability = parseFloat(sessionData.uncReq.reliability) / 100;
    const calInt = parseFloat(sessionData.uncReq.calInt);
    const measRelCalc = parseFloat(sessionData.uncReq.measRelCalcAssumed) / 100;
    const turNeeded = parseFloat(sessionData.uncReq.neededTUR);
    const uutName = sessionData.uutDescription || "UUT";

    if (isNaN(LLow) || isNaN(LUp) || LUp === LLow) {
      return;
    }
    if (isNaN(reliability) || reliability <= 0 || reliability >= 1) {
      return;
    }
    if (!calcResults) {
      return;
    }

    const nominalUnit = uutNominal?.unit;
    const targetUnitInfo = unitSystem.units[nominalUnit];
    const uCal_Base = calcResults.combined_uncertainty_absolute_base;
    const uCal_Native = uCal_Base / targetUnitInfo.to_si;
    const U_Base = calcResults.expanded_uncertainty_absolute_base;
    const U_Native = U_Base / targetUnitInfo.to_si;

    if (!targetUnitInfo || isNaN(targetUnitInfo.to_si)) {
      setNotification({
        title: "Calculation Error",
        message: `Invalid UUT unit (${nominalUnit}) for risk analysis.`,
      });
      return;
    }

    // ... [Logic: UUT Breakdown for TAR] ...
    const uutBreakdownResult = calculateUncertaintyFromToleranceObject(
      uutToleranceData,
      uutNominal
    );
    const uutSpecComponents = uutBreakdownResult.breakdown.filter(
      (comp) =>
        comp.absoluteHigh !== undefined && comp.absoluteLow !== undefined
    );

    const uutBreakdownForTar = uutSpecComponents.map((comp) => {
      const nominalValue = parseFloat(uutNominal.value);
      const highDeviation = comp.absoluteHigh - nominalValue;
      const lowDeviation = comp.absoluteLow - nominalValue;
      const span = highDeviation - lowDeviation;
      return {
        name: `${uutName} - ${comp.name}`,
        span: span,
      };
    });

    // ... [Logic: TMDE Breakdown for TAR] ...
    const tmdeBreakdownForTar = [];
    let missingTmdeRef = false;
    let tmdeToleranceHigh_Native = 0;
    let tmdeToleranceLow_Native = 0;

    if (tmdeTolerancesData.length > 0) {
      const tmdeTotals = tmdeTolerancesData.reduce(
        (acc, tmde) => {
          if (!tmde.measurementPoint || !tmde.measurementPoint.value) {
            missingTmdeRef = true;
            return acc;
          }

          const { breakdown: tmdeBreakdown } =
            calculateUncertaintyFromToleranceObject(
              tmde,
              tmde.measurementPoint
            );
          const tmdeNominal = parseFloat(tmde.measurementPoint.value);

          const tmdeSpecComponents = tmdeBreakdown.filter(
            (comp) =>
              comp.absoluteHigh !== undefined && comp.absoluteLow !== undefined
          );
          if (tmdeSpecComponents.length === 0) return acc;

          let totalTmdeHighDevInUutNative = 0;
          let totalTmdeLowDevInUutNative = 0;

          const tmdeUnitInfo = unitSystem.units[tmde.measurementPoint.unit];
          if (!tmdeUnitInfo || isNaN(tmdeUnitInfo.to_si)) {
            missingTmdeRef = true;
            return acc;
          }

          tmdeSpecComponents.forEach((comp) => {
            const highDev = comp.absoluteHigh - tmdeNominal;
            const lowDev = comp.absoluteLow - tmdeNominal;
            const compSpan = highDev - lowDev;

            const compSpanInBase = compSpan * tmdeUnitInfo.to_si;
            const compSpanInUutNative = compSpanInBase / targetUnitInfo.to_si;

            if (compSpanInUutNative > 0) {
              tmdeBreakdownForTar.push({
                name: `${tmde.name || "TMDE"} - ${comp.name}`,
                span: compSpanInUutNative,
              });
            }

            const highDevInBase = highDev * tmdeUnitInfo.to_si;
            const highDevInUutNative = highDevInBase / targetUnitInfo.to_si;

            const lowDevInBase = lowDev * tmdeUnitInfo.to_si;
            const lowDevInUutNative = lowDevInBase / targetUnitInfo.to_si;

            totalTmdeHighDevInUutNative += highDevInUutNative;
            totalTmdeLowDevInUutNative += lowDevInUutNative;
          });

          const quantity = parseInt(tmde.quantity, 10) || 1;
          acc.totalHigh += totalTmdeHighDevInUutNative * quantity;
          acc.totalLow += totalTmdeLowDevInUutNative * quantity;

          return acc;
        },
        { totalHigh: 0, totalLow: 0 }
      );

      tmdeToleranceHigh_Native = tmdeTotals.totalHigh;
      tmdeToleranceLow_Native = tmdeTotals.totalLow;
    }

    const tmdeToleranceSpan_Native =
      tmdeToleranceHigh_Native - tmdeToleranceLow_Native;

    if (missingTmdeRef) {
      setNotification({
        title: "Missing Info",
        message: "TMDE missing Reference Point for TAR calculation.",
      });
    }

    // ... [Math Calculations] ...
    let tarResult = calcTAR(
      uutNominal.value,
      0,
      LLow,
      LUp,
      parseFloat(uutNominal.value) + tmdeToleranceLow_Native,
      parseFloat(uutNominal.value) + tmdeToleranceHigh_Native
    );
    let turResult = calcTUR(uutNominal.value, 0, LLow, LUp, U_Native);
    let [pfaResult, pfa_term1, pfa_term2, uUUT, uDev, cor] = PFAMgr(
      uutNominal.value,
      0,
      LLow,
      LUp,
      uCal_Native,
      reliability,
      turResult,
      turNeeded
    );
    let [pfrResult, pfr_term1, pfr_term2] = PFRMgr(
      uutNominal.value,
      0,
      LLow,
      LUp,
      uCal_Native,
      reliability,
      turResult,
      turNeeded
    );

    const resRaw = parseFloat(testPointData.uutTolerance.measuringResolution);
    const safeRes = isNaN(resRaw) ? 0 : resRaw;

    let gbLow = resDwn(
      gbLowMgr(
        pfaRequired,
        uutNominal.value,
        0,
        LLow,
        LUp,
        uCal_Native,
        reliability
      ),
      safeRes
    );
    let gbHigh = resUp(
      gbUpMgr(
        pfaRequired,
        uutNominal.value,
        0,
        LLow,
        LUp,
        uCal_Native,
        reliability
      ),
      safeRes
    );
    let gbMult = GBMultMgr(
      pfaRequired,
      uutNominal.value,
      0,
      LLow,
      LUp,
      gbLow,
      gbHigh
    );
    let [gbPFA, gbPFAT1, gbPFAT2] = PFAwGBMgr(
      uutNominal.value,
      0,
      LLow,
      LUp,
      uCal_Native,
      reliability,
      gbLow,
      gbHigh
    );
    let [gbPFR, gbPFRT1, gbPFRT2] = PFRwGBMgr(
      uutNominal.value,
      0,
      LLow,
      LUp,
      uCal_Native,
      reliability,
      gbLow,
      gbHigh
    );
    let gbCalInt = CalIntwGBMgr(
      uutNominal.value,
      0,
      LLow,
      LUp,
      uCal_Native,
      reliability,
      measRelCalc,
      gbLow,
      gbHigh,
      turResult,
      turNeeded,
      calInt
    );
    let nogbCalInt = CalIntMgr(
      uutNominal.value,
      0,
      LLow,
      LUp,
      uCal_Native,
      reliability,
      measRelCalc,
      turResult,
      turNeeded,
      calInt,
      pfaRequired
    );
    let nogbMeasRel = CalRelMgr(
      uutNominal.value,
      0,
      LLow,
      LUp,
      uCal_Native,
      reliability,
      measRelCalc,
      turResult,
      turNeeded,
      calInt,
      pfaRequired
    );

    let gbInputs = {
      nominal: parseFloat(uutNominal.value),
      uutLower: LLow,
      uutUpper: LUp,
      tmdeLower: parseFloat(uutNominal.value) + tmdeToleranceLow_Native,
      tmdeUpper: parseFloat(uutNominal.value) + tmdeToleranceHigh_Native,
      combUnc: calcResults.combined_uncertainty_absolute_base,
      turVal: turResult,
      measRelTarget: reliability,
      calibrationInt: calInt,
      measrelCalcAssumed: measRelCalc,
      reqTUR: turNeeded,
      reqPFA: pfaRequired,
      nominalUnit: nominalUnit,
    };

    let gbResults = {
      GBLOW: gbLow,
      GBUP: gbHigh,
      GBMULT: gbMult * 100,
      GBPFA: gbPFA * 100,
      GBPFAT1: gbPFAT1 * 100,
      GBPFAT2: gbPFAT2 * 100,
      GBPFR: gbPFR * 100,
      GBPFRT1: gbPFRT1 * 100,
      GBPFRT2: gbPFRT2 * 100,
      GBCALINT: gbCalInt,
      NOGBCALINT: nogbCalInt,
      NOGBMEASREL: nogbMeasRel * 100,
    };

    const newRiskMetrics = {
      LLow: LLow,
      LUp: LUp,
      tur: turResult,
      tar: tarResult,
      pfa: pfaResult * 100,
      pfr: pfrResult * 100,
      pfa_term1: (isNaN(pfa_term1) ? 0 : pfa_term1) * 100,
      pfa_term2: (isNaN(pfa_term2) ? 0 : pfa_term2) * 100,
      pfr_term1: (isNaN(pfr_term1) ? 0 : pfr_term1) * 100,
      pfr_term2: (isNaN(pfr_term2) ? 0 : pfr_term2) * 100,
      uCal: uCal_Native,
      uUUT: uUUT,
      uDev: uDev,
      correlation: cor,
      ALow: LLow,
      AUp: LUp,
      expandedUncertainty: U_Native,
      tmdeToleranceSpan: tmdeToleranceSpan_Native,
      tmdeToleranceHigh: tmdeToleranceHigh_Native,
      tmdeToleranceLow: tmdeToleranceLow_Native,
      uutBreakdownForTar: uutBreakdownForTar,
      tmdeBreakdownForTar: tmdeBreakdownForTar,
      nativeUnit: nominalUnit,
      gbInputs: gbInputs,
      gbResults: gbResults,
      uutResolution: testPointData.uutTolerance.measuringResolution.length
    };

    // --- INFINITE LOOP FIX ---
    // Compare new results with previous results. Only update state/parent if different.
    const prevJSON = JSON.stringify(prevRiskMetricsRef.current);
    const newJSON = JSON.stringify(newRiskMetrics);

    if (prevJSON !== newJSON) {
        prevRiskMetricsRef.current = newRiskMetrics;
        setRiskResults(newRiskMetrics);
        onDataSave({ riskMetrics: newRiskMetrics });
    }
    
  }, [
    riskInputs.LLow,
    riskInputs.LUp,
    sessionData.uncReq.reqPFA,
    sessionData.uncReq.reliability,
    sessionData.uncReq.calInt,
    sessionData.uncReq.measRelCalcAssumed,
    sessionData.uncReq.neededTUR,
    sessionData.uutDescription,
    uutNominal,
    calcResults,
    uutToleranceData,
    tmdeTolerancesData,
    testPointData.uutTolerance.measuringResolution,
    onDataSave,
  ]);

  // --- 3. Trigger Calculation ---
  useEffect(() => {
    const shouldCalculate =
      analysisMode === "risk" ||
      analysisMode === "uncertaintyTool" ||
      analysisMode === "riskmitigation";

    if (shouldCalculate && calcResults) {
      calculateRiskMetrics();
    }

    if (!shouldCalculate) {
      setRiskResults((prevResults) => {
        if (prevResults !== null) {
          onDataSave({ riskMetrics: null });
          return null;
        }
        return prevResults;
      });
    }
  }, [
    analysisMode,
    calcResults,
    sessionData.uncReq.reliability,
    sessionData.uncReq.guardBandMultiplier,
    sessionData.uncReq.reqPFA,
    sessionData.uncReq.neededTUR,
    sessionData.uncReq.calInt,
    sessionData.uncReq.measRelCalcAssumed,
    riskInputs.LLow,
    riskInputs.LUp,
    calculateRiskMetrics,
    onDataSave,
  ]);

  return { 
    riskResults, 
    setRiskResults, 
    riskInputs, 
    setRiskInputs, 
    calculateRiskMetrics,
    notification 
  };
};