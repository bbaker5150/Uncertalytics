import React, { useState, useMemo, useEffect, useCallback } from "react";
// ... [Existing imports remain the same] ...
import { probit } from "simple-statistics";
import * as math from "mathjs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalculator,
  faPlus,
  faPencilAlt,
  faTrashAlt,
  faSave,
  faFolderOpen,
  faCheck,
} from "@fortawesome/free-solid-svg-icons";
import UncertaintyBudgetTable from "./UncertaintyBudgetTable";
import RiskAnalysisDashboard from "./RiskAnalysisDashboard";
import RiskMitigationDashboard from "./RiskMitigationDashboard";
import NotificationModal from "./NotificationModal";
import ConversionInfo from "./ConversionInfo";
import AddTmdeModal from "./AddTmdeModal";
import PercentageBarGraph from "./ContributionPlot";
import RiskScatterplot from "./RiskScatterplot";
import DerivedBreakdownModal from "./DerivedBreakdownModal";
import RiskBreakdownModal from "./BreakdownModals/RiskBreakdownModals";
import {
  unitSystem,
  convertToPPM,
  convertPpmToUnit,
  errorDistributions,
  getToleranceSummary,
  getToleranceErrorSummary,
  getAbsoluteLimits,
  calculateUncertaintyFromToleranceObject,
  getKValueFromTDistribution,
  calculateDerivedUncertainty,
  resDwn,
  resUp,
  calcTAR,
  calcTUR,
  PFAMgr,
  PFRMgr,
  gbLowMgr,
  gbUpMgr,
  GBMultMgr,
  PFAwGBMgr,
  PFRwGBMgr,
  CalIntwGBMgr,
  CalIntMgr,
  CalRelMgr,
} from "../utils/uncertaintyMath";
import RepeatabilityModal from "./RepeatabilityModal";

const oldErrorDistributions = [
  { value: "1.732", label: "Rectangular" },
  { value: "3.464", label: "Rectangular (Resolution)" },
  { value: "2.449", label: "Triangular" },
  { value: "1.414", label: "U Shaped" },
  { value: "1.645", label: "Normal (90%, k=1.645)" },
  { value: "1.960", label: "Normal (95%, k=1.960)" },
  { value: "2.000", label: "Normal (95.45%, k=2)" },
  { value: "2.576", label: "Normal (99%, k=2.576)" },
  { value: "3.000", label: "Normal (99.73%, k=3)" },
  { value: "4.179", label: "Rayleigh" },
  { value: "1.000", label: "Standard Uncertainty (Input is uᵢ)" },
];

// ... [getBudgetComponentsFromTolerance function] ...
const getBudgetComponentsFromTolerance = (
  toleranceObject,
  referenceMeasurementPoint
) => {
  // ... [Logic remains identical to previous fix] ...
  if (
    !toleranceObject ||
    !referenceMeasurementPoint ||
    !referenceMeasurementPoint.value ||
    !referenceMeasurementPoint.unit
  ) {
    return [];
  }

  const budgetComponents = [];
  const nominalValue = parseFloat(referenceMeasurementPoint.value);
  const nominalUnit = referenceMeasurementPoint.unit;
  const prefix =
    toleranceObject.name ||
    (toleranceObject.measuringResolution ? "UUT" : "TMDE");

  const processComponent = (
    tolComp,
    name,
    baseValueForRelative,
    isResolution = false
  ) => {
    if (!tolComp && !isResolution) return;

    let halfSpanPPM, u_i_native, unit_native;
    const distributionDivisor = isResolution
      ? 1.732
      : parseFloat(tolComp.distribution) || 1.732;
    const distributionLabel = isResolution
      ? "Rectangular"
      : errorDistributions.find((d) => d.value === String(tolComp.distribution))
        ?.label || "Rectangular";

    if (isResolution) {
      const value = parseFloat(tolComp);
      if (isNaN(value) || value === 0) return;
      const unit = toleranceObject.measuringResolutionUnit || nominalUnit;
      halfSpanPPM = convertToPPM(value / 2, unit, nominalValue, nominalUnit);
      u_i_native = value / 2 / distributionDivisor;
      unit_native = unit;
    } else {
      const high = parseFloat(tolComp?.high || 0);
      const low = parseFloat(tolComp?.low || -high);
      const halfSpan = (high - low) / 2;
      if (halfSpan === 0) return;

      const unit = tolComp.unit;
      let valueInNominalUnits;

      if (["%", "ppm", "ppb"].includes(unit)) {
        let multiplier = 0;
        if (unit === "%") multiplier = 0.01;
        else if (unit === "ppm") multiplier = 1e-6;
        else if (unit === "ppb") multiplier = 1e-9;

        valueInNominalUnits = halfSpan * multiplier * baseValueForRelative;
      } else {
        const valueInBase = unitSystem.toBaseUnit(halfSpan, unit);
        const nominalUnitInBase = unitSystem.toBaseUnit(1, nominalUnit);
        valueInNominalUnits = valueInBase / nominalUnitInBase;
      }

      halfSpanPPM = convertToPPM(
        valueInNominalUnits,
        nominalUnit,
        nominalValue,
        nominalUnit
      );
      u_i_native = valueInNominalUnits / distributionDivisor;
      unit_native = nominalUnit;
    }

    if (!isNaN(halfSpanPPM)) {
      const u_i = Math.abs(halfSpanPPM / distributionDivisor);
      budgetComponents.push({
        id: `${prefix}_${name.toLowerCase().replace(/\s/g, "")}`,
        name: `${prefix} - ${name}`,
        type: "B",
        value: u_i,
        value_native: u_i_native,
        unit_native: unit_native,
        dof: Infinity,
        isCore: true,
        distribution: distributionLabel,
      });
    }
  };
  processComponent(toleranceObject.reading, "Reading", nominalValue);

  processComponent(toleranceObject.readings_iv, "Readings (IV)", nominalValue);

  processComponent(
    toleranceObject.range,
    "Range",
    parseFloat(toleranceObject.range?.value)
  );
  processComponent(toleranceObject.floor, "Floor", nominalValue);

  if (toleranceObject.db && !isNaN(parseFloat(toleranceObject.db.high))) {
    const highDb = parseFloat(toleranceObject.db.high || 0);
    const lowDb = parseFloat(toleranceObject.db.low || -highDb);
    const dbTol = (highDb - lowDb) / 2;
    if (dbTol > 0) {
      const dbMult = parseFloat(toleranceObject.db.multiplier) || 20;
      const dbRef = parseFloat(toleranceObject.db.ref) || 1;
      const dbNominal = dbMult * Math.log10(nominalValue / dbRef);

      const centerDb = (highDb + lowDb) / 2;
      const nominalAtCenterTol =
        dbRef * Math.pow(10, (dbNominal + centerDb) / dbMult);
      const upperValue = dbRef * Math.pow(10, (dbNominal + highDb) / dbMult);
      const absoluteDeviation = Math.abs(upperValue - nominalAtCenterTol);

      const ppm = convertToPPM(
        absoluteDeviation,
        nominalUnit,
        nominalValue,
        nominalUnit
      );
      if (!isNaN(ppm)) {
        const distributionDivisor =
          parseFloat(toleranceObject.db.distribution) || 1.732;
        const distributionLabel =
          errorDistributions.find(
            (d) => d.value === String(toleranceObject.db.distribution)
          )?.label || "Rectangular";
        const u_i = Math.abs(ppm / distributionDivisor);
        budgetComponents.push({
          id: `${prefix}_db_${Math.random()}`,
          name: `${prefix} - dB`,
          type: "B",
          value: u_i,
          value_native: absoluteDeviation / distributionDivisor,
          unit_native: nominalUnit,
          dof: Infinity,
          isCore: true,
          distribution: distributionLabel,
        });
      }
    }
  }

  if (toleranceObject.measuringResolution) {
    processComponent(
      toleranceObject.measuringResolution,
      "Resolution",
      nominalValue,
      true
    );
  }

  return budgetComponents;
};

// --- Main Analysis Component ---
function Analysis({
  sessionData,
  testPointData,
  onDataSave,
  defaultTestPoint,
  setContextMenu,
  setBreakdownPoint,
  handleOpenSessionEditor,
  riskResults,
  setRiskResults,
  onDeleteTmdeDefinition,
  onDecrementTmdeQuantity,
  onOpenOverview,
  instruments
}) {
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const [year, month, day] = dateString.split("-");
    return `${month}/${day}/${year}`;
  };

  const [isAddTmdeModalOpen, setAddTmdeModalOpen] = useState(false);
  const [tmdeToEdit, setTmdeToEdit] = useState(null);
  const [analysisMode, setAnalysisMode] = useState("uncertaintyTool");
  const [showContribution, setShowContribution] = useState(false);
  const [editingComponentId, setEditingComponentId] = useState(null);
  const [isRepeatabilityModalOpen, setRepeatabilityModalOpen] = useState(false);

  const manualComponents = useMemo(() => {
    return testPointData.measurementType === "direct"
      ? testPointData.components || []
      : [];
  }, [testPointData.measurementType, testPointData.components]);

  const specInput = useMemo(() => {
    return testPointData.specifications || defaultTestPoint.specifications;
  }, [testPointData.specifications, defaultTestPoint.specifications]);

  const [newComponent, setNewComponent] = useState({
    name: "",
    type: "B",
    errorDistributionDivisor: "1.732",
    toleranceLimit: "",
    unit: "ppm",
    standardUncertainty: "",
    dof: "Infinity",
  });
  const [calcResults, setCalcResults] = useState(null);
  const [riskInputs, setRiskInputs] = useState({
    LLow: "",
    LUp: "",
  });
  const [breakdownModal, setLocalBreakdownModal] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isAddComponentModalOpen, setAddComponentModalOpen] = useState(false);
  const [calculationError, setCalculationError] = useState(null);
  const [isDerivedBreakdownOpen, setIsDerivedBreakdownOpen] = useState(false);
  const [derivedBreakdownData, setDerivedBreakdownData] = useState(null);

  const uutToleranceData = useMemo(
    () => sessionData.uutTolerance || {},
    [sessionData.uutTolerance]
  );
  const tmdeTolerancesData = useMemo(
    () => testPointData.tmdeTolerances || [],
    [testPointData.tmdeTolerances]
  );

  const uutNominal = useMemo(
    () => testPointData?.testPointInfo?.parameter,
    [testPointData?.testPointInfo?.parameter]
  );

  const handleEditTmde = (tmde) => {
    setTmdeToEdit(tmde);
    setAddTmdeModalOpen(true);
  };

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
      setNotification({
        title: "Invalid Input",
        message: "Enter valid UUT tolerance limits (Span cannot be zero).",
      });
      return;
    }
    if (isNaN(reliability) || reliability <= 0 || reliability >= 1) {
      setNotification({
        title: "Invalid Input",
        message: "Enter valid reliability (e.g., 0.95).",
      });
      return;
    }
    if (!calcResults) {
      setNotification({
        title: "Calculation Required",
        message: "Uncertainty budget must be calculated first.",
      });
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

    setRiskResults(newRiskMetrics);
    onDataSave({ riskMetrics: newRiskMetrics });
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
    setNotification,
    onDataSave,
    setRiskResults,
  ]);

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
    setRiskResults,
  ]);

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

  useEffect(() => {
    let combinedUncertaintyPPM = NaN;
    let combinedUncertaintyAbsoluteBase = NaN;
    let effectiveDof = Infinity;
    const componentsForBudgetTable = [];
    let calculatedNominalResult = NaN;
    let derivedUcInputs_Native = 0;
    let derivedUcInputs_Base = 0;

    try {
      setCalculationError(null);
      const hasVariables =
        testPointData.variableMappings &&
        Object.keys(testPointData.variableMappings).length > 0;
      const noTmdes = !tmdeTolerancesData || tmdeTolerancesData.length === 0;

      if (
        testPointData.measurementType === "derived" &&
        hasVariables &&
        noTmdes
      ) {
        setCalcResults(null);
        if (testPointData.is_detailed_uncertainty_calculated) {
          onDataSave({
            combined_uncertainty: null,
            effective_dof: null,
            k_value: null,
            expanded_uncertainty: null,
            is_detailed_uncertainty_calculated: false,
            calculatedBudgetComponents: [],
            calculatedNominalValue: null,
          });
        }
        return;
      }

      if (!uutNominal || !uutNominal.value || !uutNominal.unit) {
        throw new Error(
          "Missing UUT nominal value or unit for calculation reference."
        );
      }
      const derivedNominalValue = parseFloat(uutNominal.value);
      const derivedNominalUnit = uutNominal.unit;
      const targetUnitInfo = unitSystem.units[derivedNominalUnit];

      const derivedQuantityName = uutNominal.name || "Derived";

      if (!targetUnitInfo || isNaN(targetUnitInfo.to_si)) {
        throw new Error(
          `Derived unit '${derivedNominalUnit}' is not valid or has no SI conversion.`
        );
      }

      if (testPointData.measurementType === "derived") {
        const {
          combinedUncertaintyNative,
          breakdown: derivedBreakdown,
          nominalResult,
          error: calcError,
        } = calculateDerivedUncertainty(
          testPointData.equationString,
          testPointData.variableMappings,
          tmdeTolerancesData,
          uutNominal
        );

        if (calcError) {
          throw new Error(calcError);
        }
        if (isNaN(combinedUncertaintyNative)) {
          throw new Error(
            "Derived uncertainty calculation (inputs) resulted in NaN."
          );
        }
        derivedUcInputs_Native = combinedUncertaintyNative;
        derivedUcInputs_Base = derivedUcInputs_Native * targetUnitInfo.to_si;

        calculatedNominalResult = nominalResult;
        let totalVariance_Native = derivedUcInputs_Native ** 2;

        derivedBreakdown.forEach((item, index) => {
          const contributingTmde = tmdeTolerancesData.find(
            (tmde) => tmde.variableType === item.type
          );
          let distributionLabel = contributingTmde
            ? calculateUncertaintyFromToleranceObject(
              contributingTmde,
              contributingTmde.measurementPoint
            ).breakdown[0]?.distributionLabel || "N/A"
            : "N/A";

          const allContributingTmdes = tmdeTolerancesData.filter(
            (tmde) => tmde.variableType === item.type
          );
          const totalQuantity = allContributingTmdes.reduce(
            (sum, tmde) => sum + (tmde.quantity || 1),
            0
          );

          componentsForBudgetTable.push({
            id: `derived_${item.variable}_${index}`,
            name: `Input: ${item.type} (${item.variable})`,
            type: "B",
            value: item.ui_absolute_base,
            unit: item.unit,
            isBaseUnitValue: true,
            sensitivityCoefficient: item.ci,
            derivativeString: item.derivativeString,
            contribution: item.contribution_native,
            dof: Infinity,
            isCore: true,
            distribution: distributionLabel,
            sourcePointLabel: `${item.nominal} ${item.unit || ""}`,
            quantity: totalQuantity,
          });
        });

        // Add direct components like resolution
        let uutResolutionUncertaintyBase = 0;
        let uutResolutionUncertaintyNative = 0;
        const resComp = getBudgetComponentsFromTolerance(
          uutToleranceData,
          uutNominal
        ).find((comp) => comp.name.endsWith(" - Resolution"));

        if (resComp && !isNaN(resComp.value) && derivedNominalValue !== 0) {
          const derivedNominalInBase = unitSystem.toBaseUnit(
            derivedNominalValue,
            derivedNominalUnit
          );
          if (!isNaN(derivedNominalInBase) && derivedNominalInBase !== 0) {
            const deviationInBase =
              (resComp.value / 1e6) * Math.abs(derivedNominalInBase);

            uutResolutionUncertaintyBase = deviationInBase;
            uutResolutionUncertaintyNative =
              deviationInBase / targetUnitInfo.to_si;

            totalVariance_Native += uutResolutionUncertaintyNative ** 2;

            componentsForBudgetTable.push({
              id: `derived_resolution`,
              name: `${derivedQuantityName} - Resolution`,
              type: "B",
              value: uutResolutionUncertaintyBase,
              unit: derivedNominalUnit,
              isBaseUnitValue: true,
              sensitivityCoefficient: 1,
              derivativeString: null,
              contribution: uutResolutionUncertaintyNative,
              dof: Infinity,
              isCore: true,
              distribution: "Rectangular",
              sourcePointLabel: `${uutNominal.value} ${uutNominal.unit}`,
              quantity: 1,
            });
          }
        }

        const combinedUncertainty_Native = Math.sqrt(totalVariance_Native);
        combinedUncertaintyAbsoluteBase =
          combinedUncertainty_Native * targetUnitInfo.to_si;

        if (
          !isNaN(derivedNominalValue) &&
          derivedNominalUnit &&
          derivedNominalValue !== 0
        ) {
          const derivedNominalInBase = unitSystem.toBaseUnit(
            derivedNominalValue,
            derivedNominalUnit
          );
          if (!isNaN(derivedNominalInBase) && derivedNominalInBase !== 0) {
            combinedUncertaintyPPM =
              (combinedUncertaintyAbsoluteBase /
                Math.abs(derivedNominalInBase)) *
              1e6;
          }
        }

        effectiveDof = Infinity;
      } else {
        let totalVariancePPM = 0;
        const uutResolutionComponents = getBudgetComponentsFromTolerance(
          uutToleranceData,
          uutNominal
        )
          .filter((comp) => comp.name.endsWith(" - Resolution"))
          .map((c) => ({
            ...c,
            name: `${derivedQuantityName} - Resolution`,
            sourcePointLabel: `${uutNominal.value} ${uutNominal.unit}`,
          }));

        totalVariancePPM = 0;
        uutResolutionComponents.forEach((comp) => {
          totalVariancePPM += comp.value ** 2;
          componentsForBudgetTable.push(comp);
        });

        tmdeTolerancesData.forEach((tmde) => {
          if (tmde.measurementPoint && tmde.measurementPoint.value) {
            const quantity = tmde.quantity || 1;
            const components = getBudgetComponentsFromTolerance(
              tmde,
              tmde.measurementPoint
            ).map((c) => ({
              ...c,
              sourcePointLabel: `${uutNominal.value} ${uutNominal.unit}`,
              quantity: quantity,
            }));

            componentsForBudgetTable.push(...components);

            components.forEach((comp) => {
              totalVariancePPM += comp.value ** 2 * quantity;
            });
          }
        });

        const manual = manualComponents.map((c) => ({
          ...c,
          sourcePointLabel: "Manual",
        }));
        manual.forEach((comp) => {
          totalVariancePPM += comp.value ** 2;
          componentsForBudgetTable.push(comp);
        });

        combinedUncertaintyPPM = Math.sqrt(totalVariancePPM);

        const numerator = Math.pow(combinedUncertaintyPPM, 4);
        const denominator = componentsForBudgetTable.reduce((sum, comp) => {
          const dof =
            comp.dof === Infinity ||
              comp.dof == null ||
              isNaN(parseFloat(comp.dof))
              ? Infinity
              : parseFloat(comp.dof);
          return dof === Infinity ||
            dof <= 0 ||
            isNaN(comp.value) ||
            comp.value === 0
            ? sum
            : sum + Math.pow(comp.value, 4) / dof;
        }, 0);
        effectiveDof = denominator > 0 ? numerator / denominator : Infinity;

        if (
          !isNaN(combinedUncertaintyPPM) &&
          !isNaN(derivedNominalValue) &&
          derivedNominalUnit &&
          derivedNominalValue !== 0
        ) {
          const derivedNominalInBase = unitSystem.toBaseUnit(
            derivedNominalValue,
            derivedNominalUnit
          );
          if (!isNaN(derivedNominalInBase) && derivedNominalInBase !== 0) {
            combinedUncertaintyAbsoluteBase =
              (combinedUncertaintyPPM / 1e6) * Math.abs(derivedNominalInBase);
            componentsForBudgetTable.forEach((comp) => {
              const compBase =
                (comp.value / 1e6) * Math.abs(derivedNominalInBase);
              comp.contribution = compBase / targetUnitInfo.to_si;
            });
          }
        }
      }

      if (
        (isNaN(combinedUncertaintyPPM) &&
          isNaN(combinedUncertaintyAbsoluteBase)) ||
        componentsForBudgetTable.length === 0
      ) {
        setCalcResults(null);
        if (testPointData.is_detailed_uncertainty_calculated) {
          onDataSave({
            combined_uncertainty: null,
            effective_dof: null,
            k_value: null,
            expanded_uncertainty: null,
            is_detailed_uncertainty_calculated: false,
            calculatedBudgetComponents: [],
          });
        }
        return;
      }

      const confidencePercent =
        parseFloat(sessionData.uncReq.uncertaintyConfidence) || 95;
      const probability = 1 - (1 - confidencePercent / 100) / 2;
      const kValue =
        effectiveDof === Infinity || isNaN(effectiveDof)
          ? probit(probability)
          : getKValueFromTDistribution(effectiveDof);

      const expandedUncertaintyPPM = !isNaN(combinedUncertaintyPPM)
        ? kValue * combinedUncertaintyPPM
        : NaN;
      const expandedUncertaintyAbsoluteBase = !isNaN(
        combinedUncertaintyAbsoluteBase
      )
        ? kValue * combinedUncertaintyAbsoluteBase
        : NaN;

      const newResults = {
        combined_uncertainty: combinedUncertaintyPPM,
        combined_uncertainty_absolute_base: combinedUncertaintyAbsoluteBase,
        combined_uncertainty_inputs_native: derivedUcInputs_Native,
        combined_uncertainty_inputs_base: derivedUcInputs_Base,
        effective_dof: effectiveDof,
        k_value: kValue,
        expanded_uncertainty: expandedUncertaintyPPM,
        expanded_uncertainty_absolute_base: expandedUncertaintyAbsoluteBase,
        is_detailed_uncertainty_calculated: true,
        calculatedBudgetComponents: componentsForBudgetTable,
        calculatedNominalValue: calculatedNominalResult,
      };

      setCalcResults(newResults);

      const resultsHaveChanged =
        !testPointData.is_detailed_uncertainty_calculated ||
        Math.abs(
          (testPointData.expanded_uncertainty || 0) -
          (newResults.expanded_uncertainty || 0)
        ) > 1e-9 ||
        Math.abs(
          (testPointData.expanded_uncertainty_absolute_base || 0) -
          (newResults.expanded_uncertainty_absolute_base || 0)
        ) > 1e-9 ||
        JSON.stringify(testPointData.calculatedBudgetComponents) !==
        JSON.stringify(newResults.calculatedBudgetComponents);

      if (resultsHaveChanged) {
        onDataSave({
          combined_uncertainty: newResults.combined_uncertainty,
          combined_uncertainty_absolute_base:
            newResults.combined_uncertainty_absolute_base,
          combined_uncertainty_inputs_native:
            newResults.combined_uncertainty_inputs_native,
          combined_uncertainty_inputs_base:
            newResults.combined_uncertainty_inputs_base,
          effective_dof: newResults.effective_dof,
          k_value: newResults.k_value,
          expanded_uncertainty: newResults.expanded_uncertainty,
          expanded_uncertainty_absolute_base:
            newResults.expanded_uncertainty_absolute_base,
          is_detailed_uncertainty_calculated:
            newResults.is_detailed_uncertainty_calculated,
          calculatedBudgetComponents: newResults.calculatedBudgetComponents,
          calculatedNominalValue: newResults.calculatedNominalValue,
        });
      }
    } catch (error) {
      console.error("Error during uncertainty calculation useEffect:", error);
      setCalculationError(error.message);
      setCalcResults(null);
      if (testPointData.is_detailed_uncertainty_calculated) {
        onDataSave({
          combined_uncertainty: null,
          effective_dof: null,
          k_value: null,
          expanded_uncertainty: null,
          is_detailed_uncertainty_calculated: false,
          calculatedBudgetComponents: [],
          calculatedNominalValue: null,
        });
      }
    }
  }, [
    testPointData.measurementType,
    testPointData.equationString,
    testPointData.variableMappings,
    tmdeTolerancesData,
    uutToleranceData,
    uutNominal,
    manualComponents,
    sessionData.uncReq.uncertaintyConfidence,
    onDataSave,
    testPointData.is_detailed_uncertainty_calculated,
    testPointData.expanded_uncertainty,
    testPointData.calculatedBudgetComponents,
    testPointData.expanded_uncertainty_absolute_base,
    unitSystem,
    probit,
    getKValueFromTDistribution,
  ]);

  const handleBudgetRowContextMenu = (event, componentData) => {
    event.preventDefault();

    if (testPointData.measurementType !== "derived" || !calcResults) {
      return;
    }

    const breakdownPayload = {
      equationString: testPointData.equationString,
      components: calcResults.calculatedBudgetComponents || [],
      results: calcResults,
      derivedNominalPoint: uutNominal,
      tmdeTolerances: tmdeTolerancesData,
    };

    setDerivedBreakdownData(breakdownPayload);
    setIsDerivedBreakdownOpen(true);
  };

  const handleShowDerivedBreakdown = () => {

    if (testPointData.measurementType !== "derived" || !calcResults) {
      return;
    }

    const breakdownPayload = {
      equationString: testPointData.equationString,
      components: calcResults.calculatedBudgetComponents || [],
      results: calcResults,
      derivedNominalPoint: uutNominal,
      tmdeTolerances: tmdeTolerancesData,
    };

    setDerivedBreakdownData(breakdownPayload);
    setIsDerivedBreakdownOpen(true);
  };

  const handleSaveTmde = (tmdeToSave, andClose = true) => {

    const existingIndex = tmdeTolerancesData.findIndex(
      (t) => t.id === tmdeToSave.id
    );
    let updatedTolerances;

    if (existingIndex > -1) {
      updatedTolerances = tmdeTolerancesData.map((t, index) =>
        index === existingIndex ? tmdeToSave : t
      );
    } else {
      updatedTolerances = [...tmdeTolerancesData, tmdeToSave];
    }
    onDataSave({ tmdeTolerances: updatedTolerances });

    if (andClose) {
      setAddTmdeModalOpen(false);
      setTmdeToEdit(null);
    }
  };

  // --- Edit Logic ---
  const handleEditManualComponent = (component) => {
    // Populate state with existing data
    setNewComponent({
      name: component.name,
      type: component.type,
      // If we have stored original values, use them. Otherwise fallback.
      standardUncertainty: component.originalInput?.standardUncertainty || "",
      toleranceLimit: component.originalInput?.toleranceLimit || "",
      errorDistributionDivisor: component.originalInput?.errorDistributionDivisor || "1.732",
      unit: component.unit_native || component.unit || "ppm", // Use unit_native
      dof: component.dof === Infinity ? "Infinity" : String(component.dof),
    });
    setEditingComponentId(component.id);
    setAddComponentModalOpen(true);
  }

  const handleAddComponent = () => {
    if (testPointData.measurementType === "derived") {
      setNotification({
        title: "Not Applicable",
        message:
          "Manual components cannot be added to derived measurement points.",
      });
      return;
    }
    let valueInPPM = NaN;
    let dof =
      newComponent.dof === "Infinity" ? Infinity : parseFloat(newComponent.dof);

    // Store original input values so we can edit them later without reverse conversion issues
    const originalInputData = {
      standardUncertainty: newComponent.standardUncertainty,
      toleranceLimit: newComponent.toleranceLimit,
      errorDistributionDivisor: newComponent.errorDistributionDivisor,
    };

    let valueNative = NaN;

    if (newComponent.type === "A") {
      const stdUnc = parseFloat(newComponent.standardUncertainty);

      if (isNaN(stdUnc) || stdUnc <= 0 || (dof !== Infinity && (isNaN(dof) || dof < 1))) {
        setNotification({
          title: "Invalid Input",
          message: "For Type A, provide valid positive Std Unc and DoF (>=1).",
        });
        return;
      }

      // Calculate PPM
      const { value: ppm, warning } = convertToPPM(
        stdUnc,
        newComponent.unit,
        uutNominal?.value,
        uutNominal?.unit,
        null,
        true
      );

      if (warning) {
        setNotification({ title: "Conversion Error", message: warning });
        return;
      }
      valueInPPM = ppm;
      valueNative = stdUnc; // For Type A, native value is simply the Std Unc input
    } else {
      // Type B
      const rawValue = parseFloat(newComponent.toleranceLimit);
      const divisor = parseFloat(newComponent.errorDistributionDivisor);

      if (isNaN(rawValue) || rawValue <= 0 || isNaN(divisor)) {
        setNotification({
          title: "Invalid Input",
          message:
            "Provide valid positive tolerance limit and select distribution.",
        });
        return;
      }

      const { value: ppm, warning } = convertToPPM(
        rawValue,
        newComponent.unit,
        uutNominal?.value,
        uutNominal?.unit,
        null,
        true
      );

      if (warning) {
        setNotification({ title: "Conversion Error", message: warning });
        return;
      }
      valueInPPM = ppm / divisor;
      valueNative = rawValue / divisor; // Store the reduced uncertainty in native units
    }

    if (!newComponent.name || isNaN(valueInPPM)) {
      setNotification({
        title: "Invalid Input",
        message: "Component name and valid uncertainty value required.",
      });
      return;
    }

    const distributionLabel = oldErrorDistributions.find(
      (d) => d.value === newComponent.errorDistributionDivisor
    )?.label;

    const componentData = {
      ...newComponent,
      id: editingComponentId || Date.now(), // Use existing ID if editing
      value: valueInPPM,
      value_native: valueNative, // Store native value for display
      unit_native: newComponent.unit, // Store native unit
      dof,
      distribution: distributionLabel,
      originalInput: originalInputData // Store raw inputs for editing
    };

    let updatedComponents;
    if (editingComponentId) {
      // Update existing
      updatedComponents = manualComponents.map(c => c.id === editingComponentId ? componentData : c);
    } else {
      // Add new
      updatedComponents = [...manualComponents, componentData];
    }

    onDataSave({ components: updatedComponents });

    // Reset form
    setNewComponent({
      name: "",
      type: "B",
      errorDistributionDivisor: "1.732",
      toleranceLimit: "",
      unit: "ppm",
      standardUncertainty: "",
      dof: "Infinity",
    });
    setEditingComponentId(null);
    setAddComponentModalOpen(false);
  };

  const handleRemoveComponent = (id) => {
    const updatedComponents = manualComponents.filter((c) => c.id !== id);
    if (updatedComponents.length < manualComponents.length) {
      onDataSave({ components: updatedComponents });
    } else {
      setNotification({
        title: "Action Not Allowed",
        message: "Core budget components cannot be removed here.",
      });
    }
  };

  const handleSaveRepeatability = (data) => {
    // 1. Convert the calculated StdDev (which is in `data.unit`) to PPM relative to the UUT Nominal
    const { value: ppm, warning } = convertToPPM(
        data.stdDev,
        data.unit,
        uutNominal?.value,
        uutNominal?.unit,
        null, 
        true // isStandardUncertainty = true
    );

    if (warning) {
        setNotification({ title: "Conversion Error", message: warning });
        return;
    }

    const componentData = {
        id: `repeatability_${Date.now()}`,
        name: "Repeatability",
        sourcePointLabel: `N=${data.count}, Mean=${data.mean.toPrecision(5)}`,
        type: "A",
        value: ppm, // Store as PPM for consistency with the rest of the budget logic
        value_native: data.stdDev, // Store absolute for display
        unit_native: data.unit,
        dof: data.dof,
        distribution: "Normal", // Type A is treated as Normal
        isCore: false // Allows deletion
    };

    const updatedComponents = [...manualComponents, componentData];
    onDataSave({ components: updatedComponents });
  };

  const handleNewComponentInputChange = (e) =>
    setNewComponent((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const unitOptions = useMemo(() => {
    const nominalUnit = uutNominal?.unit;
    if (!nominalUnit) return ["ppm", "ppb"];
    const relevant = unitSystem.getRelevantUnits(nominalUnit);
    return ["ppm", "ppb", ...relevant.filter((u) => u !== "ppm" && u !== "ppb" && u !== "dB")];
  }, [uutNominal]);

  const renderAddComponentModal = () => {
    if (!isAddComponentModalOpen) return null;
    return (
      <div className="modal-overlay">
        <div className="modal-content" style={{ maxWidth: "800px" }}>
          <button
            onClick={() => {
              setAddComponentModalOpen(false);
              setEditingComponentId(null);
              setNewComponent({ // Reset on close
                name: "",
                type: "B",
                errorDistributionDivisor: "1.732",
                toleranceLimit: "",
                unit: "ppm",
                standardUncertainty: "",
                dof: "Infinity",
              });
            }}
            className="modal-close-button"
          >
            &times;
          </button>
          <h3>{editingComponentId ? "Edit Component" : "Add Manual Uncertainty Component"}</h3>
          <div
            className="config-stack"
            style={{ paddingTop: "20px", textAlign: "left" }}
          >
            <div className="config-column">
              <label>Component Name</label>
              <input
                type="text"
                name="name"
                value={newComponent.name}
                onChange={handleNewComponentInputChange}
                placeholder="e.g., UUT Stability Spec"
              />
            </div>
            <div className="config-column">
              <label>Type</label>
              <select
                name="type"
                value={newComponent.type}
                onChange={handleNewComponentInputChange}
              >
                <option value="A">Type A</option>
                <option value="B">Type B</option>
              </select>
            </div>
            {newComponent.type === "A" && (
              <>
                <div className="config-column">
                  <label>Std Unc (uᵢ)</label>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      step="any"
                      name="standardUncertainty"
                      value={newComponent.standardUncertainty}
                      onChange={handleNewComponentInputChange}
                      placeholder="e.g., 15.3"
                    />
                    <select
                      name="unit"
                      value={newComponent.unit}
                      onChange={handleNewComponentInputChange}
                    >
                      {unitOptions.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <ConversionInfo
                    value={newComponent.standardUncertainty}
                    unit={newComponent.unit}
                    nominal={uutNominal}
                  />
                </div>
                <div className="config-column">
                  <label>DoF (vᵢ)</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    name="dof"
                    value={newComponent.dof}
                    onChange={handleNewComponentInputChange}
                    placeholder="e.g., 9"
                  />
                </div>
              </>
            )}
            {newComponent.type === "B" && (
              <>
                <div className="config-column">
                  <label>Distribution</label>
                  <select
                    name="errorDistributionDivisor"
                    value={newComponent.errorDistributionDivisor}
                    onChange={handleNewComponentInputChange}
                  >
                    {oldErrorDistributions.map((dist) => (
                      <option key={dist.value} value={dist.value}>
                        {dist.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="config-column">
                  <label>Tolerance Limits (±)</label>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      step="any"
                      name="toleranceLimit"
                      value={newComponent.toleranceLimit}
                      onChange={handleNewComponentInputChange}
                      placeholder="e.g., 100"
                    />
                    <select
                      name="unit"
                      value={newComponent.unit}
                      onChange={handleNewComponentInputChange}
                    >
                      {unitOptions.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <ConversionInfo
                    value={newComponent.toleranceLimit}
                    unit={newComponent.unit}
                    nominal={uutNominal}
                  />
                </div>
                <div className="config-column">
                  <label>DoF</label>
                  <input
                    type="text" // CHANGED FROM NUMBER TO TEXT
                    name="dof"
                    value={newComponent.dof}
                    onChange={handleNewComponentInputChange}
                    placeholder="Infinity"
                  />
                </div>
              </>
            )}
          </div>
          <div className="modal-actions">
            <button 
                onClick={handleAddComponent} 
                title={editingComponentId ? "Update Component" : "Add Component"}
                style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: 'var(--primary-color)', 
                    cursor: 'pointer', 
                    fontSize: '1.5rem',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    transition: 'transform 0.2s ease, color 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <FontAwesomeIcon icon={faCheck} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="analysis-session-header">
        <div className="session-info-item">
          <span className="session-info-label">UUT</span>
          <span className="session-info-value">
            {sessionData.uutDescription || "N/A"}
          </span>
        </div>
        <div className="session-info-item">
          <span className="session-info-label">Analyst</span>
          <span className="session-info-value">
            {sessionData.analyst || "N/A"}
          </span>
        </div>
        <div className="session-info-item">
          <span className="session-info-label">Document</span>
          <span className="session-info-value">
            {sessionData.document || "N/A"}
          </span>
        </div>
        <div className="session-info-item">
          <span className="session-info-label">Date</span>
          <span className="session-info-value">
            {formatDate(sessionData.documentDate)}
          </span>
        </div>
        <button
          className="sidebar-action-button"
          onClick={onOpenOverview}
          title="View Session Overview"
          style={{
            marginLeft: "auto",
            height: "42px",
            padding: "0 30px",
            fontSize: "0.9rem",
            fontWeight: "700",
            whiteSpace: "nowrap",
            textTransform: "uppercase",
            letterSpacing: "1px",
            color: "var(--primary-color)",
            background: "var(--content-background)",
            border: "2px solid transparent",
            borderRadius: "50px",
            backgroundImage:
              "linear-gradient(var(--content-background), var(--content-background)), var(--border-gradient)",
            backgroundOrigin: "border-box",
            backgroundClip: "padding-box, border-box",
            boxShadow: "var(--box-shadow-glow)",
            transition: "all 0.3s ease",
            cursor: "pointer",
            flexShrink: 0,
            minWidth: "fit-content",
          }}
        >
          Session Overview
        </button>
      </div>
      <NotificationModal
        isOpen={!!notification}
        onClose={() => setNotification(null)}
        title={notification?.title}
        message={notification?.message}
      />

      {renderAddComponentModal()}
      <DerivedBreakdownModal
        isOpen={isDerivedBreakdownOpen}
        onClose={() => setIsDerivedBreakdownOpen(false)}
        breakdownData={derivedBreakdownData}
      />

      <RiskBreakdownModal
        isOpen={!!breakdownModal}
        onClose={() => setLocalBreakdownModal(null)}
        modalType={breakdownModal}
        data={{
          results: riskResults,
          inputs: riskResults
            ? {
              LLow: parseFloat(riskInputs.LLow),
              LUp: parseFloat(riskInputs.LUp),
              reliability: parseFloat(sessionData.uncReq.reliability),
              guardBandMultiplier: parseFloat(
                sessionData.uncReq.guardBandMultiplier
              ),
              ...riskResults.gbInputs,
            }
            : null,
        }}
      />

      <RepeatabilityModal 
            isOpen={isRepeatabilityModalOpen}
            onClose={() => setRepeatabilityModalOpen(false)}
            onSave={handleSaveRepeatability}
            uutNominal={uutNominal}
        />

      <div className="analysis-tabs">
        <button
          className={analysisMode === "uncertaintyTool" ? "active" : ""}
          onClick={() => setAnalysisMode("uncertaintyTool")}
        >
          Uncertainty Analysis
        </button>
        <button
          className={analysisMode === "risk" ? "active" : ""}
          onClick={() => setAnalysisMode("risk")}
        >
          Risk Analysis
        </button>
        <button
          className={analysisMode === "riskmitigation" ? "active" : ""}
          onClick={() => setAnalysisMode("riskmitigation")}
        >
          Risk Mitigation
        </button>
      </div>

      {analysisMode === "uncertaintyTool" && (
        <div className="analysis-dashboard">
          <AddTmdeModal
            isOpen={isAddTmdeModalOpen}
            onClose={() => {
              setAddTmdeModalOpen(false);
              setTmdeToEdit(null);
            }}
            onSave={handleSaveTmde}
            testPointData={testPointData}
            initialTmdeData={tmdeToEdit}
            instruments={instruments}
          />
          <div className="configuration-panel">
            <h4 className="uut-components-title">Unit Under Test</h4>
            <div className="uut-seal-container">
              <div
                className={`uut-seal ${testPointData.measurementType === "derived"
                    ? "derived-point"
                    : ""
                  }`}
                onClick={() => handleOpenSessionEditor("uut")}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    x: e.pageX,
                    y: e.pageY,
                    items: [
                      {
                        label: "View UUT Calculation",
                        action: () =>
                          setBreakdownPoint({
                            title: "UUT Breakdown",
                            toleranceObject: uutToleranceData,
                            referencePoint: uutNominal,
                          }),
                        icon: faCalculator,
                      },
                    ],
                  });
                }}
              >
                <div className="uut-seal-content">
                  <span className="seal-label">Unit Under Test</span>
                  <h4 className="seal-title">
                    {sessionData.uutDescription || "N/A"}
                  </h4>
                  <div className="seal-info-item">
                    <span>
                      Current Point{" "}
                      {testPointData.measurementType === "derived" &&
                        "(Derived)"}
                    </span>
                    <strong>
                      {testPointData.measurementType === "derived"
                        ? calcResults?.calculatedNominalValue?.toPrecision(5) ??
                        (testPointData.testPointInfo.parameter.name ||
                          "Derived Value")
                        : `${uutNominal?.value ?? ""} ${uutNominal?.unit ?? ""
                        }`}{" "}
                      {testPointData.measurementType === "derived" &&
                        ` (${uutNominal?.unit ?? ""})`}
                    </strong>
                  </div>
                  {testPointData.measurementType === "derived" &&
                    testPointData.equationString && (
                      <div
                        className="seal-info-item"
                        style={{ fontStyle: "italic", marginTop: "5px" }}
                      >
                        <span>Equation</span>
                        <strong style={{ fontFamily: "monospace" }}>
                          {testPointData.equationString}
                        </strong>
                      </div>
                    )}
                  <div className="seal-info-item">
                    <span>Tolerance Spec</span>
                    <strong>{getToleranceSummary(uutToleranceData)}</strong>
                  </div>
                  <div className="seal-info-item">
                    <span>Calculated Error</span>
                    <strong>
                      {getToleranceErrorSummary(uutToleranceData, uutNominal)}
                    </strong>
                  </div>
                  <div className="seal-limits-split">
                    <div className="seal-info-item">
                      <span>Low Limit</span>
                      <strong className="calculated-limit">
                        {getAbsoluteLimits(uutToleranceData, uutNominal).low}
                      </strong>
                    </div>
                    <div className="seal-info-item">
                      <span>High Limit</span>
                      <strong className="calculated-limit">
                        {getAbsoluteLimits(uutToleranceData, uutNominal).high}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <h4 className="analyzed-components-title">
              Test Measurement Device Equipment
            </h4>

            <div className="analyzed-components-container">
              {tmdeTolerancesData.flatMap((tmde, index) => {
                const quantity = tmde.quantity || 1;

                return Array.from({ length: quantity }, (_, i) => {
                  const referencePoint = tmde.measurementPoint;
                  if (!referencePoint?.value || !referencePoint?.unit) {
                    console.warn("TMDE missing ref:", tmde);
                    return (
                      <div
                        key={`${tmde.id || index}-${i}`}
                        className="tmde-seal tmde-seal-error"
                      >
                        <div className="uut-seal-content">
                          <span className="seal-label">TMDE (Error)</span>
                          <h4>{tmde.name || "TMDE"}</h4>
                          <p
                            style={{
                              color: "var(--status-bad)",
                              fontSize: "0.8rem",
                              marginTop: "10px",
                            }}
                          >
                            Missing Reference
                          </p>
                          <button
                            onClick={() => handleEditTmde(tmde)} // Fixed Handler
                            className="button button-small"
                            style={{ marginTop: "auto" }}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={`${tmde.id || index}-${i}`}
                      className="tmde-seal"
                      onClick={() => handleEditTmde(tmde)} // Fixed Handler
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.preventDefault();
                        const menuItems = [
                          {
                            label: `View ${tmde.name || "TMDE"} Calculation`,
                            action: () =>
                              setBreakdownPoint({
                                title: `${tmde.name || "TMDE"} Breakdown`,
                                toleranceObject: tmde,
                                referencePoint: tmde.measurementPoint,
                              }),
                            icon: faCalculator,
                          },
                          {
                            label: `Edit "${tmde.name}" (All ${quantity})`,
                            action: () => handleEditTmde(tmde), // Fixed Handler
                            icon: faPencilAlt,
                          },
                          { type: "divider" },
                        ];

                        if (quantity > 1) {
                          menuItems.push({
                            label: `Delete This Instance`,
                            action: () => onDecrementTmdeQuantity(tmde.id),
                            icon: faTrashAlt,
                            className: "destructive",
                          });
                        }

                        menuItems.push({
                          label: `Delete All "${tmde.name}"`,
                          action: () => onDeleteTmdeDefinition(tmde.id),
                          icon: faTrashAlt,
                          className: "destructive",
                        });

                        setContextMenu({
                          x: e.pageX,
                          y: e.pageY,
                          items: menuItems,
                        });
                      }}
                    >
                      <div className="uut-seal-content">
                        <span className="seal-label">TMDE</span>
                        <h4 className="seal-title">{tmde.name || "TMDE"}</h4>

                        {quantity > 1 && (
                          <span className="seal-label seal-instance-label">
                            (Device {i + 1} of {quantity})
                          </span>
                        )}

                        {testPointData.measurementType === "derived" &&
                          tmde.variableType && (
                            <div className="seal-info-item">
                              <span>Equation Input Type</span>
                              <strong
                                style={{
                                  color: "var(--primary-color-dark)",
                                  fontSize: "0.9rem",
                                }}
                              >
                                {tmde.variableType}
                              </strong>
                            </div>
                          )}
                        <div className="seal-info-item">
                          <span>Nominal Point</span>
                          <strong>
                            {referencePoint.value} {referencePoint.unit}
                          </strong>
                        </div>
                        <div className="seal-info-item">
                          <span>Tolerance Spec</span>
                          <strong>{getToleranceSummary(tmde)}</strong>
                        </div>
                        <div className="seal-info-item">
                          <span>Calculated Error</span>
                          <strong>
                            {getToleranceErrorSummary(tmde, referencePoint)}
                          </strong>
                        </div>
                        <div className="seal-info-item">
                          <span>
                            Std. Unc (u<sub>i</sub>)
                          </span>
                          <strong>
                            {(() => {
                              const { standardUncertainty: uPpm } =
                                calculateUncertaintyFromToleranceObject(
                                  tmde,
                                  referencePoint
                                );
                              const uAbs = convertPpmToUnit(
                                uPpm,
                                referencePoint.unit,
                                referencePoint
                              );
                              return typeof uAbs === "number"
                                ? `${uAbs.toPrecision(3)} ${referencePoint.unit
                                }`
                                : uAbs;
                            })()}
                          </strong>
                        </div>
                        <div className="seal-limits-split">
                          <div className="seal-info-item">
                            <span>Low Limit</span>
                            <strong className="calculated-limit">
                              {getAbsoluteLimits(tmde, referencePoint).low}
                            </strong>
                          </div>
                          <div className="seal-info-item">
                            <span>High Limit</span>
                            <strong className="calculated-limit">
                              {getAbsoluteLimits(tmde, referencePoint).high}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })}

              <div className="add-tmde-card">
                <button
                  className="add-tmde-button"
                  onClick={() => setAddTmdeModalOpen(true)}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  <span>Add TMDE</span>
                </button>
              </div>
            </div>
            <>
              {calculationError ? (
                <div className="form-section-warning">
                  <p>
                    <strong>Calculation Error:</strong> {calculationError}
                  </p>
                  <p
                    style={{
                      marginTop: "5px",
                      fontSize: "0.9rem",
                      color: "var(--text-color-muted)",
                    }}
                  >
                    Please ensure all required fields are set (e.g., UUT
                    nominal, equation, and all mapped TMDEs).
                  </p>
                </div>
              ) : (
                <>
                  <UncertaintyBudgetTable
                    components={calcResults?.calculatedBudgetComponents || []}
                    onRemove={handleRemoveComponent}
                    calcResults={calcResults}
                    referencePoint={uutNominal}
                    uncertaintyConfidence={
                      sessionData.uncReq.uncertaintyConfidence
                    }
                    onRowContextMenu={handleBudgetRowContextMenu}
                    equationString={testPointData.equationString}
                    measurementType={testPointData.measurementType}
                    riskResults={riskResults}
                    onShowDerivedBreakdown={handleShowDerivedBreakdown}
                    onShowRiskBreakdown={(modalType) =>
                      setLocalBreakdownModal(modalType)
                    }
                    showContribution={showContribution}
                    setShowContribution={setShowContribution}
                    hasTmde={tmdeTolerancesData.length > 0}
                    onAddManualComponent={() => setAddComponentModalOpen(true)}
                    onEdit={handleEditManualComponent}
                    onOpenRepeatability={() => setRepeatabilityModalOpen(true)}
                  />
                  {showContribution &&
                    calcResults?.calculatedBudgetComponents &&
                    calcResults.calculatedBudgetComponents.length > 0 && (
                      <PercentageBarGraph
                        type={testPointData.measurementType === "derived"}
                        unit={uutNominal?.unit || "Units"}
                        data={Object.fromEntries(
                          calcResults.calculatedBudgetComponents.map((item) => {
                            const value =
                              testPointData.measurementType === "derived"
                                ? item.contribution || 0
                                : item.value_native || item.value || 0;

                            const label = item.name.startsWith("Input: ")
                              ? item.name.substring(7)
                              : item.name;

                            return [label, value];
                          })
                        )}
                      />
                    )}
                </>
              )}
            </>
          </div>
        </div>
      )}
      {analysisMode === "risk" && (
        <div>
          <>
            {!calcResults ? (
              <div className="form-section-warning">
                <p>Uncertainty budget must be calculated first.</p>
              </div>
            ) : (
              <>
                {riskResults ? (
                  <>
                    <RiskAnalysisDashboard
                      results={riskResults}
                      onShowBreakdown={(modalType) =>
                        setLocalBreakdownModal(modalType)
                      }
                    />
                    <RiskScatterplot
                      results={riskResults}
                      inputs={{
                        LLow: parseFloat(riskInputs.LLow),
                        LUp: parseFloat(riskInputs.LUp),
                      }}
                    />
                  </>
                ) : (
                  <div
                    className="placeholder-content"
                    style={{ minHeight: "200px" }}
                  >
                    <p>Calculating risk...</p>
                  </div>
                )}
              </>
            )}
          </>
        </div>
      )}
      {analysisMode === "riskmitigation" && (
        <>
          {!calcResults ? (
            <div className="form-section-warning">
              <p>Uncertainty budget must be calculated first.</p>
            </div>
          ) : (
            <>
              {riskResults ? (
                <RiskMitigationDashboard
                  results={riskResults}
                  onShowBreakdown={(modalType) =>
                    setLocalBreakdownModal(modalType)
                  }
                />
              ) : (
                <div
                  className="placeholder-content"
                  style={{ minHeight: "200px" }}
                >
                  <p>Calculating risk...</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default Analysis;