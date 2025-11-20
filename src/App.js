/* global math */
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { probit } from "simple-statistics";
import Latex from "react-latex-next";
import "katex/dist/katex.min.css";
import "./App.css";
import AddTestPointModal from "./components/AddTestPointModal";
import TestPointDetailView from "./components/TestPointDetailView";
import ToleranceToolModal from "./components/ToleranceToolModal";
import EditSessionModal from "./components/EditSessionModal";
import ContextMenu from "./components/ContextMenu";
import FullBreakdownModal from "./components/FullBreakdownModal";
import DerivedBreakdownModal from "./components/DerivedBreakdownModal";
import TestPointInfoModal from "./components/TestPointInfoModal";
import RiskScatterplot from "./components/RiskScatterplot";
import PercentageBarGraph from "./components/ContributionPlot.js";
import AddTmdeModal from "./components/AddTmdeModal";
import { generateOverviewReport } from './utils/pdfGenerator.js';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faInfoCircle,
  faCalculator,
  faPlus,
  faEdit,
  faTrashAlt,
  faPencilAlt,
  faSlidersH,
  faSave,
  faFolderOpen,
} from "@fortawesome/free-solid-svg-icons";

import * as PDFLib from 'pdf-lib';
const {
  PDFDocument,
  StandardFonts,
  PDFName,
  PDFDict,
  PDFArray,
  PDFHexString,
  PDFString,
  PDFStream,
  decodePDFRawStream,
  PDFRawStream,
} = PDFLib;

export const unitSystem = {
  units: {
    // Voltage
    V: { quantity: "Voltage", to_si: 1 },
    mV: { quantity: "Voltage", to_si: 1e-3 },
    uV: { quantity: "Voltage", to_si: 1e-6 },
    nV: { quantity: "Voltage", to_si: 1e-9 },
    pV: { quantity: "Voltage", to_si: 1e-12 },
    // Current
    A: { quantity: "Current", to_si: 1 },
    mA: { quantity: "Current", to_si: 1e-3 },
    uA: { quantity: "Current", to_si: 1e-6 },
    nA: { quantity: "Current", to_si: 1e-9 },
    pA: { quantity: "Current", to_si: 1e-12 },
    // Frequency
    Hz: { quantity: "Frequency", to_si: 1 },
    kHz: { quantity: "Frequency", to_si: 1e3 },
    MHz: { quantity: "Frequency", to_si: 1e6 },
    GHz: { quantity: "Frequency", to_si: 1e9 },
    mHz: { quantity: "Frequency", to_si: 1e-3 },
    uHz: { quantity: "Frequency", to_si: 1e-6 },
    // Resistance
    Ohm: { quantity: "Resistance", to_si: 1 },
    kOhm: { quantity: "Resistance", to_si: 1e3 },
    MOhm: { quantity: "Resistance", to_si: 1e6 },
    // Length
    m: { quantity: "Length", to_si: 1 },
    cm: { quantity: "Length", to_si: 1e-2 },
    mm: { quantity: "Length", to_si: 1e-3 },
    µm: { quantity: "Length", to_si: 1e-6 },
    nm: { quantity: "Length", to_si: 1e-9 },
    pm: { quantity: "Length", to_si: 1e-12 },
    in: { quantity: "Length", to_si: 0.0254 },
    µin: { quantity: "Length", to_si: 2.54e-8 },
    ft: { quantity: "Length", to_si: 0.3048 },
    yd: { quantity: "Length", to_si: 0.9144 },
    mi: { quantity: "Length", to_si: 1609.34 },
    // Mass
    kg: { quantity: "Mass", to_si: 1 },
    g: { quantity: "Mass", to_si: 1e-3 },
    mg: { quantity: "Mass", to_si: 1e-6 },
    lb: { quantity: "Mass", to_si: 0.453592 },
    oz: { quantity: "Mass", to_si: 0.0283495 },
    // Force
    N: { quantity: "Force", to_si: 1 },
    kN: { quantity: "Force", to_si: 1000 },
    lbf: { quantity: "Force", to_si: 4.44822 },
    ozf: { quantity: "Force", to_si: 0.278014 },
    // Torque
    "N-m": { quantity: "Torque", to_si: 1 },
    "ft-lbf": { quantity: "Torque", to_si: 1.35582 },
    "in-lbf": { quantity: "Torque", to_si: 0.112985 },
    "in-ozf": { quantity: "Torque", to_si: 0.00706155 },
    // Relative, Temp, dB
    "%": { quantity: "Relative", to_si: 1e-2 },
    ppm: { quantity: "Relative", to_si: 1e-6 },
    "deg C": { quantity: "Temperature", to_si: 1 },
    "deg F": { quantity: "Temperature", to_si: NaN },
    dB: { quantity: "dB", to_si: null },
  },

  getQuantity(unit) {
    return this.units[unit]?.quantity || null;
  },

  getRelevantUnits(unit) {
    const quantity = this.getQuantity(unit);
    const quantitiesToAlwaysInclude = ["Relative", "dB"];
    if (!quantity) return ["%", "ppm", "dB"];

    const relevant = Object.keys(this.units).filter((u) => {
      const uQuantity = this.units[u].quantity;
      return (
        uQuantity === quantity || quantitiesToAlwaysInclude.includes(uQuantity)
      );
    });
    return [...new Set(relevant)];
  },

  toBaseUnit(value, fromUnit) {
    const factor = this.units[fromUnit]?.to_si;
    if (factor === undefined || isNaN(factor)) return NaN;
    return parseFloat(value) * factor;
  },
};

export const convertPpmToUnit = (ppmValue, targetUnit, referencePoint) => {
  const nominalValue = parseFloat(referencePoint?.value);
  if (isNaN(ppmValue) || !referencePoint) return "N/A";
  if (targetUnit === "ppm") return ppmValue;

  if (isNaN(nominalValue)) return "N/A";

  if (nominalValue === 0) {
    if (targetUnit === "%") return ppmValue / 10000;
    return "N/A (Nominal is 0)";
  }

  const nominalInBase = unitSystem.toBaseUnit(
    nominalValue,
    referencePoint.unit
  );
  const deviationInBase = (ppmValue / 1e6) * Math.abs(nominalInBase);

  if (targetUnit === "%") {
    return (deviationInBase / Math.abs(nominalInBase)) * 100;
  }

  const targetUnitInfo = unitSystem.units[targetUnit];
  if (targetUnitInfo?.to_si) {
    return deviationInBase / targetUnitInfo.to_si;
  }

  return ppmValue;
};

export const getToleranceUnitOptions = (referenceUnit) => {
  const quantity = unitSystem.getQuantity(referenceUnit);
  if (!quantity) return ["%", "ppm"];

  const physicalUnits = Object.keys(unitSystem.units).filter(
    (u) => unitSystem.units[u].quantity === quantity
  );

  return ["%", "ppm", ...physicalUnits];
};

export const errorDistributions = [
  { value: "1.732", label: "Rectangular" },
  { value: "2.449", label: "Triangular" },
  { value: "1.414", label: "U-Shaped" },
  { value: "1.645", label: "Normal (90%)" },
  { value: "1.960", label: "Normal (95%)" },
  { value: "2.000", label: "Normal (95.45%)" },
  { value: "2.576", label: "Normal (99%)" },
  { value: "3.000", label: "Normal (99.73%)" },
  { value: "4.179", label: "Rayleigh" },
  { value: "1.000", label: "Std. Uncertainty" },
];

export const getToleranceSummary = (toleranceData) => {
  if (!toleranceData || Object.keys(toleranceData).length === 0)
    return "Not Set";

  const formatPart = (part) => {
    if (!part || (isNaN(parseFloat(part.high)) && isNaN(parseFloat(part.low))))
      return null;
    const high = parseFloat(part.high || 0);
    const low = parseFloat(part.low || -high);
    if (Math.abs(high + low) < 1e-9 && high > 0)
      return `±${high} ${part.unit || ""}`;
    return `+${high}/${low} ${part.unit || ""}`;
  };

  const parts = [];
  if (toleranceData.reading) parts.push(formatPart(toleranceData.reading));
  if (toleranceData.range)
    parts.push(`${formatPart(toleranceData.range)} of FS`);
  if (toleranceData.floor) parts.push(formatPart(toleranceData.floor));
  if (toleranceData.db) parts.push(formatPart(toleranceData.db));

  return parts.filter((p) => p).join(" + ") || "Not Set";
};

export const getToleranceErrorSummary = (toleranceObject, referencePoint) => {
  if (
    !toleranceObject ||
    Object.keys(toleranceObject).length <= 1 ||
    !referencePoint ||
    !referencePoint.value
  ) {
    return "Not Set";
  }

  const { breakdown } = calculateUncertaintyFromToleranceObject(
    toleranceObject,
    referencePoint
  );

  const nominalValue = parseFloat(referencePoint.value);
  const nominalUnit = referencePoint.unit;

  if (breakdown.length === 0) {
    return "Not Calculated";
  }

  // Filter out components like "Resolution" that don't contribute to tolerance limits
  const specComponents = breakdown.filter(
    (comp) => comp.absoluteHigh !== undefined && comp.absoluteLow !== undefined
  );

  if (specComponents.length === 0) {
    return "N/A";
  }

  // Sum the high and low deviations from the nominal value
  const totalHighDeviation = specComponents.reduce((sum, comp) => {
    return sum + (comp.absoluteHigh - nominalValue);
  }, 0);

  const totalLowDeviation = specComponents.reduce((sum, comp) => {
    return sum + (comp.absoluteLow - nominalValue);
  }, 0);

  // Check for symmetry using a small epsilon for floating-point comparison
  if (
    Math.abs(totalHighDeviation + totalLowDeviation) < 1e-9 &&
    totalHighDeviation > 0
  ) {
    return `±${totalHighDeviation.toPrecision(3)} ${nominalUnit}`;
  }

  return `+${totalHighDeviation.toPrecision(
    3
  )} / ${totalLowDeviation.toPrecision(3)} ${nominalUnit}`;
};

export const getAbsoluteLimits = (toleranceObject, referencePoint) => {
  if (!toleranceObject || !referencePoint || !referencePoint.value) {
    return { high: "N/A", low: "N/A" };
  }

  // Reuse the master calculation function which already determines these values
  const { breakdown } = calculateUncertaintyFromToleranceObject(
    toleranceObject,
    referencePoint
  );

  if (breakdown.length === 0) {
    // If no specs are set, the limits are just the nominal value
    const nominal = `${parseFloat(referencePoint.value).toPrecision(7)} ${
      referencePoint.unit
    }`;
    return { high: nominal, low: nominal };
  }

  const nominalValue = parseFloat(referencePoint.value);
  const nominalUnit = referencePoint.unit;

  // FIX: Filter for components that are part of the tolerance spec (i.e., have absolute limits)
  // This prevents uncertainty-only components like "Resolution" from causing a NaN error.
  const specComponents = breakdown.filter(
    (comp) => comp.absoluteHigh !== undefined && comp.absoluteLow !== undefined
  );

  // Sum the high and low deviations from the nominal for each component part (e.g., % reading + floor)
  const totalHighDeviation = specComponents.reduce((sum, comp) => {
    return sum + (comp.absoluteHigh - nominalValue);
  }, 0);

  const totalLowDeviation = specComponents.reduce((sum, comp) => {
    return sum + (comp.absoluteLow - nominalValue);
  }, 0);

  const finalHighLimit = nominalValue + totalHighDeviation;
  const finalLowLimit = nominalValue + totalLowDeviation;

  return {
    high: `${finalHighLimit.toPrecision(7)} ${nominalUnit}`,
    low: `${finalLowLimit.toPrecision(7)} ${nominalUnit}`,
  };
};

export const calculateUncertaintyFromToleranceObject = (
  toleranceObject,
  referenceMeasurementPoint
) => {
  if (
    !toleranceObject ||
    !referenceMeasurementPoint ||
    !referenceMeasurementPoint.value ||
    !referenceMeasurementPoint.unit
  ) {
    return { standardUncertainty: 0, totalToleranceForTar: 0, breakdown: [] };
  }

  const nominalValue = parseFloat(referenceMeasurementPoint.value);
  const nominalUnit = referenceMeasurementPoint.unit;
  let totalVariance = 0;
  let totalLinearTolerance = 0;
  const breakdown = [];

  const addComponent = (tolComp, name, baseValueForRelative) => {
    if (
      !tolComp ||
      (isNaN(parseFloat(tolComp.high)) && isNaN(parseFloat(tolComp.low)))
    )
      return;

    const high = parseFloat(tolComp.high || 0);
    const low = parseFloat(tolComp.low || -high);
    const halfSpan = (high - low) / 2;

    if (halfSpan === 0) return;

    const unit = tolComp.unit;
    const divisor = parseFloat(tolComp.distribution) || 1.732;
    const distributionLabel =
      errorDistributions.find((d) => d.value === String(tolComp.distribution))
        ?.label || "Rectangular";

    let specString =
      Math.abs(high + low) < 1e-9
        ? `±${high} ${unit}`
        : `+${high}/${low} ${unit}`;

    let valueInNominalUnits;
    let explanation = "";

    if (unit === "%" || unit === "ppm") {
      valueInNominalUnits =
        halfSpan * unitSystem.units[unit].to_si * baseValueForRelative;
      explanation = `${halfSpan.toExponential(
        3
      )}${unit} of ${baseValueForRelative}${nominalUnit}`;
    } else {
      const valueInBase = unitSystem.toBaseUnit(halfSpan, unit);
      const nominalUnitInBase = unitSystem.toBaseUnit(1, nominalUnit);
      valueInNominalUnits = valueInBase / nominalUnitInBase;
      explanation = `${halfSpan.toExponential(3)} ${unit}`;
    }

    const rangeFsValue = parseFloat(toleranceObject.range?.value);
    const ppm = convertToPPM(
      valueInNominalUnits,
      nominalUnit,
      nominalValue,
      nominalUnit,
      rangeFsValue
    );

    if (!isNaN(ppm)) {
      const u_i = Math.abs(ppm / divisor);
      totalLinearTolerance += Math.abs(ppm);
      totalVariance += Math.pow(u_i, 2);

      // Calculate absolute deviations and final limits
      const highDeviation = (high / halfSpan) * valueInNominalUnits;
      const lowDeviation = (low / halfSpan) * valueInNominalUnits;
      const absoluteHigh = nominalValue + highDeviation;
      const absoluteLow = nominalValue + lowDeviation;

      breakdown.push({
        name,
        input: specString,
        explanation,
        ppm: Math.abs(ppm),
        u_i,
        divisor,
        distributionLabel,
        absoluteLow,
        absoluteHigh,
        originalHalfSpan: Math.abs(halfSpan),
        originalUnit: unit,
      });
    }
  };

  addComponent(toleranceObject.reading, "Reading", nominalValue);
  addComponent(
    toleranceObject.range,
    "Range",
    parseFloat(toleranceObject.range?.value)
  );
  addComponent(toleranceObject.floor, "Floor", nominalValue);

  const dbTolComp = toleranceObject.db;
  if (dbTolComp && !isNaN(parseFloat(dbTolComp.high))) {
    const highDb = parseFloat(dbTolComp.high || 0);
    const lowDb = parseFloat(dbTolComp.low || -highDb);
    const dbTol = (highDb - lowDb) / 2;

    if (dbTol > 0 && nominalValue > 0) {
      const dbMult = parseFloat(dbTolComp.multiplier) || 20;
      const dbRef = parseFloat(dbTolComp.ref) || 1;
      const divisor = parseFloat(dbTolComp.distribution) || 1.732;
      const distributionLabel =
        errorDistributions.find(
          (d) => d.value === String(dbTolComp.distribution)
        )?.label || "Rectangular";

      const dbNominal = dbMult * Math.log10(nominalValue / dbRef);
      const absoluteHigh = dbRef * Math.pow(10, (dbNominal + highDb) / dbMult);
      const absoluteLow = dbRef * Math.pow(10, (dbNominal + lowDb) / dbMult);
      const centerValue = (absoluteHigh + absoluteLow) / 2;
      const absoluteDeviation = absoluteHigh - centerValue;

      const ppm = convertToPPM(
        absoluteDeviation,
        nominalUnit,
        nominalValue,
        nominalUnit
      );

      if (!isNaN(ppm)) {
        const u_i = Math.abs(ppm / divisor);
        totalLinearTolerance += Math.abs(ppm);
        totalVariance += Math.pow(u_i, 2);
        const specString =
          Math.abs(highDb + lowDb) < 1e-9
            ? `±${highDb} dB`
            : `+${highDb}/${lowDb} dB`;
        breakdown.push({
          name: "dB",
          input: specString,
          explanation: `Calculates to a half-span of ${absoluteDeviation.toExponential(
            3
          )} ${nominalUnit}`,
          ppm: Math.abs(ppm),
          u_i,
          divisor,
          distributionLabel,
          absoluteLow,
          absoluteHigh,
          originalHalfSpan: Math.abs(dbTol),
          originalUnit: "dB",
        });
      }
    }
  }

  if (parseFloat(toleranceObject.measuringResolution) > 0) {
    const res = parseFloat(toleranceObject.measuringResolution);
    const resUnit = toleranceObject.measuringResolutionUnit || nominalUnit;
    const halfSpan = res / 2;

    const resPpm = convertToPPM(halfSpan, resUnit, nominalValue, nominalUnit);
    if (!isNaN(resPpm)) {
      const divisor = 1.732; // sqrt(3)
      const u_i = Math.abs(resPpm / divisor);
      totalVariance += Math.pow(u_i, 2);

      // Resolution has no absolute limits relative to nominal, so we don't add them.
      breakdown.push({
        name: "Resolution",
        input: `±${halfSpan} ${resUnit}`,
        explanation: `Rectangular distribution over ± half the least significant digit.`,
        ppm: Math.abs(resPpm),
        u_i,
        divisor,
        distributionLabel: "Rectangular",
        originalHalfSpan: halfSpan,
        originalUnit: resUnit,
      });
    }
  }

  const standardUncertainty = Math.sqrt(totalVariance);
  return {
    standardUncertainty,
    totalToleranceForTar: totalLinearTolerance,
    breakdown,
  };
};

/**
 * Helper function for the standard normal CDF (phi)
 */
function CumNorm(x) {
  const XAbs = Math.abs(x);
  let Build;
  let Exponential;

  if (XAbs > 37) { // [cite: 5883]
    if (x > 0) {
      return 1.0;
    } else {
      return 0.0;
    }
  } else {
    Exponential = Math.exp(-XAbs * XAbs / 2); // [cite: 5883]
    if (XAbs < 7.07106781186547) { // [cite: 5883]
      Build = 3.52624965998911E-02 * XAbs + 0.700383064443688;
      Build = Build * XAbs + 6.37396220353165;
      Build = Build * XAbs + 33.912866078383;
      Build = Build * XAbs + 112.079291497871;
      Build = Build * XAbs + 221.213596169931;
      Build = Build * XAbs + 220.206867912376;
      let CumNormVal = Exponential * Build; // [cite: 5883]
      
      Build = 8.83883476483184E-02 * XAbs + 1.75566716318264;
      Build = Build * XAbs + 16.064177579207;
      Build = Build * XAbs + 86.7807322029461;
      Build = Build * XAbs + 296.564248779674;
      Build = Build * XAbs + 637.333633378831;
      Build = Build * XAbs + 793.826512519948;
      Build = Build * XAbs + 440.413735824752;
      CumNormVal = CumNormVal / Build; // [cite: 5884]
      
      if (x > 0) {
        return 1 - CumNormVal; // [cite: 5884]
      } else {
        return CumNormVal;
      }
    } else { // [cite: 5884]
      Build = XAbs + 0.65;
      Build = XAbs + 4 / Build;
      Build = XAbs + 3 / Build;
      Build = XAbs + 2 / Build;
      Build = XAbs + 1 / Build;
      let CumNormVal = Exponential / Build / 2.506628274631; // [cite: 5885]
      
      if (x > 0) {
        return 1 - CumNormVal; // [cite: 5884]
      } else {
        return CumNormVal;
      }
    }
  }
}

/**
 * JS  implementation of the Bivariate Normal CDF.
 * This is a JavaScript port of the 'BiVar' (Genz DW2 algorithm)
 */
function bivariateNormalCDF(A, B, r) {
  // Weights and abscissas for 5-point Gauss-Legendre quadrature [cite: 5888, 5894]
  // (VBA arrays are 1-indexed, so we use 0-indexed JS arrays)
  const x_quad = [ 0.04691008, 0.23076534, 0.5, 0.76923466, 0.95308992 ];
  const w_quad = [ 0.018854042, 0.038088059, 0.0452707394, 0.038088059, 0.018854042 ];

  let h1 = A;
  let h2 = B;
  let h12 = (h1 * h1 + h2 * h2) / 2.0;
  let LH = 0.0; // 

  if (Math.abs(r) < 0.7) { // [cite: 5897]
    let h3 = h1 * h2;
    if (r !== 0) {
      for (let i = 0; i < 5; i++) {
        let r1 = r * x_quad[i];
        let r2 = 1 - r1 * r1;
        LH = LH + w_quad[i] * Math.exp((r1 * h3 - h12) / r2) / Math.sqrt(r2); // [cite: 5892]
      }
    }
    return CumNorm(h1) * CumNorm(h2) + r * LH; // [cite: 5897]
    
  } else { // 
    let r2 = 1 - r * r;
    let r3 = Math.sqrt(r2);
    if (r < 0) {
      h2 = -h2; // 
    }
    let h3 = h1 * h2;
    let h7 = Math.exp(-h3 / 2.0); // 
    
    if (Math.abs(r) < 1) { // 
      let h6 = Math.abs(h1 - h2);
      let h5 = h6 * h6 / 2.0; // [cite: 5895]
      h6 = h6 / r3;
      let AA = 0.5 - h3 / 8.0;
      let ab = 3 - 2 * AA * h5;
      LH = 0.13298076 * h6 * ab * (1 - CumNorm(h6)) - Math.exp(-h5 / r2) * (ab + AA * r2) * 0.053051647; // [cite: 5895-5896]
      
      for (let i = 0; i < 5; i++) {
        let r1 = r3 * x_quad[i];
        let rr = r1 * r1;
        let r2_inner = Math.sqrt(1 - rr);
        LH = LH - w_quad[i] * Math.exp(-h5 / rr) * (Math.exp(-h3 / (1 + r2_inner)) / r2_inner / h7 - 1 - AA * rr); // [cite: 5896]
      }
    }
    
    let BiVar = LH * r3 * h7 + CumNorm(Math.min(h1, h2)); // [cite: 5896, 5898]
    if (r < 0) {
      BiVar = CumNorm(h1) - BiVar; // [cite: 5896]
    }
    return BiVar;
  }
}

const T_DISTRIBUTION_95 = {
  1: 12.71,
  2: 4.3,
  3: 3.18,
  4: 2.78,
  5: 2.57,
  6: 2.45,
  7: 2.36,
  8: 2.31,
  9: 2.26,
  10: 2.23,
  15: 2.13,
  20: 2.09,
  25: 2.06,
  30: 2.04,
  40: 2.02,
  50: 2.01,
  60: 2.0,
  100: 1.98,
  120: 1.98,
};

function getKValueFromTDistribution(dof) {
  if (dof === Infinity || dof > 120) return 1.96;
  const roundedDof = Math.round(dof);
  if (T_DISTRIBUTION_95[roundedDof]) {
    return T_DISTRIBUTION_95[roundedDof];
  }
  const lowerKeys = Object.keys(T_DISTRIBUTION_95)
    .map(Number)
    .filter((k) => k < roundedDof);
  const upperKeys = Object.keys(T_DISTRIBUTION_95)
    .map(Number)
    .filter((k) => k > roundedDof);
  if (lowerKeys.length === 0) return T_DISTRIBUTION_95[Math.min(...upperKeys)];
  if (upperKeys.length === 0) return T_DISTRIBUTION_95[Math.max(...lowerKeys)];
  const lowerBound = Math.max(...lowerKeys);
  const upperBound = Math.min(...upperKeys);
  const kLower = T_DISTRIBUTION_95[lowerBound];
  const kUpper = T_DISTRIBUTION_95[upperBound];
  return (
    kLower +
    ((roundedDof - lowerBound) * (kUpper - kLower)) / (upperBound - lowerBound)
  );
}

const convertToPPM = (
  value,
  unit,
  nominalValue,
  nominalUnit,
  fallbackReferenceValue = null, // Added fallback for when nominal is 0
  getExplanation = false
) => {
  const parsedValue = parseFloat(value);
  let parsedNominal = parseFloat(nominalValue);

  if (isNaN(parsedValue)) return getExplanation ? { value: NaN } : NaN;
  if (unit === "ppm")
    return getExplanation ? { value: parsedValue } : parsedValue;

  // Use fallback if nominal is 0 and a fallback is provided
  if (parsedNominal === 0 && fallbackReferenceValue) {
    parsedNominal = parseFloat(fallbackReferenceValue);
  }

  const nominalQuantity = unitSystem.getQuantity(nominalUnit);
  const valueQuantity = unitSystem.getQuantity(unit);

  if (!nominalQuantity)
    return getExplanation
      ? {
          value: NaN,
          warning: `Unknown quantity for nominal unit '${nominalUnit}'.`,
        }
      : NaN;

  let valueInBase;
  if (unit === "%") {
    valueInBase =
      (parsedValue / 100) * unitSystem.toBaseUnit(parsedNominal, nominalUnit);
  } else if (
    valueQuantity &&
    (valueQuantity === nominalQuantity || valueQuantity === "Relative")
  ) {
    valueInBase = unitSystem.toBaseUnit(parsedValue, unit);
  } else if (
    valueQuantity &&
    nominalQuantity &&
    valueQuantity !== nominalQuantity
  ) {
    return getExplanation
      ? {
          value: NaN,
          warning: `Unit mismatch: Cannot convert ${unit} (${valueQuantity}) to ${nominalUnit} (${nominalQuantity}).`,
        }
      : NaN;
  } else {
    valueInBase = unitSystem.toBaseUnit(parsedValue, unit);
  }

  if (isNaN(valueInBase))
    return getExplanation
      ? { value: NaN, warning: `Unsupported unit conversion for '${unit}'.` }
      : NaN;

  const nominalInBase = unitSystem.toBaseUnit(parsedNominal, nominalUnit);
  if (isNaN(nominalInBase) || nominalInBase === 0)
    return getExplanation ? { value: NaN } : NaN;

  const ppmValue = (valueInBase / Math.abs(nominalInBase)) * 1e6;

  if (getExplanation) {
    const explanation = `((${valueInBase.toExponential(4)}) / ${Math.abs(
      nominalInBase
    ).toExponential(4)}) × 1,000,000 = ${ppmValue.toFixed(2)} ppm`;
    return { value: ppmValue, explanation };
  }

  return ppmValue;
};
const ThemeContext = React.createContext(false);
export const useTheme = () => React.useContext(ThemeContext);
export const Accordion = ({
  title,
  children,
  startOpen = false,
  actions = null,
}) => {
  const [isOpen, setIsOpen] = useState(startOpen);
  return (
    <div className="accordion-card">
      <div className="accordion-header" onClick={() => setIsOpen(!isOpen)}>
        <h4>{title}</h4>
        <div className="accordion-actions">
          {actions}
          <span className={`accordion-icon ${isOpen ? "open" : ""}`}>
            &#9660;
          </span>
        </div>
      </div>
      {isOpen && <div className="accordion-content">{children}</div>}
    </div>
  );
};

export const NotificationModal = ({ isOpen, onClose, title, message }) => {
  if (!isOpen) return null;
  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 2000 }}
    >
      <div className="modal-content">
        <button onClick={onClose} className="modal-close-button">
          &times;
        </button>
        <h3>{title}</h3>
        <p style={{ textAlign: "left", whiteSpace: "pre-wrap" }}>{message}</p>
        <div className="modal-actions" style={{ justifyContent: "center" }}>
          <button className="button" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

const ConversionInfo = ({ value, unit, nominal }) => {
  const { explanation, warning } = useMemo(() => {
    if (
      !value ||
      !unit ||
      unit === "ppm" ||
      !nominal ||
      !nominal.value ||
      !nominal.unit
    ) {
      return { explanation: null, warning: null };
    }
    return convertToPPM(value, unit, nominal.value, nominal.unit, true);
  }, [value, unit, nominal]);

  if (warning) {
    return <div className="conversion-warning">⚠️ {warning}</div>;
  }

  if (explanation) {
    return <div className="conversion-info">↳ {explanation}</div>;
  }

  return null;
};

const UncertaintyBudgetTable = ({
  components,
  onRemove,
  calcResults,
  referencePoint,
  uncertaintyConfidence,
  onRowContextMenu,
  equationString,
  measurementType,
  riskResults,
  onShowDerivedBreakdown,
  onShowRiskBreakdown,
}) => {
  const confidencePercent = parseFloat(uncertaintyConfidence) || 95;
  const derivedUnit = referencePoint?.unit || "Units";
  const derivedName = referencePoint?.name || "Derived";

  const isDirect = measurementType === "direct";
  const headerColSpan = isDirect ? 6 : 8;
  const finalColSpan = isDirect ? 3 : 5;

  const [showGuardband, setShowGuardband] = useState(false);

  const getPfaClass = (pfa) => {
    if (pfa > 5) return "status-bad";
    if (pfa > 2) return "status-warning";
    return "status-good";
  };

  const derivedSymbol = useMemo(() => {
    if (measurementType !== "derived" || !equationString) {
      return null;
    }
    const eqParts = equationString.split("=");
    if (eqParts.length > 1) {
      return eqParts[0].trim();
    }
    return null;
  }, [equationString, measurementType]);

  const derivedDisplayName = useMemo(() => {
    if (derivedSymbol) {
      return `${derivedName} (${derivedSymbol})`;
    }
    return derivedName;
  }, [derivedName, derivedSymbol]);

  let combinedUncertaintyInDerivedUnit = NaN;
  let expandedUncertaintyInDerivedUnit = NaN;
  const targetUnitInfo = unitSystem.units[derivedUnit];

  if (calcResults && targetUnitInfo?.to_si) {
    if (!isNaN(calcResults.combined_uncertainty_absolute_base)) {
      combinedUncertaintyInDerivedUnit =
        calcResults.combined_uncertainty_absolute_base / targetUnitInfo.to_si;
    }
    if (!isNaN(calcResults.expanded_uncertainty_absolute_base)) {
      expandedUncertaintyInDerivedUnit =
        calcResults.expanded_uncertainty_absolute_base / targetUnitInfo.to_si;
    }
  } else if (calcResults && derivedUnit === "ppm") {
    combinedUncertaintyInDerivedUnit = calcResults.combined_uncertainty;
    expandedUncertaintyInDerivedUnit = calcResults.expanded_uncertainty;
  }

  const inputComponents = components.filter((c) => c.name.startsWith("Input:"));
  const directComponents = components.filter(
    (c) => !c.name.startsWith("Input:")
  );
  const showDerivedInputs =
    inputComponents.length > 0 &&
    calcResults?.combined_uncertainty_inputs_native !== undefined;

  const renderComponentRows = (filteredComponents) => {
    if (filteredComponents.length === 0) return null;

    return (
      <>
        {filteredComponents.map((c) => {
          let formattedValueUi = "N/A";
          let displayValueUnitUi = "";
          let formattedContribution = "N/A";
          let displayContributionUnit = derivedUnit;
          const quantity = c.quantity || 1;
          const displayName = quantity > 1 ? `${c.name} (Qty: ${quantity})` : c.name;

          if (c.value_native !== undefined && c.unit_native) {
            formattedValueUi = c.value_native.toPrecision(4);
            displayValueUnitUi = c.unit_native;
          } else if (c.isBaseUnitValue && !isNaN(c.value) && c.unit) {
            const inputUnitInfo = unitSystem.units[c.unit];
            if (inputUnitInfo?.to_si) {
              const valueInOriginalUnit = c.value / inputUnitInfo.to_si;
              formattedValueUi = valueInOriginalUnit.toPrecision(4);
              displayValueUnitUi = c.unit;
            } else {
              formattedValueUi = "Conv Err";
            }
          } else if (!c.isBaseUnitValue && !isNaN(c.value)) {
            formattedValueUi = c.value.toPrecision(4);
            displayValueUnitUi = "ppm";
          }

          const formattedCi =
            typeof c.sensitivityCoefficient === "number"
              ? c.sensitivityCoefficient.toPrecision(4)
              : c.sensitivityCoefficient
              ? String(c.sensitivityCoefficient)
              : "N/A";

          if (typeof c.contribution === "number" && !isNaN(c.contribution)) {
            formattedContribution = c.contribution.toPrecision(4);

            if (isDirect) {
              displayContributionUnit = displayValueUnitUi;
            }
          }

          return (
            <tr
              key={c.id}
              onContextMenu={(e) => {
                if (onRowContextMenu) {
                  onRowContextMenu(e, c);
                }
              }}
            >
              <td>{displayName}</td>
              <td>{c.sourcePointLabel || "N/A"}</td>
              <td>{c.type}</td>
              <td>
                {formattedValueUi} {displayValueUnitUi}
              </td>

              {!isDirect && <td>{formattedCi}</td>}
              {!isDirect && (
                <td>
                  {formattedContribution} {displayContributionUnit}
                </td>
              )}

              <td>{c.distribution}</td>

              <td className="action-cell">
                {!c.isCore && (
                  <span
                    onClick={() => onRemove(c.id)}
                    className="delete-action"
                    title="Remove Component"
                  >
                    ×
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </>
    );
  };

  return (
    <table className="uncertainty-budget-table">
      <thead>
        <tr>
          <th>Uncertainty Component</th>
          <th>Source / Nominal</th>
          <th>Type</th>
          <th>uᵢ</th>

          {!isDirect && <th>Sens. Coeff (cᵢ)</th>}
          {!isDirect && (
            <th>
              <Latex>{"Contribution ($|c_i \\times u_i|$)"}</Latex>
            </th>
          )}

          <th>Distribution</th>

          <th style={{ width: "60px" }}></th>
        </tr>
      </thead>

      {showDerivedInputs && (
        <tbody className="component-group-tbody informational-group">
          <tr className="category-header">
            <td colSpan={headerColSpan}>Input Variables (Informational)</td>
          </tr>
          {renderComponentRows(inputComponents)}
        </tbody>
      )}

      <tbody className="component-group-tbody">
        {showDerivedInputs ? (
          <tr className="category-header">
            <td colSpan={headerColSpan}>
              Direct Uncertainty Components (Final Budget)
            </td>
          </tr>
        ) : (
          <tr className="category-header">
          </tr>
        )}

        {showDerivedInputs && (
          <tr className="propagated-unc-row" key="propagated_unc">
            <td>{`Derived: ${derivedDisplayName}`}</td>
            <td>(From Inputs)</td>
            <td>B</td>
            <td>
              {calcResults.combined_uncertainty_inputs_native.toPrecision(4)}{" "}
              {derivedUnit}
            </td>

            {!isDirect && <td>1.000</td>}
            {!isDirect && (
              <td>
                {calcResults.combined_uncertainty_inputs_native.toPrecision(4)}{" "}
                {derivedUnit}
              </td>
            )}

            <td>Calculated</td>

            <td className="action-cell">
              <span
                onClick={onShowDerivedBreakdown}
                className="action-icon"
                title="View Calculation Breakdown"
                style={{ cursor: "pointer", color: "var(--primary-color)" }}
              >
                <FontAwesomeIcon icon={faCalculator} />
              </span>
            </td>
          </tr>
        )}

        {renderComponentRows(showDerivedInputs ? directComponents : components)}
      </tbody>

      <tfoot>
        <tr>
          <td colSpan={finalColSpan}>{"Combined Standard Uncertainty (uₑ)"}</td>
          <td>
            {!isNaN(combinedUncertaintyInDerivedUnit)
              ? `${combinedUncertaintyInDerivedUnit.toPrecision(
                  4
                )} ${derivedUnit}`
              : "N/A"}
          </td>
          <td colSpan="2"></td>
        </tr>
        {calcResults && (
          <>
            <tr className="final-uncertainty-row">
              <td colSpan={headerColSpan}>
                <div className="final-result-display">
                  <span className="final-result-label">
                    Expanded Uncertainty (U)
                  </span>
                  <div className="final-result-value">
                    ±{" "}
                    {!isNaN(expandedUncertaintyInDerivedUnit)
                      ? expandedUncertaintyInDerivedUnit.toPrecision(5)
                      : "N/A"}
                    <span className="final-result-unit">{derivedUnit}</span>
                  </div>
                  <span className="final-result-confidence-note">
                    The reported expanded uncertainty... k≈
                    {calcResults.k_value.toFixed(3)}... {confidencePercent}%.
                  </span>
                  <div>
                    <input
                      type="checkbox"
                      checked={showGuardband}
                      onChange={(e) => setShowGuardband(e.target.checked)}
                    />
                    <label>Show Guardband</label>
                  </div>
                  {riskResults && (
                    <div className="budget-risk-metrics">
                      <div
                        className={`metric-pod ${getPfaClass(
                          riskResults.pfa
                        )} clickable`}
                        onClick={() =>
                          onShowRiskBreakdown && onShowRiskBreakdown("pfa")
                        }
                        title="Show PFA Breakdown"
                      >
                        <span className="metric-pod-label">PFA</span>
                        <span className="metric-pod-value">
                          {riskResults.pfa.toFixed(4)} %
                        </span>
                      </div>
                      <div
                        className="metric-pod pfr clickable"
                        onClick={() =>
                          onShowRiskBreakdown && onShowRiskBreakdown("pfr")
                        }
                        title="Show PFR Breakdown"
                      >
                        <span className="metric-pod-label">PFR</span>
                        <span className="metric-pod-value">
                          {riskResults.pfr.toFixed(4)} %
                        </span>
                      </div>
                      <div
                        className="metric-pod tur clickable"
                        onClick={() =>
                          onShowRiskBreakdown && onShowRiskBreakdown("tur")
                        }
                        title="Show TUR Breakdown"
                      >
                        <span className="metric-pod-label">TUR</span>
                        <span className="metric-pod-value">
                          {riskResults.tur.toFixed(2)} : 1
                        </span>
                      </div>
                      {isDirect && (
                        <div
                          className="metric-pod tar clickable"
                          onClick={() =>
                            onShowRiskBreakdown && onShowRiskBreakdown("tar")
                          }
                          title="Show TAR Breakdown"
                        >
                          <span className="metric-pod-label">TAR</span>
                          <span className="metric-pod-value">
                            {riskResults.tar.toFixed(2)} : 1
                          </span>
                        </div>
                      )}
                      {showGuardband && (<>
                      <div className="metric-pod gblow">
                        <span className="metric-pod-label">GB LOW</span>
                        <span className="metric-pod-value">
                          {riskResults.gbResults.GBLOW.toFixed(4)}
                        </span>
                      </div>
                      <div className="metric-pod gbhigh">
                        <span className="metric-pod-label">GB HIGH</span>
                        <span className="metric-pod-value">
                          {riskResults.gbResults.GBUP.toFixed(4)}
                        </span>
                      </div>
                      <div className="metric-pod gbpfa">
                        <span className="metric-pod-label">PFA w/ GB</span>
                        <span className="metric-pod-value">
                          {riskResults.gbResults.GBPFA.toFixed(4)} %
                        </span>
                      </div>
                      <div className="metric-pod gbpfr">
                        <span className="metric-pod-label">PFR w/ GB</span>
                        <span className="metric-pod-value">
                          {riskResults.gbResults.GBPFR.toFixed(4)} %
                        </span>
                      </div>
                      <div className="metric-pod gbmult">
                        <span className="metric-pod-label">GB Multiplier</span>
                        <span className="metric-pod-value">
                          {riskResults.gbResults.GBMULT.toFixed(4)} %
                        </span>
                      </div>
                      <div className="metric-pod gbcalint">
                        <span className="metric-pod-label">CAL INT w/ GB</span>
                        <span className="metric-pod-value">
                          {riskResults.gbResults.GBCALINT.toFixed(4)}
                        </span>
                      </div>
                      <div className="metric-pod calint">
                        <span className="metric-pod-label">CAL INT w/o GB</span>
                        <span className="metric-pod-value">
                          {riskResults.gbResults.NOGBCALINT.toFixed(4)}
                        </span>
                      </div>
                      <div className="metric-pod measrel">
                        <span className="metric-pod-label">MEAS REL w/o GB</span>
                        <span className="metric-pod-value">
                          {riskResults.gbResults.NOGBMEASREL.toFixed(4)} %
                        </span>
                      </div>
                      </>
                      )}
                      
                    </div>
                  )}
                </div>
              </td>
            </tr>
          </>
        )}
      </tfoot>
    </table>
  );
};

const InputsBreakdownModal = ({ results, inputs, onClose }) => {
  const mid = (inputs.LUp + inputs.LLow) / 2;
  const LUp_symmetric = Math.abs(inputs.LUp - mid);
  const safeNativeUnit = results.nativeUnit === "%" ? "\\%" : (results.nativeUnit || "units");
  const zScore = (results.uDev > 0) ? (LUp_symmetric / results.uDev) : 0;
  const reliability = parseFloat(inputs.reliability);
  const p_cumulative = (1 + reliability) / 2;

  return (
    <div className="modal-overlay">
      <div className="modal-content breakdown-modal-content">
        <button onClick={onClose} className="modal-close-button">
          &times;
        </button>
        
        <h3>Key Inputs Breakdown</h3>

        <div className="modal-body-scrollable">

        <div className="breakdown-step">
          <h5>
            Cal Process Error (u<sub>combined</sub>)
          </h5>
          <p>
            This value is the Combined Standard Uncertainty, calculated
            from the detailed budget.
          </p>
          <Latex>
            {`$$ u_{combined} = \\mathbf{${results.uCal.toPrecision(6)}} \\text{ ${safeNativeUnit}} $$`}
          </Latex>
        </div>

        <div className="breakdown-step">
          <h5>
            Observed (measured) UUT Error (&sigma;<sub>observed</sub>)
          </h5>
          <p>
            This value is calculated using the EOP reliability (REOP) and the
            Inverse Normal Distribution Function to determine a Z-Score. The
            Z-score (number of standard deviations) is found using the Inverse
            Normal CDF (`Φ⁻¹`, or `probit`) on the cumulative probability `p` (our REOP percentage).
          </p>
          <Latex>
            {`$$ p = (1 + R) / 2 = (1 + ${reliability}) / 2 = \\mathbf{${p_cumulative.toFixed(4)}} $$`}
          </Latex>
          <Latex>
            {`$$ Z_{\\text{score}} = \\Phi^{-1}(p) = \\Phi^{-1}(${p_cumulative.toFixed(4)}) = \\mathbf{${zScore.toPrecision(4)}} $$`}
          </Latex>
          <Latex>
            {`$$ \\sigma_{observed} = \\frac{L_{Upper}}{\\Phi^{-1}((1+R)/2)} = \\frac{${LUp_symmetric.toPrecision(6)}}{\\Phi^{-1}((1+${inputs.reliability})/2)} = \\mathbf{${results.uDev.toPrecision(6)}} \\text{ ${safeNativeUnit}} $$`}
          </Latex>
        </div>

        <div className="breakdown-step">
          <h5>
            UUT True Error (&sigma;<sub>uut</sub>)
          </h5>
          <p>
            The intrinsic error of the UUT, calculated by removing the
            calibration process uncertainty from the observed error.
          </p>
          <Latex>
            {`$$ \\sigma_{uut} = \\sqrt{\\sigma_{observed}^2 - u_{combined}^2} = \\sqrt{${results.uDev.toPrecision(6)}^2 - ${results.uCal.toPrecision(6)}^2} = \\mathbf{${results.uUUT.toPrecision(6)}} \\text{ ${safeNativeUnit}} $$`}
          </Latex>
        </div>
        
        <div className="breakdown-step">
          <h5>UUT Tolerance Limits (L)</h5>
          <p>
            The specified tolerance limits for the Unit Under Test (UUT).
          </p>
          <Latex>
            {`$$ L_{Low} = \\mathbf{${parseFloat(inputs.LLow).toPrecision(6)}} \\text{ ${safeNativeUnit}} $$`}
          </Latex>
          <Latex>
            {`$$ L_{Up} = \\mathbf{${parseFloat(inputs.LUp).toPrecision(6)}} \\text{ ${safeNativeUnit}} $$`}
          </Latex>
        </div>

        <div className="breakdown-step">
          <h5>Acceptance Limits (A)</h5>
          <p>
            Calculated by applying the Guard Band Multiplier to the
            tolerance limits.
          </p>
          <Latex>
            {`$$ A_{Low} = L_{Low} \\times G = ${parseFloat(inputs.LLow).toPrecision(6)} \\times ${inputs.guardBandMultiplier} = \\mathbf{${results.ALow.toPrecision(6)}} \\text{ ${safeNativeUnit}} $$`}
          </Latex>
          <Latex>
            {`$$ A_{Up} = L_{Up} \\times G = ${parseFloat(inputs.LUp).toPrecision(6)} \\times ${inputs.guardBandMultiplier} = \\mathbf{${results.AUp.toPrecision(6)}} \\text{ ${safeNativeUnit}} $$`}
          </Latex>
        </div>

        <div className="breakdown-step">
          <h5>Correlation (ρ)</h5>
          <p>
            The statistical correlation between the UUT's true error value and the
            observed (measured) value.
          </p>
          <Latex>
            {`$$ \\rho = \\frac{\\sigma_{UUT}}{\\sigma_{observed}} = \\frac{${results.uUUT.toPrecision(6)}}{${results.uDev.toPrecision(6)}} = \\mathbf{${results.correlation.toPrecision(6)}} $$`}
          </Latex>
        </div>
        
        </div>
        
      </div>
    </div>
  );
};

const TurBreakdownModal = ({ results, inputs, onClose }) => {
  if (!results || !inputs) return null;

  const safeNativeUnit = results.nativeUnit === "%" ? "\\%" : (results.nativeUnit || "units");
  const uutToleranceSpan = inputs.LUp - inputs.LLow;
  const expandedUncertaintySpan = results.expandedUncertainty * 2;

  return (
    <div className="modal-overlay">
      <div className="modal-content breakdown-modal-content">
        <button onClick={onClose} className="modal-close-button">
          &times;
        </button>
        <h3>TUR Calculation Breakdown</h3>
        <div className="breakdown-step">
          <h5>Step 1: Formula</h5>
          <p>
            The Test Uncertainty Ratio (TUR) is the ratio of the tolerance span
            to the expanded measurement uncertainty span.
          </p>
          <Latex>
            {
              "$$ TUR = \\frac{\\text{UUT Tolerance Span}}{\\text{Expanded Measurement Uncertainty Span}} = \\frac{2L}{2U} $$"
            }
          </Latex>
        </div>
        <div className="breakdown-step">
          <h5>Step 2: Inputs</h5>
          <ul>
            <li>
              Tolerance Span (2L):{" "}
              <Latex>{`$$ L_{Upper} - L_{Lower} = ${inputs.LUp.toPrecision(
                6
              )} - (${inputs.LLow.toPrecision(
                6
              )}) = ${uutToleranceSpan.toPrecision(
                4
              )} \\text{ ${safeNativeUnit}} $$`}</Latex>
            </li>
            <li>
              Expanded Uncertainty Span (2U):{" "}
              <Latex>{`$$ 2 \\times U_{95} = 2 \\times ${results.expandedUncertainty.toPrecision(
                4
              )} = \\mathbf{${expandedUncertaintySpan.toPrecision(
                4
              )}} \\text{ ${safeNativeUnit}} $$`}</Latex>
            </li>
          </ul>
        </div>
        <div className="breakdown-step">
          <h5>Step 3: Final Calculation</h5>
          <Latex>{`$$ TUR = \\frac{${uutToleranceSpan.toPrecision(
            4
          )}}{${expandedUncertaintySpan.toPrecision(
            4
          )}} = \\mathbf{${results.tur.toFixed(4)}:1} $$`}</Latex>
        </div>
      </div>
    </div>
  );
};

const TarBreakdownModal = ({ results, inputs, onClose }) => {
  if (!results || !inputs) return null;

  const uutToleranceHigh = inputs.LUp;
  const uutToleranceLow = inputs.LLow;
  const uutToleranceSpan = uutToleranceHigh - uutToleranceLow;
  const uutNominalMid = (uutToleranceHigh + uutToleranceLow) / 2;

  const tmdeToleranceHighDev = results.tmdeToleranceHigh || 0;
  const tmdeToleranceLowDev = results.tmdeToleranceLow || 0;

  const tmdeToleranceHigh_Absolute = uutNominalMid + tmdeToleranceHighDev;
  const tmdeToleranceLow_Absolute = uutNominalMid + tmdeToleranceLowDev;

  const tmdeToleranceSpan = results.tmdeToleranceSpan;

  const uutBreakdown = results.uutBreakdownForTar || [];
  const tmdeBreakdown = results.tmdeBreakdownForTar || [];

  const safeNativeUnit =
    results.nativeUnit === "%" ? "\\%" : results.nativeUnit || "units";

  const uutSumString =
    uutBreakdown.length > 0
      ? uutBreakdown.map((comp) => comp.span.toPrecision(4)).join(" + ")
      : "0";
  const tmdeSumString =
    tmdeBreakdown.length > 0
      ? tmdeBreakdown.map((comp) => comp.span.toPrecision(4)).join(" + ")
      : "0";

  return (
    <div className="modal-overlay">
      <div className="modal-content breakdown-modal-content">
        <button onClick={onClose} className="modal-close-button">
          &times;
        </button>
        <h3>TAR Calculation Breakdown</h3>
        <div className="breakdown-step">
          <h5>Step 1: Formula</h5>
          <p>
            The Test Accuracy Ratio (TAR) is the ratio of the UUT's tolerance
            span to the TMDE's (Standard's) tolerance span.
          </p>
          <Latex>
            {
              "$$ TAR = \\frac{\\text{(UUT Tolerance High)} - \\text{(UUT Tolerance Low)}}{\\text{(TMDE Tolerance High)} - \\text{(TMDE Tolerance Low)}} $$"
            }
          </Latex>
        </div>
        <div className="breakdown-step">
          <h5>Step 2: Inputs</h5>
          <ul>
            <li>
              UUT Tolerance Span (Absolute Limits):
              <Latex>{`$$ (L_{Up}) - (L_{Low}) = ${uutToleranceHigh.toPrecision(
                6
              )} - (${uutToleranceLow.toPrecision(6)}) $$`}</Latex>
              {uutBreakdown.length > 0 ? (
                <ul
                  className="result-breakdown"
                  style={{
                    paddingLeft: "20px",
                    fontSize: "0.9rem",
                    margin: "5px 0",
                  }}
                >
                  {uutBreakdown.map((comp, index) => (
                    <li
                      key={index}
                      style={{ border: "none", padding: "2px 0" }}
                    >
                      <span className="label">{comp.name}</span>
                      <span className="value">
                        {comp.span.toPrecision(4)} {safeNativeUnit}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <em style={{ display: "block", margin: "5px 0" }}>
                  (No UUT tolerance components found)
                </em>
              )}
              <Latex>{`$$ \\text{Total Span} = ${uutSumString} = \\mathbf{${uutToleranceSpan.toPrecision(
                4
              )}} \\text{ ${safeNativeUnit}} $$`}</Latex>
            </li>

            <li>
              TMDE Tolerance Span (Absolute Limits):
              <Latex>{`$$ (L_{Up}) - (L_{Low}) = ${tmdeToleranceHigh_Absolute.toPrecision(
                6
              )} - (${tmdeToleranceLow_Absolute.toPrecision(6)}) $$`}</Latex>
              {tmdeBreakdown.length > 0 ? (
                <ul
                  className="result-breakdown"
                  style={{
                    paddingLeft: "20px",
                    fontSize: "0.9rem",
                    margin: "5px 0",
                  }}
                >
                  {tmdeBreakdown.map((comp, index) => (
                    <li
                      key={index}
                      style={{ border: "none", padding: "2px 0" }}
                    >
                      <span className="label">{comp.name}</span>
                      <span className="value">
                        {comp.span.toPrecision(4)} {safeNativeUnit}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <em style={{ display: "block", margin: "5px 0" }}>
                  (No TMDE tolerances found)
                </em>
              )}
              <Latex>{`$$ \\text{Total Span} = ${tmdeSumString} = \\mathbf{${tmdeToleranceSpan.toPrecision(
                4
              )}} \\text{ ${safeNativeUnit}} $$`}</Latex>
            </li>
          </ul>
        </div>
        <div className="breakdown-step">
          <h5>Step 3: Final Calculation</h5>
          <Latex>{`$$ TAR = \\frac{${uutToleranceSpan.toPrecision(
            4
          )}}{${tmdeToleranceSpan.toPrecision(
            4
          )}} = \\mathbf{${results.tar.toFixed(4)}:1} $$`}</Latex>
        </div>
      </div>
    </div>
  );
};

const PfaBreakdownModal = ({ results, inputs, onClose }) => {
  if (!results || !inputs) return null;

  // --- Re-calculate values for demonstration ---
  const mid = (inputs.LUp + inputs.LLow) / 2;
  const LLow_norm = inputs.LLow - mid;
  const LUp_norm = inputs.LUp - mid;
  const ALow_norm = results.ALow - mid;
  const AUp_norm = results.AUp - mid;

  // Z-Scores (Normalized Limits)
  const z_x_low = LLow_norm / results.uUUT;
  const z_x_high = LUp_norm / results.uUUT; // The "true" positive Z-score for LUp
  const z_y_low = ALow_norm / results.uDev;
  const z_y_high = AUp_norm / results.uDev;

  // Safe unit for LaTeX
  const safeNativeUnit =
    results.nativeUnit === "%" ? "\\%" : results.nativeUnit || "units";

  return (
    <div className="modal-overlay">
      <div className="modal-content breakdown-modal-content">
        <button onClick={onClose} className="modal-close-button">
          &times;
        </button>
        <h3>PFA Calculation Breakdown</h3>
        <div className="modal-body-scrollable">
          <div className="breakdown-step">
            <h5>Step 1: Formula</h5>
            <p>
              The Probability of False Accept (PFA) is the sum of the
              probabilities in the two "False Accept" regions of the risk
              scatterplot. This is calculated using the Bivariate
              Normal Cumulative Distribution Function (Φ₂).
            </p>
            <Latex>{"$$ PFA = PFA_{Lower} + PFA_{Upper} $$"}</Latex>
          </div>
          <div className="breakdown-step">
            <h5>Step 2: Key Statistical Inputs</h5>
            <p>
              These values are derived from your budget and reliability settings.
            </p>
            <ul>
              <li>
                True UUT Error (σ
                <sub>uut</sub>):{" "}
                <strong>
                  {results.uUUT.toPrecision(4)} {safeNativeUnit}
                </strong>
                <Latex>{`$$ \\sigma_{uut} = \\sqrt{\\sigma_{observed}^2 - u_{combined}^2} $$`}</Latex>
              </li>
              <li>
                Observed Error (σ
                <sub>obs</sub>):{" "}
                <strong>
                  {results.uDev.toPrecision(4)} {safeNativeUnit}
                </strong>
                <Latex>{`$$ \\sigma_{observed} = \\frac{L_{Upper}}{\\Phi^{-1}((1+R)/2)} $$`}</Latex>
              </li>
              <li>
                Correlation (ρ):{" "}
                <Latex>{`$$ \\rho = \\frac{\\sigma_{uut}}{\\sigma_{obs}} = \\frac{${results.uUUT.toPrecision(
                  4
                )}}{${results.uDev.toPrecision(
                  4
                )}} = \\mathbf{${results.correlation.toFixed(4)}} $$`}</Latex>
              </li>
            </ul>
          </div>
          <div className="breakdown-step">
            <h5>Step 3: Normalized Limits (Z-Scores)</h5>
            <p>
              The limits are normalized by their respective standard deviations.
              (L = UUT Tolerance, A = Acceptance Limit)
            </p>
            <ul>
              <li>
                z<sub>x_low</sub> (True Error):{" "}
                <Latex>{`$$ \\frac{L_{Low}}{\\sigma_{uut}} = \\frac{${LLow_norm.toPrecision(
                  4
                )}}{${results.uUUT.toPrecision(4)}} = \\mathbf{${z_x_low.toFixed(
                  4
                )}} $$`}</Latex>
              </li>
              <li>
                z<sub>x_high</sub> (True Error):{" "}
                <Latex>{`$$ \\frac{L_{Up}}{\\sigma_{uut}} = \\frac{${LUp_norm.toPrecision(
                  4
                )}}{${results.uUUT.toPrecision(4)}} = \\mathbf{${z_x_high.toFixed(
                  4
                )}} $$`}</Latex>
              </li>
              <li>
                z<sub>y_low</sub> (Measured Error):{" "}
                <Latex>{`$$ \\frac{A_{Low}}{\\sigma_{obs}} = \\frac{${ALow_norm.toPrecision(
                  4
                )}}{${results.uDev.toPrecision(4)}} = \\mathbf{${z_y_low.toFixed(
                  4
                )}} $$`}</Latex>
              </li>
              <li>
                z<sub>y_high</sub> (Measured Error):{" "}
                <Latex>{`$$ \\frac{A_{Up}}{\\sigma_{obs}} = \\frac{${AUp_norm.toPrecision(
                  4
                )}}{${results.uDev.toPrecision(4)}} = \\mathbf{${z_y_high.toFixed(
                  4
                )}} $$`}</Latex>
              </li>
            </ul>
          </div>
          <div className="breakdown-step">
            <h5>Step 4: Bivariate Calculation</h5>
            <p>
              The probability for each tail (region) is calculated separately.
            </p>
            <p>
              <strong>Lower Tail Risk (PFA_Lower):</strong>
            </p>
            <Latex>
              {
                "$$ P(z_x < z_{x\\_low} \\text{ and } z_{y\\_low} < z_y < z_{y\\_high}) $$"
              }
            </Latex>
            <Latex>{`$$ = \\Phi_2(z_{x\\_low}, z_{y\\_high}, \\rho) - \\Phi_2(z_{x\\_low}, z_{y\\_low}, \\rho) $$`}</Latex>
            <Latex>{`$$ = \\Phi_2(${z_x_low.toFixed(
              2
            )}, ${z_y_high.toFixed(2)}, ${results.correlation.toFixed(
              2
            )}) - \\Phi_2(${z_x_low.toFixed(2)}, ${z_y_low.toFixed(
              2
            )}, ${results.correlation.toFixed(2)}) $$`}</Latex>
            <Latex>{`$$ = \\mathbf{${(results.pfa_term1 / 100).toExponential(
              4
            )}} $$`}</Latex>
            <p>
              <strong>Upper Tail Risk (PFA_Upper):</strong>
            </p>
            <Latex>
              {
                "$$ P(z_x > z_{x\\_high} \\text{ and } z_{y\\_low} < z_y < z_{y\\_high}) $$"
              }
            </Latex>
            <p>
              Calculated using symmetry:{" "}
              <Latex>{`$$ = P(z_x < -z_{x\\_high} \\text{ and } -z_{y\\_high} < z_y < -z_{y\\_low}) $$`}</Latex>
            </p>
            <Latex>{`$$ = \\Phi_2(-z_{x\\_high}, -z_{y\\_low}, \\rho) - \\Phi_2(-z_{x\\_high}, -z_{y\\_high}, \\rho) $$`}</Latex>
            <Latex>{`$$ = \\Phi_2(${-z_x_high.toFixed(
              2
            )}, ${-z_y_low.toFixed(2)}, ${results.correlation.toFixed(
              2
            )}) - \\Phi_2(${-z_x_high.toFixed(
              2
            )}, ${-z_y_high.toFixed(2)}, ${results.correlation.toFixed(
              2
            )}) $$`}</Latex>
            <Latex>{`$$ = \\mathbf{${(results.pfa_term2 / 100).toExponential(
              4
            )}} $$`}</Latex>
          </div>
          <div className="breakdown-step">
            <h5>Step 5: Final PFA</h5>
            <Latex>{`$$ PFA = PFA_{Lower} + PFA_{Upper} $$`}</Latex>
            <Latex>{`$$ = ${(results.pfa_term1 / 100).toExponential(4)} + ${(
              results.pfa_term2 / 100
            ).toExponential(4)} = \\mathbf{${(results.pfa / 100).toExponential(
              4
            )}} $$`}</Latex>
            <Latex>{`$$ \\text{Total PFA} = \\mathbf{${results.pfa.toFixed(
              4
            )}\\%} $$`}</Latex>
          </div>
        </div>
      </div>
    </div>
  );
};

const PfrBreakdownModal = ({ results, inputs, onClose }) => {
  if (!results || !inputs) return null;

  // --- Re-calculate values for demonstration ---
  const mid = (inputs.LUp + inputs.LLow) / 2;
  const LLow_norm = inputs.LLow - mid;
  const LUp_norm = inputs.LUp - mid;
  const ALow_norm = results.ALow - mid;
  const AUp_norm = results.AUp - mid;

  // Z-Scores (Normalized Limits)
  const z_x_low = LLow_norm / results.uUUT;
  const z_x_high = LUp_norm / results.uUUT;
  const z_y_low = ALow_norm / results.uDev;
  const z_y_high = AUp_norm / results.uDev;

  // Safe unit for LaTeX
  const safeNativeUnit =
    results.nativeUnit === "%" ? "\\%" : results.nativeUnit || "units";

  return (
    <div className="modal-overlay">
      <div className="modal-content breakdown-modal-content">
        <button onClick={onClose} className="modal-close-button">
          &times;
        </button>
        <h3>PFR Calculation Breakdown</h3>
        <div className="modal-body-scrollable">
          <div className="breakdown-step">
            <h5>Step 1: Formula</h5>
            <p>
              The Probability of False Reject (PFR) is the sum of the
              probabilities in the two "False Reject" regions of the risk
              scatterplot. This is calculated using the Bivariate
              Normal Cumulative Distribution Function (Φ₂).
            </p>
            <Latex>{"$$ PFR = PFR_{Lower} + PFR_{Upper} $$"}</Latex>
            <Latex>
              {
                "$$ PFR_{Lower} = P(L_{Low} < \\text{True} < L_{Up} \\text{ and Measured} < A_{Low}) $$"
              }
            </Latex>
            <Latex>
              {
                "$$ PFR_{Upper} = P(L_{Low} < \\text{True} < L_{Up} \\text{ and Measured} > A_{Up}) $$"
              }
            </Latex>
          </div>
          <div className="breakdown-step">
            <h5>Step 2: Key Statistical Inputs</h5>
            <p>
              These values are derived from your budget and reliability settings.
            </p>
            <ul>
              <li>
                True UUT Error (σ
                <sub>uut</sub>):{" "}
                <strong>
                  {results.uUUT.toPrecision(4)} {safeNativeUnit}
                </strong>
                <Latex>{`$$ \\sigma_{uut} = \\sqrt{\\sigma_{observed}^2 - u_{combined}^2} $$`}</Latex>
              </li>
              <li>
                Observed Error (σ
                <sub>obs</sub>):{" "}
                <strong>
                  {results.uDev.toPrecision(4)} {safeNativeUnit}
                </strong>
                <Latex>{`$$ \\sigma_{observed} = \\frac{L_{Upper}}{\\Phi^{-1}((1+R)/2)} $$`}</Latex>
              </li>
              <li>
                Correlation (ρ):{" "}
                <Latex>{`$$ \\rho = \\frac{\\sigma_{uut}}{\\sigma_{obs}} = \\frac{${results.uUUT.toPrecision(
                  4
                )}}{${results.uDev.toPrecision(
                  4
                )}} = \\mathbf{${results.correlation.toFixed(4)}} $$`}</Latex>
              </li>
            </ul>
          </div>
          <div className="breakdown-step">
            <h5>Step 3: Normalized Limits (Z-Scores)</h5>
            <p>
              The limits are normalized by their respective standard deviations.
              (L = UUT Tolerance, A = Acceptance Limit)
            </p>
            <ul>
              <li>
                z<sub>x_low</sub> (True Error):{" "}
                <Latex>{`$$ \\frac{L_{Low}}{\\sigma_{uut}} = \\frac{${LLow_norm.toPrecision(
                  4
                )}}{${results.uUUT.toPrecision(4)}} = \\mathbf{${z_x_low.toFixed(
                  4
                )}} $$`}</Latex>
              </li>
              <li>
                z<sub>x_high</sub> (True Error):{" "}
                <Latex>{`$$ \\frac{L_{Up}}{\\sigma_{uut}} = \\frac{${LUp_norm.toPrecision(
                  4
                )}}{${results.uUUT.toPrecision(4)}} = \\mathbf{${z_x_high.toFixed(
                  4
                )}} $$`}</Latex>
              </li>
              <li>
                z<sub>y_low</sub> (Measured Error):{" "}
                <Latex>{`$$ \\frac{A_{Low}}{\\sigma_{obs}} = \\frac{${ALow_norm.toPrecision(
                  4
                )}}{${results.uDev.toPrecision(4)}} = \\mathbf{${z_y_low.toFixed(
                  4
                )}} $$`}</Latex>
              </li>
              <li>
                z<sub>y_high</sub> (Measured Error):{" "}
                <Latex>{`$$ \\frac{A_{Up}}{\\sigma_{obs}} = \\frac{${AUp_norm.toPrecision(
                  4
                )}}{${results.uDev.toPrecision(4)}} = \\mathbf{${z_y_high.toFixed(
                  4
                )}} $$`}</Latex>
              </li>
            </ul>
          </div>
          <div className="breakdown-step">
            <h5>Step 4: Bivariate Calculation</h5>
            <p>
              The probability for each side (region) is calculated separately.
            </p>
            <p>
              <strong>Lower Side Risk (PFR_Lower):</strong>
            </p>
            <Latex>
              {
                "$$ P(z_{x\\_low} < z_x < z_{x\\_high} \\text{ and } z_y < z_{y\\_low}) $$"
              }
            </Latex>
            <Latex>{`$$ = \\Phi_2(z_{x\\_high}, z_{y\\_low}, \\rho) - \\Phi_2(z_{x\\_low}, z_{y\\_low}, \\rho) $$`}</Latex>
            <Latex>{`$$ = \\Phi_2(${z_x_high.toFixed(
              2
            )}, ${z_y_low.toFixed(2)}, ${results.correlation.toFixed(
              2
            )}) - \\Phi_2(${z_x_low.toFixed(2)}, ${z_y_low.toFixed(
              2
            )}, ${results.correlation.toFixed(2)}) $$`}</Latex>
            <Latex>{`$$ = \\mathbf{${(results.pfr_term1 / 100).toExponential(
              4
            )}} $$`}</Latex>
            <p>
              <strong>Upper Side Risk (PFR_Upper):</strong>
            </p>
            <Latex>
              {
                "$$ P(z_{x\\_low} < z_x < z_{x\\_high} \\text{ and } z_y > z_{y\\_high}) $$"
              }
            </Latex>
            <p>
              Calculated using symmetry:{" "}
              <Latex>{`$$ = P(-z_{x\\_high} < z_x < -z_{x\\_low} \\text{ and } z_y < -z_{y\\_high}) $$`}</Latex>
            </p>
            <Latex>{`$$ = \\Phi_2(-z_{x\\_low}, -z_{y\\_high}, \\rho) - \\Phi_2(-z_{x\\_high}, -z_{y\\_high}, \\rho) $$`}</Latex>
            <Latex>{`$$ = \\Phi_2(${-z_x_low.toFixed(
              2
            )}, ${-z_y_high.toFixed(2)}, ${results.correlation.toFixed(
              2
            )}) - \\Phi_2(${-z_x_high.toFixed(
              2
            )}, ${-z_y_high.toFixed(2)}, ${results.correlation.toFixed(
              2
            )}) $$`}</Latex>
            <Latex>{`$$ = \\mathbf{${(results.pfr_term2 / 100).toExponential(
              4
            )}} $$`}</Latex>
          </div>
          <div className="breakdown-step">
            <h5>Step 5: Final PFR</h5>
            <Latex>{`$$ PFR = PFR_{Lower} + PFR_{Upper} $$`}</Latex>
            <Latex>{`$$ = ${(results.pfr_term1 / 100).toExponential(4)} + ${(
              results.pfr_term2 / 100
            ).toExponential(4)} = \\mathbf{${(results.pfr / 100).toExponential(
              4
            )}} $$`}</Latex>
            <Latex>{`$$ \\text{Total PFR} = \\mathbf{${results.pfr.toFixed(
              4
            )}\\%} $$`}</Latex>
          </div>
        </div>
      </div>
    </div>
  );
};

const RiskAnalysisDashboard = ({ results, onShowBreakdown }) => {
  if (!results) return null;
  const getPfaClass = (pfa) => {
    if (pfa > 5) return "status-bad";
    if (pfa > 2) return "status-warning";
    return "status-good";
  };

  const nativeUnit = results.nativeUnit || "units";

  return (
    <div className="risk-analysis-container">
      <div className="risk-analysis-dashboard">
        <div className="risk-card clickable" onClick={() => onShowBreakdown("inputs")}>
          <div
            className="risk-label"
            style={{
              fontWeight: "bold",
              fontSize: "1.1rem",
              marginBottom: "15px",
            }}
          >
            Key Calculation Inputs
          </div>
          <ul className="result-breakdown" style={{ marginTop: 0 }}>
            <li>
              <span className="label">True Error (σ<sub>uut</sub>)</span>
              <span className="value">{results.uUUT.toPrecision(6)} {nativeUnit}</span>
            </li>
            <li>
              <span className="label">Combined Uncertainty (u<sub>cal</sub>)</span>
              <span className="value">{results.uCal.toPrecision(6)} {nativeUnit}</span>
            </li>
            <li>
              <span className="label">Observed Error (σ<sub>obs</sub>)</span>
              <span className="value">{results.uDev.toPrecision(6)} {nativeUnit}</span>
            </li>
            <li>
              <span className="label">UUT Lower Tolerance</span>
              <span className="value">{results.LLow.toPrecision(6)} {nativeUnit}</span>
            </li>
            <li>
              <span className="label">UUT Upper Tolerance</span>
              <span className="value">{results.LUp.toPrecision(6)} {nativeUnit}</span>
            </li>
            <li>
              <span className="label">Lower Acceptance</span>
              <span className="value">{results.ALow.toPrecision(6)} {nativeUnit}</span>
            </li>
            <li>
              <span className="label">Upper Acceptance</span>
              <span className="value">{results.AUp.toPrecision(6)} {nativeUnit}</span>
            </li>
            <li>
              <span className="label">Correlation (ρ)</span>
              <span className="value">{results.correlation.toPrecision(6)}</span>
            </li>
          </ul>
        </div>
        <div className="risk-card tur-card clickable" onClick={() => onShowBreakdown("tur")}>
          <div className="risk-value">{results.tur.toFixed(2)} : 1</div>
          <div className="risk-label">Test Uncertainty Ratio (TUR)</div>
          <div className="risk-explanation">
            A ratio of the UUT's tolerance to the measurement uncertainty.
          </div>
        </div>
        <div className="risk-card tur-card clickable" onClick={() => onShowBreakdown("tar")}>
          <div className="risk-value">{results.tar.toFixed(2)} : 1</div>
          <div className="risk-label">Test Acceptance Ratio (TAR)</div>
          <div className="risk-explanation">
            A ratio of the UUT's tolerance span to the TMDE's (Standard's)
            tolerance span.
          </div>
        </div>
        <div className={`risk-card pfa-card ${getPfaClass(results.pfa)} clickable`} onClick={() => onShowBreakdown("pfa")}>
          <div className="risk-value">{results.pfa.toFixed(4)} %</div>
          <div className="risk-label">Probability of False Accept (PFA)</div>
          <ul className="result-breakdown" style={{ fontSize: "0.85rem" }}>
            <li>
              <span className="label">Lower Tail Risk</span>
              <span className="value">{results.pfa_term1.toFixed(4)} %</span>
            </li>
            <li>
              <span className="label">Upper Tail Risk</span>
              <span className="value">{results.pfa_term2.toFixed(4)} %</span>
            </li>
          </ul>
        </div>
        <div className="risk-card pfr-card clickable" onClick={() => onShowBreakdown("pfr")}>
          <div className="risk-value">{results.pfr.toFixed(4)} %</div>
          <div className="risk-label">Probability of False Reject (PFR)</div>
          <ul className="result-breakdown" style={{ fontSize: "0.85rem" }}>
            <li>
              <span className="label">Lower Side Risk</span>
              <span className="value">{results.pfr_term1.toFixed(4)} %</span>
            </li>
            <li>
              <span className="label">Upper Side Risk</span>
              <span className="value">{results.pfr_term2.toFixed(4)} %</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const RiskMitigationDashboard = ({ results, onShowBreakdown }) => {
  if (!results) return null;
  const guardBand = results.gbResults

  const nativeUnit = results.nativeUnit || "units";

  return (
    <div className="risk-analysis-container">
      <div className="risk-analysis-dashboard">
        <div className="risk-card clickable" onClick={() => onShowBreakdown("inputs")}>
          <div
            className="risk-label"
            style={{
              fontWeight: "bold",
              fontSize: "1.1rem",
              marginBottom: "15px",
            }}
          >
            Key Calculation Inputs
          </div>
          <ul className="result-breakdown" style={{ marginTop: 0 }}>
            <li>
              <span className="label">UUT Limit (LLow)</span>
              <span className="value">{results.LLow.toFixed(3)} {nativeUnit}</span>
            </li>
            <li>
              <span className="label">UUT Limit (LUp)</span>
              <span className="value">{results.LUp.toFixed(3)} {nativeUnit}</span>
            </li>
            <li>
              <span className="label">Std. Unc. of Cal (uₑₐₗ)</span>
              <span className="value">{results.uCal.toFixed(3)} {nativeUnit}</span>
            </li>
            <li>
              <span className="label">Std. Unc. of UUT (uᵤᵤₜ)</span>
              <span className="value">{results.uUUT.toFixed(3)} {nativeUnit}</span>
            </li>
            <li>
              <span className="label">Acceptance Limit (Aₗₒw)</span>
              <span className="value">{results.ALow.toFixed(3)} {nativeUnit}</span>
            </li>
            <li>
              <span className="label">Acceptance Limit (Aᵤₚ)</span>
              <span className="value">{results.AUp.toFixed(3)} {nativeUnit}</span>
            </li>
          </ul>
        </div>
        <div className="risk-card gblow-card clickable" onClick={() => onShowBreakdown("gblow")}>
          <div className="risk-value">{guardBand.GBLOW.toFixed(4)}</div>
          <div className="risk-label">GB Limit Low Value</div>
          <div className="risk-explanation">
            A ratio of the UUT's tolerance to the measurement uncertainty.
          </div>
        </div>
        <div className="risk-card gbhigh-card clickable" onClick={() => onShowBreakdown("gbhigh")}>
          <div className="risk-value">{guardBand.GBUP.toFixed(4)}</div>
          <div className="risk-label">GB Limit High Value</div>
          <div className="risk-explanation">
            A ratio of the UUT's tolerance to the measurement uncertainty.
          </div>
        </div>

        <div className={`risk-card gbpfa-card clickable`} onClick={() => onShowBreakdown("gbpfa")}>
          <div className="risk-value">{guardBand.GBPFA.toFixed(4)} %</div>
          <div className="risk-label">Probability of False Accept (PFA) with Guard Banding</div>
          <ul className="result-breakdown" style={{ fontSize: "0.85rem" }}>
            <li>
              <span className="label">Lower Tail Risk</span>
              <span className="value">{guardBand.GBPFAT1.toFixed(4)} %</span>
            </li>
            <li>
              <span className="label">Upper Tail Risk</span>
              <span className="value">{guardBand.GBPFAT2.toFixed(4)} %</span>
            </li>
          </ul>
        </div>
        <div className="risk-card gbpfr-card clickable" onClick={() => onShowBreakdown("gbpfr")}>
          <div className="risk-value">{guardBand.GBPFR.toFixed(4)} %</div>
          <div className="risk-label">Probability of False Reject (PFR) with Guard Banding</div>
          <ul className="result-breakdown" style={{ fontSize: "0.85rem" }}>
            <li>
              <span className="label">Lower Side Risk</span>
              <span className="value">{guardBand.GBPFRT1.toFixed(4)} %</span>
            </li>
            <li>
              <span className="label">Upper Side Risk</span>
              <span className="value">{guardBand.GBPFRT2.toFixed(4)} %</span>
            </li>
          </ul>
        </div>
        <div className="risk-card gbmult-card clickable" onClick={() => onShowBreakdown("gbmult")}>
          <div className="risk-value">{guardBand.GBMULT.toFixed(4)} %</div>
          <div className="risk-label">Guard Band Multiplier</div>
          <div className="risk-explanation">
            Ratio between the guardband tolerance limits and UUT tolerance limits.
          </div>
        </div>
        <div className="risk-card gbcalint-card clickable" onClick={() => onShowBreakdown("gbcalint")}>
          <div className="risk-value">{guardBand.GBCALINT.toFixed(4)}</div>
          <div className="risk-label">Calibration Interval with Guard Banding</div>
          <div className="risk-explanation">
            Recommended Calibration Interval with Guard Band Tolerance Limits.
          </div>
        </div>
        <div className="risk-card calint-card clickable" onClick={() => onShowBreakdown("calint")}>
          <div className="risk-value">{guardBand.NOGBCALINT.toFixed(4)}</div>
          <div className="risk-label">Calibration without Guard Banding</div>
          <div className="risk-explanation">
            Recommended Calibration Interval without Guard Band Tolerance Limits.
          </div>
        </div>
        <div className="risk-card measrel-card clickable" onClick={() => onShowBreakdown("measrel")}>
          <div className="risk-value">{guardBand.NOGBMEASREL.toFixed(4)} %</div>
          <div className="risk-label">Measurement Reliability Needed without Guard Banding</div>
          <div className="risk-explanation">
            Required Measurement Reliability without Guard Banding.
          </div>
        </div>
      </div>
    </div>
  );
};

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

const getBudgetComponentsFromTolerance = (
  toleranceObject,
  referenceMeasurementPoint
) => {
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
      // --- START FIX ---
      u_i_native = value / 2 / distributionDivisor;
      unit_native = unit;
      // --- END FIX ---
    } else {
      const high = parseFloat(tolComp?.high || 0);
      const low = parseFloat(tolComp?.low || -high);
      const halfSpan = (high - low) / 2;
      if (halfSpan === 0) return;

      const unit = tolComp.unit;
      let valueInNominalUnits;

      if (unit === "%" || unit === "ppm") {
        valueInNominalUnits =
          halfSpan * unitSystem.units[unit].to_si * baseValueForRelative;
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
        value: u_i, // This is u_i in PPM
        value_native: u_i_native, // This is u_i in native units
        unit_native: unit_native, // This is the native unit
        dof: Infinity,
        isCore: true,
        distribution: distributionLabel,
      });
    }
  };
  processComponent(toleranceObject.reading, "Reading", nominalValue);
  processComponent(
    toleranceObject.range,
    "Range",
    parseFloat(toleranceObject.range?.value)
  );
  processComponent(toleranceObject.floor, "Floor", nominalValue);

  if (toleranceObject.db && !isNaN(parseFloat(toleranceObject.db.high))) {
    // ... (db logic is unchanged) ...
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

export const calculateDerivedUncertainty = (
  equationString,
  variableMappings,
  tmdeTolerances,
  derivedNominalPoint
) => {
  if (!equationString || !variableMappings || !tmdeTolerances) {
    console.error("calculateDerivedUncertainty missing essential inputs", {
      equationString,
      variableMappings,
      tmdeTolerances,
    });
    return {
      combinedUncertaintyNative: NaN,
      breakdown: [],
      nominalResult: NaN,
      error: "Missing calculation inputs.",
    };
  }
  if (
    Object.keys(variableMappings).length === 0 &&
    equationString.match(/[a-zA-Z]/)
  ) {
    return {
      combinedUncertaintyNative: NaN,
      breakdown: [],
      nominalResult: NaN,
      error: "Variable mappings are missing for the equation.",
    };
  }

  try {
    let expressionToParse = equationString.trim();
    const equalsIndex = expressionToParse.indexOf("=");

    if (equalsIndex !== -1) {
      if (equalsIndex < expressionToParse.length - 1) {
        expressionToParse = expressionToParse.substring(equalsIndex + 1).trim();
      } else {
        throw new Error(
          "Invalid equation format: Assignment without expression."
        );
      }
    }
    if (!expressionToParse) {
      throw new Error("Equation expression is empty.");
    }

    const node = math.parse(expressionToParse);

    const variables = Object.keys(variableMappings);
    if (variables.length === 0) {
      try {
        const constantResult = node.compile().evaluate({});
        return {
          combinedUncertaintyNative: 0,
          breakdown: [],
          nominalResult: constantResult,
          error: null,
        };
      } catch (constEvalError) {
        throw new Error(
          "Equation has no mapped variables and is not a constant expression."
        );
      }
    }

    let sumOfSquaresNative = 0;
    const calculationBreakdown = [];
    const nominalScope = {};
    const uncertaintyInputs = {};

    tmdeTolerances.forEach((tmde) => {
      if (
        !tmde.variableType ||
        !tmde.measurementPoint ||
        tmde.measurementPoint.value === "" ||
        tmde.measurementPoint.unit === ""
      ) {
        console.warn(
          "Skipping TMDE due to missing type or measurement point:",
          tmde
        );
        return;
      }
      const nominalValue = parseFloat(tmde.measurementPoint.value);
      if (isNaN(nominalValue)) {
        console.warn("Skipping TMDE due to invalid nominal value:", tmde);
        return;
      }
      const { standardUncertainty: ui_ppm } =
        calculateUncertaintyFromToleranceObject(tmde, tmde.measurementPoint);
      const nominalInBase = unitSystem.toBaseUnit(
        nominalValue,
        tmde.measurementPoint.unit
      );

      const ui_absolute_base = (ui_ppm / 1e6) * Math.abs(nominalInBase);
      const ui_absolute_native = (ui_ppm / 1e6) * Math.abs(nominalValue);

      const quantity = parseInt(tmde.quantity, 10) || 1;
      const variance_base = ui_absolute_base ** 2 * quantity;
      const variance_native = ui_absolute_native ** 2 * quantity;

      if (
        isNaN(variance_base) ||
        variance_base < 0 ||
        isNaN(variance_native)
      ) {
        console.warn(
          "Could not calculate valid absolute uncertainty for TMDE:",
          tmde
        );
        return;
      }

      const variableSymbol = Object.keys(variableMappings).find(
        (key) => variableMappings[key] === tmde.variableType
      );
      if (variableSymbol && !nominalScope.hasOwnProperty(variableSymbol)) {
        nominalScope[variableSymbol] = nominalValue;
      } else if (!variableSymbol) {
        console.warn(
          `TMDE variable type '${tmde.variableType}' not found in mappings.`
        );
        return;
      }

      if (uncertaintyInputs[tmde.variableType]) {
        uncertaintyInputs[tmde.variableType].ui_squared_sum_base +=
          variance_base;
        uncertaintyInputs[tmde.variableType].ui_squared_sum_native +=
          variance_native;
      } else {
        uncertaintyInputs[tmde.variableType] = {
          ui_squared_sum_base: variance_base,
          ui_squared_sum_native: variance_native,
          nominal: nominalValue,
          unit: tmde.measurementPoint.unit,
          symbol: variableSymbol,
        };
      }
    });

    const typesFound = new Set(Object.keys(uncertaintyInputs));
    const requiredTypes = new Set(Object.values(variableMappings));
    if (typesFound.size < requiredTypes.size) {
      const missingTypes = [...requiredTypes].filter((t) => !typesFound.has(t));
      throw new Error(
        `Missing TMDE assignments for required input types: ${missingTypes.join(
          ", "
        )}. Check inputs and TMDE assignments.`
      );
    }

    Object.keys(uncertaintyInputs).forEach((type) => {
      uncertaintyInputs[type].ui_base = Math.sqrt(
        uncertaintyInputs[type].ui_squared_sum_base
      );
      uncertaintyInputs[type].ui_native = Math.sqrt(
        uncertaintyInputs[type].ui_squared_sum_native
      );
    });

    variables.forEach((variableSymbol) => {
      const variableType = variableMappings[variableSymbol];
      const inputData = uncertaintyInputs[variableType];

      if (!inputData || inputData.ui_native === undefined) {
        throw new Error(
          `Internal error: Input data missing for type '${variableType}'.`
        );
      }
      if (nominalScope[variableSymbol] === undefined) {
        throw new Error(
          `Nominal value for variable '${variableSymbol}' missing.`
        );
      }

      const ui_native = inputData.ui_native;
      const ui_base = inputData.ui_base;

      const derivativeNode = math.derivative(node, variableSymbol);
      const derivativeStr = derivativeNode.toString();
      const derivativeFunc = derivativeNode.compile();
      const sensitivityCoeff = derivativeFunc.evaluate(nominalScope);

      if (isNaN(sensitivityCoeff)) {
        throw new Error(
          `Could not evaluate derivative for '${variableSymbol}'.`
        );
      }

      const contribution_native = sensitivityCoeff * ui_native;
      const termSquared_native = contribution_native ** 2;

      sumOfSquaresNative += termSquared_native;

      calculationBreakdown.push({
        variable: variableSymbol,
        type: variableType,
        nominal: inputData.nominal,
        unit: inputData.unit,
        ui_absolute_base: ui_base,
        ci: sensitivityCoeff,
        derivativeString: derivativeStr,
        contribution_native: Math.abs(contribution_native),
        termSquared_native: termSquared_native,
      });
    });

    const combinedUncertaintyNative = math.sqrt(sumOfSquaresNative);

    let nominalResult = NaN;
    try {
      nominalResult = node.compile().evaluate(nominalScope);
    } catch (evalError) {
      console.error("Error evaluating nominal equation result:", evalError);
    }

    return {
      combinedUncertaintyNative: combinedUncertaintyNative,
      breakdown: calculationBreakdown,
      nominalResult,
      error: null,
    };
  } catch (error) {
    console.error("Error calculating derived uncertainty:", error);
    return {
      combinedUncertaintyNative: NaN,
      breakdown: [],
      nominalResult: NaN,
      error: error.message,
    };
  }
};

const extractRawAttachments = (pdfDoc) => {
  if (!pdfDoc.catalog.has(PDFName.of('Names'))) return [];
  const Names = pdfDoc.catalog.lookup(PDFName.of('Names'), PDFDict);
  if (!Names.has(PDFName.of('EmbeddedFiles'))) return [];
  const EmbeddedFiles = Names.lookup(PDFName.of('EmbeddedFiles'), PDFDict);
  if (!EmbeddedFiles.has(PDFName.of('Names'))) return [];
  const EFNames = EmbeddedFiles.lookup(PDFName.of('Names'), PDFArray);
  
  const rawAttachments = [];
  for (let idx = 0, len = EFNames.size(); idx < len; idx += 2) {
    const fileName = EFNames.lookup(idx);
    const fileSpec = EFNames.lookup(idx + 1, PDFDict);
    rawAttachments.push({ fileName, fileSpec });
  }
  return rawAttachments;
};

const extractAttachments = (pdfDoc) => {
  const rawAttachments = extractRawAttachments(pdfDoc);
  
  return rawAttachments.map(({ fileName, fileSpec }) => {
    const EF = fileSpec.lookup(PDFName.of('EF'), PDFDict);
    const stream = EF.lookup(PDFName.of('F'), PDFStream);

    // Get the MIME type, which is stored as /Subtype
    // e.g., /image#2Fjpeg -> "image/jpeg" or /application#2Fjson -> "application/json"
    const subtype = EF.lookup(PDFName.of('Subtype'));
    let mimeType = 'application/octet-stream'; // Default
    if (subtype instanceof PDFName) {
        // The subtype is often encoded, e.g., /image#2Fjpeg for "image/jpeg"
        // PDFName.decodeText() handles this decoding.
        mimeType = subtype.decodeText();
    }

    // Handle different file name encodings
    let name;
    if (fileName instanceof PDFHexString) {
      name = fileName.decodeText();
    } else if (fileName instanceof PDFString) {
      name = fileName.toString();
    } else {
      name = 'unknown_attachment';
    }

    // Handle stream type
    let data;
    if (stream instanceof PDFRawStream) {
        data = decodePDFRawStream(stream).decode();
    } else {
        data = stream.contents;
    }

    return {
      name: name,
      data: data, // This is a Uint8Array
      mimeType: mimeType,
    };
  });
};

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
}) {

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const [year, month, day] = dateString.split("-");
    return `${month}/${day}/${year}`;
  };

  const [isAddTmdeModalOpen, setAddTmdeModalOpen] = useState(false);
  const [analysisMode, setAnalysisMode] = useState("uncertaintyTool");

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

  // State for Derived Breakdown Modal
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

  const calculateRiskMetrics = useCallback(() => {
    const LLow = parseFloat(riskInputs.LLow);
    const LUp = parseFloat(riskInputs.LUp);
    const pfaRequired = parseFloat(sessionData.uncReq.reqPFA)/100;
    const reliability = parseFloat(sessionData.uncReq.reliability)/100;
    const calInt = parseFloat(sessionData.uncReq.calInt);
    const measRelCalc = parseFloat(sessionData.uncReq.measRelCalcAssumed)/100;
    const turNeeded = parseFloat(sessionData.uncReq.neededTUR);
  
        // --- Validation Checks (Existing) ---
    if (isNaN(LLow) || isNaN(LUp) || LUp <= LLow) {
      setNotification({
        title: "Invalid Input",
        message: "Enter valid UUT tolerance limits.",
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
      (comp) => comp.absoluteHigh !== undefined && comp.absoluteLow !== undefined
    );

    const uutName = sessionData.uutDescription || "UUT";

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
      console.log(tmdeTolerancesData)
      const tmdeTotals = tmdeTolerancesData.reduce(
        (acc, tmde) => {
          if (!tmde.measurementPoint || !tmde.measurementPoint.value) {
            missingTmdeRef = true;
            return acc;
          }

          const { breakdown: tmdeBreakdown } =
            calculateUncertaintyFromToleranceObject(tmde, tmde.measurementPoint);
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
    } else if (tmdeToleranceSpan_Native === 0 && LUp - LLow > 0) {
      if (riskInputs.LUp && riskInputs.LLow) {
        setNotification({
          title: "Missing Component",
          message: "Could not find TMDE tolerances for TAR.",
        });
      }
    }



    // MATH FUNCTIONS ------------------------------------------------------------------------------------------------------------------------------------
    function PHID(z) {
      const P = [
        220.206867912376,
        221.213596169931,
        112.079291497871,
        33.912866078383,
        6.37396220353165,
        0.700383064443688,
        0.0352624965998911
      ];

      const Q = [
        440.413735824752,
        793.826512519948,
        637.333633378831,
        296.564248779674,
        86.7807322029461,
        16.064177579207,
        1.75566716318264,
        0.0883883476483184
      ];

      const CUTOFF = 8;
      const ZABS = Math.abs(z);
      let p;

      if (ZABS > CUTOFF) {
        p = 0;
      } else {
        const EXPNTL = Math.exp(-Math.pow(ZABS, 2) / 2);

        const numerator =
          ((((((P[6] * ZABS + P[5]) * ZABS + P[4]) * ZABS + P[3]) * ZABS + P[2]) * ZABS + P[1]) * ZABS + P[0]);

        const denominator =
          (((((((Q[7] * ZABS + Q[6]) * ZABS + Q[5]) * ZABS + Q[4]) * ZABS + Q[3]) * ZABS + Q[2]) * ZABS + Q[1]) * ZABS + Q[0]);

        p = EXPNTL * numerator / denominator;
      }

      return z > 0 ? 1 - p : p;
    }


    function PHIDInv(p) {
      const a = [-39.6968302866538, 220.946098424521, -275.928510446969,
                138.357751867269, -30.6647980661472, 2.50662827745924];
      const b = [-54.4760987982241, 161.585836858041, -155.698979859887,
                66.8013118877197, -13.2806815528857];
      const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184,
                -2.54973253934373, 4.37466414146497, 2.93816398269878];
      const d = [0.00778469570904146, 0.32246712907004, 2.445134137143,
                3.75440866190742];

      const pLow = 0.02425;
      const pHigh = 1 - pLow;

      if (p <= 0 || p >= 1) {
        throw new Error("Argument out of bounds");
      }

      let q, r;

      if (p < pLow) {
        q = Math.sqrt(-2 * Math.log(p));
        return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
              ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
      } else if (p <= pHigh) {
        q = p - 0.5;
        r = q * q;
        return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
              (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
      } else {
        q = Math.sqrt(-2 * Math.log(1 - p));
        return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
                ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
      }
    }

    function CumNorm(x) {
      const XAbs = Math.abs(x);
      let Build, Exponential;

      if (XAbs > 37) {
        return 0;
      }

      Exponential = Math.exp(-Math.pow(XAbs, 2) / 2);

      if (XAbs < 7.07106781186547) {
        Build = 3.52624965998911e-2 * XAbs + 0.700383064443688;
        Build = Build * XAbs + 6.37396220353165;
        Build = Build * XAbs + 33.912866078383;
        Build = Build * XAbs + 112.079291497871;
        Build = Build * XAbs + 221.213596169931;
        Build = Build * XAbs + 220.206867912376;
        let numerator = Exponential * Build;

        Build = 8.83883476483184e-2 * XAbs + 1.75566716318264;
        Build = Build * XAbs + 16.064177579207;
        Build = Build * XAbs + 86.7807322029461;
        Build = Build * XAbs + 296.564248779674;
        Build = Build * XAbs + 637.333633378831;
        Build = Build * XAbs + 793.826512519948;
        Build = Build * XAbs + 440.413735824752;

        return x > 0 ? 1 - numerator / Build : numerator / Build;
      } else {
        Build = XAbs + 0.65;
        Build = XAbs + 4 / Build;
        Build = XAbs + 3 / Build;
        Build = XAbs + 2 / Build;
        Build = XAbs + 1 / Build;

        const result = Exponential / Build / 2.506628274631;
        return x > 0 ? 1 - result : result;
      }
    }

    function vbNormSDist(ZVal) {
      return CumNorm(ZVal);
    }

    function InvNormalDistribution(y0) {
      const Expm2 = 0.135335283236613;
      const S2Pi = 2.506628274631;
      const MaxRealNumber = Number.MAX_VALUE;

      if (y0 <= 0) return -MaxRealNumber;
      if (y0 >= 1) return MaxRealNumber;

      let y = y0;
      let code = 1;

      if (y > 1 - Expm2) {
        y = 1 - y;
        code = 0;
      }

      if (y > Expm2) {
        y -= 0.5;
        const y2 = y * y;

        let P0 = -59.9633501014108;
        P0 = 98.0010754186 + y2 * P0;
        P0 = -56.676285746907 + y2 * P0;
        P0 = 13.931260938728 + y2 * P0;
        P0 = -1.23916583867381 + y2 * P0;

        let Q0 = 1;
        Q0 = 1.95448858338142 + y2 * Q0;
        Q0 = 4.67627912898882 + y2 * Q0;
        Q0 = 86.3602421390891 + y2 * Q0;
        Q0 = -225.462687854119 + y2 * Q0;
        Q0 = 200.260212380061 + y2 * Q0;
        Q0 = -82.0372256168333 + y2 * Q0;
        Q0 = 15.9056225126212 + y2 * Q0;
        Q0 = -1.1833162112133 + y2 * Q0;

        let x = y + y * y2 * P0 / Q0;
        return x * S2Pi;
      }

      let x = Math.sqrt(-2 * Math.log(y));
      const x0 = x - Math.log(x) / x;
      const z = 1 / x;
      let x1;

      if (x < 8) {
        let P1 = 4.05544892305962;
        P1 = 31.5251094599894 + z * P1;
        P1 = 57.1628192246421 + z * P1;
        P1 = 44.0805073893201 + z * P1;
        P1 = 14.6849561928858 + z * P1;
        P1 = 2.1866330685079 + z * P1;
        P1 = -(1.40256079171354 * 0.1) + z * P1;
        P1 = -(3.50424626827848 * 0.01) + z * P1;
        P1 = -(8.57456785154685 * 0.0001) + z * P1;

        let Q1 = 1;
        Q1 = 15.7799883256467 + z * Q1;
        Q1 = 45.3907635128879 + z * Q1;
        Q1 = 41.3172038254672 + z * Q1;
        Q1 = 15.0425385692908 + z * Q1;
        Q1 = 2.50464946208309 + z * Q1;
        Q1 = -(1.42182922854788 * 0.1) + z * Q1;
        Q1 = -(3.80806407691578 * 0.01) + z * Q1;
        Q1 = -(9.33259480895457 * 0.0001) + z * Q1;

        x1 = z * P1 / Q1;
      } else {
        let P2 = 3.23774891776946;
        P2 = 6.91522889068984 + z * P2;
        P2 = 3.93881025292474 + z * P2;
        P2 = 1.33303460815808 + z * P2;
        P2 = 0.201485389549179 + z * P2;
        P2 = 0.012371663481782 + z * P2;
        P2 = 0.000301581553508235 + z * P2;
        P2 = 0.00000265806974686738 + z * P2;
        P2 = 0.00000000623974539184983 + z * P2;

        let Q2 = 1;
        Q2 = 6.02427039364742 + z * Q2;
        Q2 = 3.67983563856161 + z * Q2;
        Q2 = 1.37702099489081 + z * Q2;
        Q2 = 0.216236993594497 + z * Q2;
        Q2 = 0.0134204006088543 + z * Q2;
        Q2 = 0.000328014464682128 + z * Q2;
        Q2 = 0.00000289247864745381 + z * Q2;
        Q2 = 0.00000000679019408009981 + z * Q2;

        x1 = z * P2 / Q2;
      }

      x = x0 - x1;
      return code !== 0 ? -x : x;
    }

    function vbNormSInv(p) {
      return InvNormalDistribution(p);
    }

        function ObsRel(sRiskType, dCalUnc, dMeasRel, dAvg,dTolLow,dTolUp,dMeasUnc) {
      let dBiasUnc, dDevUnc;

      if (sRiskType === "NotThreshold") {
        dBiasUnc = uutUnc(dMeasRel, dCalUnc, dTolLow, dTolUp);
        dDevUnc = Math.sqrt(Math.pow(dMeasUnc, 2) + Math.pow(dBiasUnc, 2));
        return vbNormSDist(dTolUp / dDevUnc) - vbNormSDist(dTolLow / dDevUnc);
      }

      if (sRiskType === "UpThreshold") {
        dBiasUnc = uutUncUL(dMeasRel, dCalUnc, dAvg, dTolUp);
        dDevUnc = Math.sqrt(Math.pow(dMeasUnc, 2) + Math.pow(dBiasUnc, 2));
        return vbNormSDist((dTolUp - dAvg) / dDevUnc);
      }

      if (sRiskType === "LowThreshold") {
        dBiasUnc = uutUncLL(dMeasRel, dCalUnc, dAvg, dTolLow);
        dDevUnc = Math.sqrt(Math.pow(dMeasUnc, 2) + Math.pow(dBiasUnc, 2));
        return 1 - vbNormSDist((dTolLow - dAvg) / dDevUnc);
      }

      return 0;
    }

    function PredRel(sRiskType, dCalUnc, dMeasRel,dAvg,dTolLow,dTolUp,dMeasUnc,dGBLow,dGBUp) {
      let dBiasUnc, dDevUnc;

      if (sRiskType === "NotThreshold") {
        dBiasUnc = uutUnc(dMeasRel, dCalUnc, dGBLow, dGBUp);
        dDevUnc = Math.sqrt(Math.pow(dMeasUnc, 2) + Math.pow(dBiasUnc, 2));
        return vbNormSDist(dTolUp / dDevUnc) - vbNormSDist(dTolLow / dDevUnc);
      }

      if (sRiskType === "UpThreshold") {
        dBiasUnc = uutUncUL(dMeasRel, dCalUnc, dAvg, dGBUp);
        dDevUnc = Math.sqrt(Math.pow(dMeasUnc, 2) + Math.pow(dBiasUnc, 2));
        return vbNormSDist((dTolUp - dAvg) / dDevUnc);
      }

      if (sRiskType === "LowThreshold") {
        dBiasUnc = uutUncLL(dMeasRel, dCalUnc, dAvg, dGBLow);
        dDevUnc = Math.sqrt(Math.pow(dMeasUnc, 2) + Math.pow(dBiasUnc, 2));
        return 1 - vbNormSDist((dTolLow - dAvg) / dDevUnc);
      }

      return 0;
    }

    // SHARED FUNCTIONS ----------------------------------------------------------------------------------------------------------------------------------
    const isNotNumeric = val => isNaN(parseFloat(val));
    const vbaNbrValidate = val => isNotNumeric(val) ? 0 : parseFloat(val);

    function getTolInfo(rngNominal, rngAvg, rngTolLow, rngTolUp) {
      const bNoNominal = isNotNumeric(rngNominal);
      const bNoAvg = isNotNumeric(rngAvg);
      const bNoTolLow = isNotNumeric(rngTolLow);
      const bNoTolUp = isNotNumeric(rngTolUp);
      if (bNoTolLow && bNoTolUp) return ["Fail"];
      let dNominal = vbaNbrValidate(rngNominal);
      let dAvg = vbaNbrValidate(rngAvg);
      let dTolLow = vbaNbrValidate(rngTolLow);
      let dTolUp = vbaNbrValidate(rngTolUp);
      const bIsThreshold = (bNoTolLow && !bNoTolUp) || (bNoTolUp && !bNoTolLow);
      if (bIsThreshold) {
        if (bNoTolLow) {
          if (bNoNominal) dNominal = dTolUp;
          if (bNoAvg) {
            dAvg = dNominal;
            return ["AltUpThreshold", dNominal, dAvg, dTolLow, dTolUp, bIsThreshold];
          } else {
            return ["UpThreshold", dNominal, dAvg, dTolLow, dTolUp, bIsThreshold];
          }
        } else if (bNoTolUp) {
          if (bNoNominal) dNominal = dTolLow;

          if (bNoAvg) {
            dAvg = dNominal;
            return ["AltLowThreshold", dNominal, dAvg, dTolLow, dTolUp, bIsThreshold];
          } else {
            return ["LowThreshold", dNominal, dAvg, dTolLow, dTolUp, bIsThreshold];
          }
        }
      } else {
        if (dTolLow >= dTolUp) return ["Fail"];
        dNominal = (dTolLow + dTolUp) / 2;
        if (!bNoAvg && dNominal !== dAvg) {
          if (dAvg > dTolLow && dAvg < dTolUp) {
            dNominal = dAvg;
          }
        }
        dTolLow = dTolLow - dNominal;
        dTolUp = dTolUp - dNominal;
        return ["NotThreshold", dNominal, dAvg, dTolLow, dTolUp, bIsThreshold];
      }
    };


    function getRiskInfo(rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel) {

      const [sRiskType,dNominal,dAvg,dTolLow,dTolUp, bIsThreshold] = getTolInfo(rngNominal, rngAvg, rngTolLow, rngTolUp);
      
      const bNoMeasUnc = isNotNumeric(rngMeasUnc);
      const bNoMeasRel = isNotNumeric(rngMeasRel);

      if (bNoMeasUnc || bNoMeasRel) {
          return ["Fail"];
      }

      const dMeasUnc = vbaNbrValidate(rngMeasUnc);
      const dMeasRel = vbaNbrValidate(rngMeasRel);

      return [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel, bIsThreshold];
    };

    function uutUnc(r, uCal, LLow, LUp) {
      const Mid = (LUp + LLow) / 2;
      LUp = Math.abs(LUp - Mid);
      LLow = -Math.abs(LLow - Mid);

      const uDev = LUp / vbNormSInv((1 + r) / 2);

      const uUUT2 = Math.pow(uDev, 2) - Math.pow(uCal, 2);
      const uUUT = uUUT2 <= 0 ? 0 : Math.sqrt(uUUT2);

      return uUUT;
    };

    function uutUncLL(r, uCal, Avg, LLow) {
      let uDev, uUUT, uUUT2;

      if (LLow > Avg) {
        const temp = Avg;
        Avg = LLow;
        LLow = temp;
      }

      uDev = (LLow - Avg) / vbNormSInv(1 - r);

      uUUT2 = Math.pow(uDev, 2) - Math.pow(uCal, 2);
      uUUT = uUUT2 <= 0 ? 0 : Math.sqrt(uUUT2);

      return uUUT;
    };

    function uutUncUL(r, uCal, avg, LUp) {
      if (LUp < avg) {
        const temp = avg;
        avg = LUp;
        LUp = temp;
      }

      const uDev = (LUp - avg) / vbNormSInv(r);

      const uUUT2 = Math.pow(uDev, 2) - Math.pow(uCal, 2);
      const uUUT = uUUT2 <= 0 ? 0 : Math.sqrt(uUUT2);

      return uUUT;
    };

    function resDwn(dVal, dRes) {
      if (dRes <= 0) {
        return dVal;
      }
      if (dVal === 0) {
        return dVal;
      }
      let x = Math.floor(dVal / dRes) * dRes;
      const dZero = 0.000001;
      if (Math.abs(Math.trunc(dVal / dRes) - (dVal / dRes)) > dZero) {
        if (dVal > 0) {
          x = x + dRes;
        }
      }
      return x;
    };

    function resUp(dVal, dRes) {
      if (dRes <= 0) {
        return dVal;
      }
      if (dVal === 0) {
        return dVal;
      }
      let x = Math.trunc(dVal / dRes) * dRes;
      const dZero = 0.000001;
      if (Math.abs(Math.trunc(dVal / dRes) - (dVal / dRes)) > dZero) {
        if (dVal < 0) {
          x = x - dRes;
        }
      }
      return x;
    };

    function calRelwTUR(sRiskType, rngTUR, rngReqTUR, dMeasUnc, dMeasRel, dTolLow, dTolUp, dAvg) {
      if (rngReqTUR === "" || rngReqTUR === null) {
        return dMeasRel;
      }

      let dTUR, dReqTur, dCalUnc;
      if (sRiskType === "NotThreshold" || sRiskType === "UpThreshold" || sRiskType === "LowThreshold") {
        dTUR = vbaNbrValidate(rngTUR);
        dReqTur = vbaNbrValidate(rngReqTUR);
        if (dReqTur > 0) {
          dCalUnc = dMeasUnc * dTUR / dReqTur;
        } else {
          return dMeasRel;
        }
      } else {
        return dMeasRel;
      }

      let dBiasUnc, dDevUnc;

      if (sRiskType === "NotThreshold") {

        dBiasUnc = uutUnc(dMeasRel, dCalUnc, dTolLow, dTolUp);
       
        dDevUnc = Math.sqrt(dMeasUnc * dMeasUnc + dBiasUnc * dBiasUnc);
        
        dMeasRel = vbNormSDist(dTolUp / dDevUnc) - vbNormSDist(dTolLow / dDevUnc);

      } else if (sRiskType === "UpThreshold") {
        dBiasUnc = uutUncUL(dMeasRel, dCalUnc, dAvg, dTolUp);
        dDevUnc = Math.sqrt(dMeasUnc * dMeasUnc + dBiasUnc * dBiasUnc);
        dMeasRel = vbNormSDist((dTolUp - dAvg) / dDevUnc);

      } else if (sRiskType === "LowThreshold") {
        dBiasUnc = uutUncLL(dMeasRel, dCalUnc, dAvg, dTolLow);
        dDevUnc = Math.sqrt(dMeasUnc * dMeasUnc + dBiasUnc * dBiasUnc);
        dMeasRel = 1 - vbNormSDist((dTolLow - dAvg) / dDevUnc);
      }
      
      return dMeasRel;
    };

    // TAR FUNCTIONS -------------------------------------------------------------------------------------------------------------------------------------
    function calcTAR(rngNominal, rngAvg, rngTolLow, rngTolUp, rngSTDLow, rngSTDUp) {
      let dSTDLow, dSTDUp;

      if (isNotNumeric(rngSTDLow) || isNotNumeric(rngSTDUp)) {
        return "";
      } else {
        dSTDLow = vbaNbrValidate(rngSTDLow);
        dSTDUp = vbaNbrValidate(rngSTDUp);
      }

      const [sRiskType,dNominal,dAvg,dTolLow,dTolUp, bIsThreshold] = getTolInfo(rngNominal, rngAvg, rngTolLow, rngTolUp);

      if (sRiskType === "NotThreshold") {
        return Math.abs((dTolUp - dTolLow) / (dSTDUp - dSTDLow));
      } else if (sRiskType === "LowThreshold") {
        return Math.abs((dAvg - dTolLow) / ((dSTDUp - dSTDLow) / 2));
      } else if (sRiskType === "UpThreshold") {
        return Math.abs((dTolUp - dAvg) / ((dSTDUp - dSTDLow) / 2));
      } else {
        return "";
      }
    };
    // TUR FUNCTIONS -------------------------------------------------------------------------------------------------------------------------------------
    function calcTUR(rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc) {
      let dMeasUnc;

      if (isNotNumeric(rngMeasUnc)) {
        return "";
      } else {
        dMeasUnc = vbaNbrValidate(rngMeasUnc);
      }

      const [sRiskType,dNominal,dAvg,dTolLow,dTolUp, bIsThreshold] = getTolInfo(rngNominal, rngAvg, rngTolLow, rngTolUp);

      if (sRiskType === "NotThreshold") {
        return Math.abs((dTolUp - dTolLow) / (2 * dMeasUnc));
      } else if (sRiskType === "LowThreshold") {
        return Math.abs((dAvg - dTolLow) / dMeasUnc);
      } else if (sRiskType === "UpThreshold") {
        return Math.abs((dTolUp - dAvg) / dMeasUnc);
      } else {
        return "";
      }
    };

    // function calcTUR(nominal, average, lowerTolerance, upperTolerance, measurementUncertainty) {

    //   const validateNumber = val => isNaN(val) ? 0 : parseFloat(val);

    //   if (isNaN(measurementUncertainty)) {
    //     return "";
    //   } else {
    //     measurementUncertainty = validateNumber(measurementUncertainty);
    //   }

    //   const toleranceTypes = ["UpThreshold","AltUpThreshold","LowThreshold","AltLowThreshold","NotThreshold"];

    //   let tolInfo = "";
    //   const noUpper = isNaN(upperTolerance);
    //   const noLower = isNaN(lowerTolerance);
    //   if (noLower && noUpper) return;

    //   if( noLower ){
    //     if(isNaN(nominal)) nominal = upperTolerance
    //     if(isNaN(average)) {
    //       average = nominal
    //       tolInfo = toleranceTypes[1]
    //     } else {
    //       tolInfo = toleranceTypes[0]
    //     }
    //   } else if ( noUpper ) {
    //     if(isNaN(nominal)) nominal = lowerTolerance
    //     if(isNaN(average)) {
    //       average = nominal
    //       tolInfo = toleranceTypes[3]
    //     } else {
    //       tolInfo = toleranceTypes[2]
    //     }
    //   } else {
    //     if (upperTolerance <= lowerTolerance) return;
    //     nominal = ( upperTolerance + lowerTolerance ) / 2;
    //     if(!isNaN(average) && nominal !== average){
    //       if(upperTolerance > average && lowerTolerance < average){
    //         nominal = average;
    //       }
    //     }
    //     lowerTolerance = lowerTolerance - nominal;
    //     upperTolerance = upperTolerance - nominal;
    //     tolInfo = toleranceTypes[4]
    //   }

    //   if (tolInfo === "NotThreshold") {
    //     return Math.abs((upperTolerance - lowerTolerance) / (2 * measurementUncertainty));
    //   } else if (tolInfo === "LowThreshold") {
    //     return Math.abs((average - lowerTolerance) / measurementUncertainty);
    //   } else if (tolInfo === "UpThreshold") {
    //     return Math.abs((upperTolerance - average) / measurementUncertainty);
    //   } else {
    //     return "";
    //   }
    // };

    // PFA FUNCTIONS -------------------------------------------------------------------------------------------------------------------------------------
    function PFAIter(sRiskType, dMeasRel,dAvg,dTolLow,dTolUp,dMeasUnc) {
      let dUUTUnc;

      if (sRiskType === "NotThreshold") {
        dUUTUnc = uutUnc(dMeasRel, dMeasUnc, dTolLow, dTolUp);
        if (dUUTUnc <= 0) return -1;
        return PFA(dUUTUnc, dMeasUnc, dTolLow, dTolUp, dTolLow, dTolUp);
      }

      if (sRiskType === "UpThreshold") {
        dUUTUnc = uutUncUL(dMeasRel, dMeasUnc, dAvg, dTolUp);
        if (dUUTUnc <= 0) return -1;
        return PFAUL(dUUTUnc, dMeasUnc, dAvg, dTolUp, dTolUp);
      }

      if (sRiskType === "LowThreshold") {
        dUUTUnc = uutUncLL(dMeasRel, dMeasUnc, dAvg, dTolLow);
        if (dUUTUnc <= 0) return -1;
        return PFALL(dUUTUnc, dMeasUnc, dAvg, dTolLow, dTolLow);
      }

      return -1;
    };


    function PFA(uUUT, uCal, LLow, LUp, ALow, AUp) {
      const uDev = Math.sqrt(Math.pow(uUUT, 2) + Math.pow(uCal, 2));
      const cor = uUUT / uDev;

      const term1 = bivariateNormalCDF(LLow / uUUT, AUp / uDev, cor) -
                    bivariateNormalCDF(LLow / uUUT, ALow / uDev, cor);

      const term2 = bivariateNormalCDF(-LUp / uUUT, -ALow / uDev, cor) -
                    bivariateNormalCDF(-LUp / uUUT, -AUp / uDev, cor);
      return [term1 + term2, term1, term2, uUUT, uDev, cor];
    };

    function PFALL(uUUT, uCal, avg, LLow, ALow) {
      const uDev = Math.sqrt(Math.pow(uUUT, 2) + Math.pow(uCal, 2));
      const cor = uUUT / uDev;

      const term1 = vbNormSDist((LLow - avg) / uUUT);
      const term2 = bivariateNormalCDF((LLow - avg) / uUUT, (ALow - avg) / uDev, cor);

      return [term1 - term2, term1, term2, uUUT, uDev, cor];
    };

    function PFAUL(uUUT, uCal, avg, LUp, AUp) {
      const uDev = Math.sqrt(Math.pow(uUUT, 2) + Math.pow(uCal, 2));
      const cor = uUUT / uDev;

      const term1 = vbNormSDist((LUp - avg) / uUUT);
      const term2 = bivariateNormalCDF(-(LUp - avg) / uUUT, -(AUp - avg) / uDev, cor);

      return [1 - term1 - term2, term1, term2, uUUT, uDev, cor];
    };

    function PFAMgr(rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel, rngTUR, rngReqTUR) {

      let [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel, bIsThreshold] = getRiskInfo(rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel);

      dMeasRel = calRelwTUR(sRiskType, rngTUR, rngReqTUR,dMeasUnc,dMeasRel,dTolLow,dTolUp,dAvg);

      let dUUTUnc;
      let result = ["","","","","",""];

      if (sRiskType === "NotThreshold") {
        dUUTUnc = uutUnc(dMeasRel, dMeasUnc, dTolLow, dTolUp);
        if (dUUTUnc <= 0) return ["","","","","",""];
        result = PFA(dUUTUnc, dMeasUnc, dTolLow, dTolUp, dTolLow, dTolUp);

      } else if (sRiskType === "UpThreshold") {
        dUUTUnc = uutUncUL(dMeasRel, dMeasUnc, dAvg, dTolUp);
        if (dUUTUnc <= 0) return ["","","","","",""];
        result = PFAUL(dUUTUnc, dMeasUnc, dAvg, dTolUp, dTolUp);

      } else if (sRiskType === "LowThreshold") {
        dUUTUnc = uutUncLL(dMeasRel, dMeasUnc, dAvg, dTolLow);
        if (dUUTUnc <= 0) return ["","","","","",""];
        result = PFALL(dUUTUnc, dMeasUnc, dAvg, dTolLow, dTolLow);

      } else {
        result = ["","","","","",""];
      }

      if (dUUTUnc <= dMeasUnc / 10) {
        result = ["","","","","",""];
      }

      return result;
    };

    // function PFAMgrRewrite(nominal, average, lowerTolerance, upperTolerance, measurementUncertainty, measurementReliability, resultTUR, requiredTUR) {

    //   // Tolerance Information

    //   // Passes Values to Nominal, Average, LowerTolerance, UpperTolerance
    //   const toleranceTypes = ["UpThreshold","AltUpThreshold","LowThreshold","AltLowThreshold","NotThreshold"];
    //   let tolInfo = "";
    //   const noUpper = isNaN(upperTolerance);
    //   const noLower = isNaN(lowerTolerance);
    //   if (noLower && noUpper) return;

    //   if( noLower ){
    //     if(isNaN(nominal)) nominal = upperTolerance
    //     if(isNaN(average)) {
    //       average = nominal
    //       tolInfo = toleranceTypes[1]
    //     } else {
    //       tolInfo = toleranceTypes[0]
    //     }
    //   } else if ( noUpper ) {
    //     if(isNaN(nominal)) nominal = lowerTolerance
    //     if(isNaN(average)) {
    //       average = nominal
    //       tolInfo = toleranceTypes[3]
    //     } else {
    //       tolInfo = toleranceTypes[2]
    //     }
    //   } else {
    //     if (upperTolerance <= lowerTolerance) return;
    //     nominal = ( upperTolerance + lowerTolerance ) / 2;
    //     if(!isNaN(average) && nominal !== average){
    //       if(upperTolerance > average && lowerTolerance < average){
    //         nominal = average;
    //       }
    //     }
    //     lowerTolerance = lowerTolerance - nominal;
    //     upperTolerance = upperTolerance - nominal;
    //     tolInfo = toleranceTypes[4]
    //   }

    //   // Risk Information

    //   // Checks UNC and REL if they're real values
    //   if( (isNaN(measurementUncertainty)) || (isNaN(measurementReliability)) ) return;
      
    //   // Calibration Reliability with TUR

    //   // Changes our Reliability based on our TUR value

    //   // PFA Calculation

    //   // Calculate PFA using bivariate normal distribution

    //   if (tolInfo === "NotThreshold") {
    //     dUUTUnc = uutUnc(dMeasRel, dMeasUnc, dTolLow, dTolUp);
    //     if (dUUTUnc <= 0) return ["","","","","",""];
    //     result = PFA(dUUTUnc, dMeasUnc, dTolLow, dTolUp, dTolLow, dTolUp);

    //   } else if (tolInfo === "UpThreshold") {
    //     dUUTUnc = uutUncUL(dMeasRel, dMeasUnc, dAvg, dTolUp);
    //     if (dUUTUnc <= 0) return ["","","","","",""];
    //     result = PFAUL(dUUTUnc, dMeasUnc, dAvg, dTolUp, dTolUp);

    //   } else if (tolInfo === "LowThreshold") {
    //     dUUTUnc = uutUncLL(dMeasRel, dMeasUnc, dAvg, dTolLow);
    //     if (dUUTUnc <= 0) return ["","","","","",""];
    //     result = PFALL(dUUTUnc, dMeasUnc, dAvg, dTolLow, dTolLow);

    //   } else {
    //     result = ["","","","","",""];
    //   }

    //   if (dUUTUnc <= measurementUncertainty / 10) {
    //     result = ["","","","","",""];
    //   }

    //   return result;
    // };

    // PFR FUNCTIONS -------------------------------------------------------------------------------------------------------------------------------------
    function PFR(uUUT, uCal, LLow, LUp, ALow, AUp) {
      const uDev = Math.sqrt(Math.pow(uUUT, 2) + Math.pow(uCal, 2));
      const cor = uUUT / uDev;

      const term1 = bivariateNormalCDF(LUp / uUUT, ALow / uDev, cor) -
                    bivariateNormalCDF(LLow / uUUT, ALow / uDev, cor);

      const term2 = bivariateNormalCDF(-LLow / uUUT, -AUp / uDev, cor) -
                    bivariateNormalCDF(-LUp / uUUT, -AUp / uDev, cor);

      return [term1 + term2, term1, term2];
    };

    function PFRLL(uUUT, uCal, avg, LLow, ALow) {
      const uDev = Math.sqrt(Math.pow(uUUT, 2) + Math.pow(uCal, 2));
      const cor = uUUT / uDev;

      const term1 = vbNormSDist((LLow - avg) / uUUT);
      const term2 = bivariateNormalCDF(-(LLow - avg) / uUUT, -(ALow - avg) / uDev, cor);

      return [1 - term1 - term2, term1, term2];
    };

    function PFRUL(uUUT, uCal, avg, LUp, AUp) {
      const uDev = Math.sqrt(Math.pow(uUUT, 2) + Math.pow(uCal, 2));
      const cor = uUUT / uDev;

      const term1 = vbNormSDist((LUp - avg) / uUUT);
      const term2 = bivariateNormalCDF((LUp - avg) / uUUT, (AUp - avg) / uDev, cor);

      return [term1 - term2, term1, term2];
    };

    function PFRMgr(rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel, rngTUR, rngReqTUR) {
      let [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel, bIsThreshold] = getRiskInfo(rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel);

      dMeasRel = calRelwTUR(sRiskType, rngTUR, rngReqTUR,dMeasUnc,dMeasRel,dTolLow,dTolUp,dAvg);

      let dUUTUnc;
      let result = ["","",""];

      if (sRiskType === "NotThreshold") {
        dUUTUnc = uutUnc(dMeasRel, dMeasUnc, dTolLow, dTolUp);
        if (dUUTUnc <= 0) return ["","",""];
        result = PFR(dUUTUnc, dMeasUnc, dTolLow, dTolUp, dTolLow, dTolUp);

      } else if (sRiskType === "UpThreshold") {
        dUUTUnc = uutUncUL(dMeasRel, dMeasUnc, dAvg, dTolUp);
        if (dUUTUnc <= 0) return ["","",""];
        result = PFRUL(dUUTUnc, dMeasUnc, dAvg, dTolUp, dTolUp);

      } else if (sRiskType === "LowThreshold") {
        dUUTUnc = uutUncLL(dMeasRel, dMeasUnc, dAvg, dTolLow);
        if (dUUTUnc <= 0) return ["","",""];
        result = PFRLL(dUUTUnc, dMeasUnc, dAvg, dTolLow, dTolLow);

      } else {
        result = ["","",""];
      }

      if (dUUTUnc <= dMeasUnc / 10) {
        result = ["","",""];
      }

      return result;
    };

    // GUARD BAND FUNCTIONS ------------------------------------------------------------------------------------------------------------------------------
    function GetGBInfo(rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel, rngGBLow, rngGBUp) {

      const [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel, bIsThreshold] = getRiskInfo(rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel);

      let dGBLow = vbaNbrValidate(rngGBLow);
      let dGBUp = vbaNbrValidate(rngGBUp);

      if (dGBLow === 0 && dGBUp === 0) {
        return sRiskType;
      }

      if (!bIsThreshold) {
        dGBLow = dGBLow - dNominal;
        dGBUp = dGBUp - dNominal;
      }

      return [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel,dGBLow,dGBUp];
    };

    function pfaGBMult(req, uUUT, uCal, LLow, LUp) {

      const uDev = Math.sqrt(Math.pow(uUUT, 2) + Math.pow(uCal, 2));
      const REOP = vbNormSDist(LUp / uDev) - vbNormSDist(LLow / uDev);

      return RInAccGBMult(req, REOP, uCal, LLow, LUp);
    };

    function pfaLLGBMult(req, uUUT, uCal, avg, LLow) {

      const uDev = Math.sqrt(Math.pow(uUUT, 2) + Math.pow(uCal, 2));
      const REOP = vbNormSDist((avg - LLow) / uDev);

      return RInAccLLGBMult(req, REOP, uCal, avg, LLow);
    };

    function PFAULGBMult(req, uUUT, uCal, avg, LUp) {
      const uDev = Math.sqrt(Math.pow(uUUT, 2) + Math.pow(uCal, 2));
      const REOP = vbNormSDist((LUp - avg) / uDev);

      return RInAccULGBMult(req, REOP, uCal, avg, LUp);
    };

    function RInAccGBMult(req, REOP, uCal, LLow, LUp) {
      const precision = 0.00001;
      let GBMult = 1;
      let AUp = LUp;
      let ALow = LLow;

      let uUUT = uutUnc(REOP, uCal, ALow, AUp);
      let [EstPFA] = PFA(uUUT, uCal, LLow, LUp, ALow, AUp);

      if (EstPFA > req) {
        let change = 0.05;

        do {
          GBMult -= change;
          AUp = LUp * GBMult;
          ALow = LLow * GBMult;
          uUUT = uutUnc(REOP, uCal, ALow, AUp);
          [EstPFA] = PFA(uUUT, uCal, LLow, LUp, ALow, AUp);
        } while (EstPFA > req);

        do {
          change /= 2;
          GBMult += EstPFA < req ? change : -change;
          AUp = LUp * GBMult;
          ALow = LLow * GBMult;
          uUUT = uutUnc(REOP, uCal, ALow, AUp);
          [EstPFA] = PFA(uUUT, uCal, LLow, LUp, ALow, AUp);
        } while (!(EstPFA >= req - precision && EstPFA <= req));
      }

      return GBMult;
    };

    function RInAccULGBMult(req, REOP, uCal, avg, LUp) {
      const precision = 0.00001;
      let GBMult = 1;
      let AUp = LUp;

      let uUUT = uutUncUL(REOP, uCal, avg, AUp);
      let [EstPFA] = PFAUL(uUUT, uCal, avg, LUp, AUp);

      if (EstPFA > req) {
        let change = 0.05;

        do {
          GBMult -= change;
          AUp = (LUp - avg) * GBMult + avg;
          uUUT = uutUncUL(REOP, uCal, avg, AUp);
          [EstPFA] = PFAUL(uUUT, uCal, avg, LUp, AUp);
        } while (EstPFA > req);

        do {
          change /= 2;
          GBMult += EstPFA < req ? change : -change;
          AUp = (LUp - avg) * GBMult + avg;
          uUUT = uutUncUL(REOP, uCal, avg, AUp);
          [EstPFA] = PFAUL(uUUT, uCal, avg, LUp, AUp);
        } while (!(EstPFA >= req - precision && EstPFA <= req));
      }

      return GBMult;
    };

    function RInAccLLGBMult(req, REOP, uCal, avg, LLow) {
      const precision = 0.00001;
      let GBMult = 1;
      let ALow = LLow;

      let uUUT = uutUncLL(REOP, uCal, avg, ALow);
      let [EstPFA] = PFALL(uUUT, uCal, avg, LLow, ALow);

      if (EstPFA > req) {
        let change = 0.05;

        do {
          GBMult -= change;
          ALow = avg - (avg - LLow) * GBMult;
          uUUT = uutUncLL(REOP, uCal, avg, ALow);
          [EstPFA] = PFALL(uUUT, uCal, avg, LLow, ALow);
        } while (EstPFA > req);

        do {
          change /= 2;
          GBMult += EstPFA < req ? change : -change;
          ALow = avg - (avg - LLow) * GBMult;
          uUUT = uutUncLL(REOP, uCal, avg, ALow);
          [EstPFA] = PFALL(uUUT, uCal, avg, LLow, ALow);
        } while (!(EstPFA >= req - precision && EstPFA <= req));
      }

      return GBMult;
    };

    function gbLowMgr(rngReq, rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel) {

      const [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel] = getRiskInfo(rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel);

      const dReq = vbaNbrValidate(rngReq);

      let dUUTUnc, GBMult;

      if (sRiskType === "NotThreshold") {
          dUUTUnc = uutUnc(dMeasRel, dMeasUnc, dTolLow, dTolUp);
          if (dUUTUnc <= 0) {
              return "";
          } else {
              GBMult = pfaGBMult(dReq, dUUTUnc, dMeasUnc, dTolLow, dTolUp);
              return dNominal + dTolLow * GBMult;
          }
      } else if (sRiskType === "LowThreshold") {
          dUUTUnc = uutUncLL(dMeasRel, dMeasUnc, dAvg, dTolLow);
          if (dUUTUnc <= 0) {
              return "";
          } else {
              GBMult = pfaLLGBMult(dReq, dUUTUnc, dMeasUnc, dAvg, dTolLow);
              return dAvg - (dAvg - dTolLow) * GBMult;
          }
      } else if (sRiskType === "AltLowThreshold") {
          return dTolLow - PHIDInv(dReq) * dMeasUnc;
      } else {
          return "";
      }
    };
    
    function gbUpMgr(rngReq, rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel) {

      const [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel] = getRiskInfo(rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel);

      const dReq = vbaNbrValidate(rngReq);

      let dUUTUnc, GBMult;

      if (sRiskType === "NotThreshold") {
        dUUTUnc = uutUnc(dMeasRel, dMeasUnc, dTolLow, dTolUp);
        if (dUUTUnc <= 0) {
          return "";
        } else {
          GBMult = pfaGBMult(dReq, dUUTUnc, dMeasUnc, dTolLow, dTolUp);
          return dTolUp * GBMult + dNominal;
        }
      } else if (sRiskType === "UpThreshold") {
        dUUTUnc = uutUncUL(dMeasRel, dMeasUnc, dAvg, dTolUp);
        if (dUUTUnc <= 0) {
          return "";
        } else {
          GBMult = PFAULGBMult(dReq, dUUTUnc, dMeasUnc, dAvg, dTolUp);
          return (dTolUp - dAvg) * GBMult + dAvg;
        }
      } else if (sRiskType === "AltUpThreshold") {
        return dTolUp + PHIDInv(dReq) * dMeasUnc;
      } else {
        return "";
      }
    };

    function GBMultMgr(rngReq, rngNominal, rngAvg, rngTolLow, rngTolUp, rngGBLow, rngGBUp) {

      const [sRiskType, dNominal, dAvg, dTolLow, dTolUp] = getTolInfo(rngNominal, rngAvg, rngTolLow, rngTolUp);

      const dReq = vbaNbrValidate(rngReq);
      const dGBLow = vbaNbrValidate(rngGBLow);
      const dGBUp = vbaNbrValidate(rngGBUp);

      if (dGBLow === 0 && dGBUp === 0) {
        return "";
      }

      let GBMult;

      if (sRiskType === "NotThreshold") {
        GBMult = Math.abs(dTolUp) > 0
          ? Math.abs(dGBUp - dNominal) / Math.abs(dTolUp)
          : "";
      } else if (sRiskType === "UpThreshold") {
        GBMult = Math.abs(dTolUp - dAvg) > 0
          ? Math.abs(dGBUp - dAvg) / Math.abs(dTolUp - dAvg)
          : "";
      } else if (sRiskType === "LowThreshold") {
        GBMult = Math.abs(dAvg - dTolLow) > 0
          ? Math.abs(dAvg - dGBLow) / Math.abs(dAvg - dTolLow)
          : "";
      } else {
        GBMult = "";
      }

      return GBMult;
    };

    function PFAwGBMgr(rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel, rngGBLow, rngGBUp) {
      const [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel,dGBLow,dGBUp] = GetGBInfo(
        rngNominal,
        rngAvg,
        rngTolLow,
        rngTolUp,
        rngMeasUnc,
        rngMeasRel,
        rngGBLow,
        rngGBUp
      );

      if (dGBLow === 0 && dGBUp === 0) {
        return "";
      }

      let dUUTUnc;

      if (sRiskType === "NotThreshold") {
        dUUTUnc = uutUnc(dMeasRel, dMeasUnc, dGBLow, dGBUp);
        if (dUUTUnc <= 0) return "";
        return PFA(dUUTUnc, dMeasUnc, dTolLow, dTolUp, dGBLow, dGBUp);
      }

      if (sRiskType === "UpThreshold") {
        dUUTUnc = uutUncLL(dMeasRel, dMeasUnc, dAvg, dGBUp);
        if (dUUTUnc <= 0) return "";
        return PFAUL(dUUTUnc, dMeasUnc, dAvg, dTolUp, dGBUp);
      }

      if (sRiskType === "LowThreshold") {
        dUUTUnc = uutUncLL(dMeasRel, dMeasUnc, dAvg, dGBLow);
        if (dUUTUnc <= 0) return "";
        return PFALL(dUUTUnc, dMeasUnc, dAvg, dTolLow, dGBLow);
      }

      if (sRiskType === "AltUpThreshold") {
        return PHID((dGBUp - dTolUp) / dMeasUnc);
      }

      if (sRiskType === "AltLowThreshold") {
        return PHID((dTolLow - dGBLow) / dMeasUnc);
      }

      return "";
    };

    function PFRwGBMgr(rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel, rngGBLow, rngGBUp) {
      const [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel,dGBLow,dGBUp] = GetGBInfo(
        rngNominal,
        rngAvg,
        rngTolLow,
        rngTolUp,
        rngMeasUnc,
        rngMeasRel,
        rngGBLow,
        rngGBUp
      );

      if (dGBLow === 0 && dGBUp === 0) {
        return "";
      }

      let dUUTUnc;

      if (sRiskType === "NotThreshold") {
        dUUTUnc = uutUnc(dMeasRel, dMeasUnc, dGBLow, dGBUp);
        if (dUUTUnc <= 0) return "";
        return PFR(dUUTUnc, dMeasUnc, dTolLow, dTolUp, dGBLow, dGBUp);
      }

      if (sRiskType === "UpThreshold") {
        dUUTUnc = uutUncUL(dMeasRel, dMeasUnc, dAvg, dGBUp);
        if (dUUTUnc <= 0) return "";
        return PFRUL(dUUTUnc, dMeasUnc, dAvg, dTolUp, dGBUp);
      }

      if (sRiskType === "LowThreshold") {
        dUUTUnc = uutUncLL(dMeasRel, dMeasUnc, dAvg, dGBLow);
        if (dUUTUnc <= 0) return "";
        return PFRLL(dUUTUnc, dMeasUnc, dAvg, dTolLow, dGBLow);
      }

      return "";
    };

    function CalIntwGBMgr(
      rngNominal,
      rngAvg,
      rngTolLow,
      rngTolUp,
      rngMeasUnc,
      rngReqRel,
      rngMeasRel,
      rngGBLow,
      rngGBUp,
      rngTUR,
      rngReqTUR,
      rngInt
    ) {

      const [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel,dGBLow,dGBUp] = GetGBInfo(
        rngNominal,
        rngAvg,
        rngTolLow,
        rngTolUp,
        rngMeasUnc,
        rngMeasRel,
        rngGBLow,
        rngGBUp
      );

      const dReqRel = vbaNbrValidate(rngReqRel);
      const dTUR = vbaNbrValidate(rngTUR);
      const dReqTur = vbaNbrValidate(rngReqTUR);
      const dInt = vbaNbrValidate(rngInt);

      if (dGBLow === 0 && dGBUp === 0) {
        return "";
      }

      if (
        sRiskType !== "NotThreshold" &&
        sRiskType !== "UpThreshold" &&
        sRiskType !== "LowThreshold"
      ) {
        return "";
      }

      let dObsRel;
      if (dReqTur > 0) {
        const dTstRUnc = dMeasUnc * dTUR / dReqTur;
        dObsRel = ObsRel(sRiskType, dTstRUnc, dMeasRel,dAvg,dTolLow,dTolUp,dMeasUnc);
      } else {
        dObsRel = dMeasRel;
      }

      const dPredRel = PredRel(sRiskType, dMeasUnc, dReqRel,dAvg,dTolLow,dTolUp,dMeasUnc,dGBLow,dGBUp);
      const dPredInt = Math.log(dPredRel) / Math.log(dObsRel) * dInt;

      return dPredInt > 0 ? dPredInt : "";
    };

    function CalIntMgr(
      rngNominal,
      rngAvg,
      rngTolLow,
      rngTolUp,
      rngMeasUnc,
      rngReqRel,
      rngMeasRel,
      rngTUR,
      rngReqTUR,
      rngInt,
      rngReqPFA
    ) {

      const [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel,dGBLow,dGBUp] = getRiskInfo(
        rngNominal,
        rngAvg,
        rngTolLow,
        rngTolUp,
        rngMeasUnc,
        rngMeasRel
      );

      const dTUR = vbaNbrValidate(rngTUR);
      const dReqTur = vbaNbrValidate(rngReqTUR);
      const dInt = vbaNbrValidate(rngInt);
      const dReqRel = vbaNbrValidate(rngReqRel);
      const dReqPFA = vbaNbrValidate(rngReqPFA);

      let dObsRel;
      if (dReqTur > 0) {
        const dTstRUnc = dMeasUnc * dTUR / dReqTur;
        dObsRel = ObsRel(sRiskType, dTstRUnc, dMeasRel, dAvg,dTolLow,dTolUp,dMeasUnc);
      } else {
        dObsRel = dMeasRel;
      }

      let [dPFA] = PFAIter(sRiskType, dObsRel,dAvg,dTolLow,dTolUp,dMeasUnc);
      if (dPFA === -1) return "";

      if (dPFA <= dReqPFA) {
        return Math.log(dReqRel) / Math.log(dObsRel) * dInt;
      }

      let dPredRel = 1 - Math.abs(1 - dObsRel) / 2;
      [dPFA] = PFAIter(sRiskType, dPredRel,dAvg,dTolLow,dTolUp,dMeasUnc);

      let dChg = dPFA < dReqPFA
        ? -Math.abs(dPredRel - dObsRel)
        : Math.abs(dPredRel - dObsRel);

      let lIter = 1;
      while (Math.abs(dPFA - dReqPFA) >= 0.00001 && lIter < 20) {
        dChg = dPFA < dReqPFA ? -Math.abs(dChg) / 2 : Math.abs(dChg) / 2;
        dPredRel += dChg;
        [dPFA] = PFAIter(sRiskType, dPredRel,dAvg,dTolLow,dTolUp,dMeasUnc);
        lIter++;
      }

      if (dPredRel < dReqRel) {
        dPredRel = dReqRel;
        [dPFA] = PFAIter(sRiskType, dPredRel,dAvg,dTolLow,dTolUp,dMeasUnc);
      }

      return dPFA === -1 ? "" : Math.log(dPredRel) / Math.log(dObsRel) * dInt;
    };

    function CalRelMgr(
      rngNominal,
      rngAvg,
      rngTolLow,
      rngTolUp,
      rngMeasUnc,
      rngReqRel,
      rngMeasRel,
      rngTUR,
      rngReqTUR,
      rngInt,
      rngReqPFA
    ) {

      const [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel,dGBLow,dGBUp] = getRiskInfo(
        rngNominal,
        rngAvg,
        rngTolLow,
        rngTolUp,
        rngMeasUnc,
        rngMeasRel
      );

      const dTUR = vbaNbrValidate(rngTUR);
      const dReqTur = vbaNbrValidate(rngReqTUR);
      const dInt = vbaNbrValidate(rngInt);
      const dReqRel = vbaNbrValidate(rngReqRel);
      const dReqPFA = vbaNbrValidate(rngReqPFA);

      let dObsRel;
      if (dReqTur > 0) {
        const dTstRUnc = dMeasUnc * dTUR / dReqTur;
        dObsRel = ObsRel(sRiskType, dTstRUnc, dMeasRel, dAvg,dTolLow,dTolUp,dMeasUnc);
      } else {
        dObsRel = dMeasRel;
      }

      let [dPFA] = PFAIter(sRiskType, dObsRel);
      if (dPFA === -1) return "";

      if (dPFA <= dReqPFA) return dReqRel;

      let dPredRel = 1 - Math.abs(1 - dObsRel) / 2;
      [dPFA] = PFAIter(sRiskType, dPredRel);

      let dChg = dPFA < dReqPFA
        ? -Math.abs(dPredRel - dObsRel)
        : Math.abs(dPredRel - dObsRel);

      let lIter = 1;
      while (Math.abs(dPFA - dReqPFA) >= 0.00001 && lIter < 20) {
        dChg = dPFA < dReqPFA ? -Math.abs(dChg) / 2 : Math.abs(dChg) / 2;
        dPredRel += dChg;
        [dPFA] = PFAIter(sRiskType, dPredRel);
        lIter++;
      }

      if (dPredRel < dReqRel) {
        dPredRel = dReqRel;
        [dPFA] = PFAIter(sRiskType, dPredRel);
      }

      return dPFA === -1 ? "" : dPredRel;
    };

    let tarResult = calcTAR(uutNominal.value, 0, LLow, LUp, parseFloat(uutNominal.value) + tmdeToleranceLow_Native, parseFloat(uutNominal.value) + tmdeToleranceHigh_Native);
    let turResult = calcTUR(uutNominal.value, 0, LLow, LUp,calcResults.expanded_uncertainty_absolute_base);
    let [pfaResult, pfa_term1, pfa_term2, uUUT, uDev, cor] = PFAMgr(uutNominal.value, 0, LLow, LUp, calcResults.combined_uncertainty_absolute_base, reliability, turResult ,turNeeded);
    let [pfrResult, pfr_term1, pfr_term2] = PFRMgr(uutNominal.value, 0, LLow, LUp, calcResults.combined_uncertainty_absolute_base, reliability, turResult ,turNeeded);
    let gbLow = resDwn(gbLowMgr(pfaRequired, uutNominal.value, 0, LLow, LUp, calcResults.combined_uncertainty_absolute_base, reliability),parseFloat(testPointData.uutTolerance.measuringResolution));
    let gbHigh = resUp(gbUpMgr(pfaRequired, uutNominal.value, 0, LLow, LUp, calcResults.combined_uncertainty_absolute_base, reliability),parseFloat(testPointData.uutTolerance.measuringResolution));
    let gbMult = GBMultMgr(pfaRequired, uutNominal.value, 0, LLow, LUp, gbLow, gbHigh);
    let [gbPFA, gbPFAT1, gbPFAT2] = PFAwGBMgr(uutNominal.value, 0, LLow, LUp, calcResults.combined_uncertainty_absolute_base, reliability, gbLow, gbHigh);
    let [gbPFR, gbPFRT1, gbPFRT2] = PFRwGBMgr(uutNominal.value, 0, LLow, LUp, calcResults.combined_uncertainty_absolute_base, reliability, gbLow, gbHigh);
    let gbCalInt = CalIntwGBMgr(uutNominal.value, 0, LLow, LUp, calcResults.combined_uncertainty_absolute_base, reliability, measRelCalc, gbLow, gbHigh, turResult, turNeeded, calInt);
    let nogbCalInt = CalIntMgr(uutNominal.value, 0, LLow, LUp, calcResults.combined_uncertainty_absolute_base, reliability, measRelCalc, turResult, turNeeded, calInt, pfaRequired);
    let nogbMeasRel = CalRelMgr(uutNominal.value, 0, LLow, LUp, calcResults.combined_uncertainty_absolute_base, reliability, measRelCalc, turResult, turNeeded, calInt, pfaRequired);
    let gbResults = {GBLOW: gbLow, GBUP: gbHigh, GBMULT: gbMult * 100, GBPFA: gbPFA * 100, GBPFAT1: gbPFAT1 * 100, GBPFAT2: gbPFAT2 * 100, GBPFR: gbPFR * 100, GBPFRT1: gbPFRT1 * 100, GBPFRT2: gbPFRT2 * 100, GBCALINT: gbCalInt, NOGBCALINT: nogbCalInt, NOGBMEASREL: nogbMeasRel * 100};

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
      gbResults: gbResults
    };

    setRiskResults(newRiskMetrics);
    onDataSave({ riskMetrics: newRiskMetrics });

    }, [
    riskInputs.LLow,
    riskInputs.LUp,
    sessionData,
    uutNominal,
    calcResults,
    uutToleranceData,
    tmdeTolerancesData,
    setNotification,
    onDataSave,
    setRiskResults
  ]);

  useEffect(() => {
  const shouldCalculate = (analysisMode === "risk" || analysisMode === "uncertaintyTool" || analysisMode === "riskmitigation");

  if (shouldCalculate && calcResults) {
    calculateRiskMetrics();
  }

  // If we are NOT on a tab that shows risk, clear the results
  if (!shouldCalculate) {
    setRiskResults(prevResults => {
      if (prevResults !== null) {
        onDataSave({ riskMetrics: null }); 
        return null;
      }
      return prevResults;
    });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [
  // This hook should ONLY depend on the data that triggers a new calculation
  analysisMode, 
  calcResults, 
  sessionData.uncReq.reliability, 
  sessionData.uncReq.guardBandMultiplier,
  riskInputs.LLow, // This was missing but is a key input
  riskInputs.LUp   // This was missing but is a key input
]);

  // Effect to update risk input tolerances when UUT tolerance changes
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
      (comp) => comp.absoluteHigh !== undefined && comp.absoluteLow !== undefined
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
          // If it was somehow calculated before, clear it
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
      const targetUnitInfo = unitSystem.units[derivedNominalUnit]; // For conversions

      const derivedQuantityName = uutNominal.name || "Derived";

      if (!targetUnitInfo || isNaN(targetUnitInfo.to_si)) {
        throw new Error(
          `Derived unit '${derivedNominalUnit}' is not valid or has no SI conversion.`
        );
      }

      if (testPointData.measurementType === "derived") {
        const {
          combinedUncertaintyNative, // This is the intermediate value
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
        let totalVariance_Native = derivedUcInputs_Native ** 2; // Start with variance from inputs

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
            name: `Input: ${item.type} (${item.variable})`, // This name is used for filtering
            type: "B",
            value: item.ui_absolute_base, // ui in base units
            unit: item.unit, // input's original unit
            isBaseUnitValue: true,
            sensitivityCoefficient: item.ci,
            derivativeString: item.derivativeString,
            contribution: item.contribution_native, // Pass NATIVE contribution
            dof: Infinity,
            isCore: true,
            distribution: distributionLabel,
            sourcePointLabel: `${item.nominal} ${item.unit || ""}`,
            quantity: totalQuantity
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
              quantity: 1
            });
          } else {
            console.warn(
              "Cannot calculate resolution contribution: Invalid base nominal."
            );
          }
        }

        const combinedUncertainty_Native = Math.sqrt(totalVariance_Native); // This is the FINAL uncertainty
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
          } else {
            console.warn("Cannot convert final derived uncertainty to PPM.");
          }
        } else {
          console.warn("Cannot convert final derived uncertainty to PPM.");
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

        totalVariancePPM = 0; // Reset
        uutResolutionComponents.forEach((comp) => {
          totalVariancePPM += comp.value ** 2;
          componentsForBudgetTable.push(comp);
        });
        
        tmdeTolerancesData.forEach(tmde => {
          if (tmde.measurementPoint && tmde.measurementPoint.value) {
            const quantity = tmde.quantity || 1;
            const components = getBudgetComponentsFromTolerance(
              tmde,
              tmde.measurementPoint
            ).map((c) => ({
              ...c,
              sourcePointLabel: `${uutNominal.value} ${uutNominal.unit}`,
              quantity: quantity
            }));

            componentsForBudgetTable.push(...components);
            
            components.forEach(comp => {
              totalVariancePPM += (comp.value ** 2) * quantity;
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
  ]);

  // Context Menu Handler for Budget Table Rows
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
    }
  };

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

    if (newComponent.type === "A") {
      const stdUnc = parseFloat(newComponent.standardUncertainty);
      if (isNaN(stdUnc) || stdUnc <= 0 || isNaN(dof) || dof < 1) {
        setNotification({
          title: "Invalid Input",
          message: "For Type A, provide valid positive Std Unc and DoF (>=1).",
        });
        return;
      }
      const { value: ppm, warning } = convertToPPM(
        stdUnc,
        newComponent.unit,
        uutNominal?.value,
        uutNominal?.unit,
        true
      );
      if (warning) {
        setNotification({ title: "Conversion Error", message: warning });
        return;
      }
      valueInPPM = ppm;
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
        true
      );
      if (warning) {
        setNotification({ title: "Conversion Error", message: warning });
        return;
      }
      valueInPPM = ppm / divisor;
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
    const componentToAdd = {
      ...newComponent,
      id: Date.now(),
      value: valueInPPM,
      dof,
      distribution: distributionLabel,
    };
    const updatedComponents = [...manualComponents, componentToAdd];
    onDataSave({ components: updatedComponents });
    setNewComponent({
      name: "",
      type: "B",
      errorDistributionDivisor: "1.732",
      toleranceLimit: "",
      unit: "ppm",
      standardUncertainty: "",
      dof: "Infinity",
    });
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

  const handleNewComponentInputChange = (e) =>
    setNewComponent((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const unitOptions = useMemo(() => {
    const nominalUnit = uutNominal?.unit;
    if (!nominalUnit) return ["ppm"];
    const relevant = unitSystem.getRelevantUnits(nominalUnit);
    return ["ppm", ...relevant.filter((u) => u !== "ppm" && u !== "dB")];
  }, [uutNominal]);

  const renderSpecComparison = () => {
    if (!calcResults) {
      return (
        <div className="form-section-warning">
          <p>An uncertainty budget must be calculated first.</p>
        </div>
      );
    }
    const handleSpecInputChange = (e) => {
      const newSpecInput = {
        ...specInput,
        [e.target.name]: {
          ...specInput[e.target.name],
          [e.target.dataset.field]: e.target.value,
        },
      };
      onDataSave({ specifications: newSpecInput });
    };
    const ComparisonCard = ({ title, specData, userUncertainty, kUser }) => {
      const U_user = userUncertainty;
      const U_spec = parseFloat(specData.uncertainty);
      const k_spec = parseFloat(specData.k);
      let status = "Not Defined";
      let statusClass = "";
      let percentageOfSpec = null;
      if (!isNaN(U_spec) && U_spec > 0) {
        percentageOfSpec = (U_user / U_spec) * 100;
        statusClass = "status-good";
        status = "Within Specification";
        if (percentageOfSpec > 100) {
          status = "Exceeds Specification";
          statusClass = "status-bad";
        } else if (percentageOfSpec > 90) {
          status = "Approaching Limit";
          statusClass = "status-warning";
        }
      }
      return (
        <div className={`spec-dashboard ${statusClass}`}>
          <h4>{title}</h4>
          <div className="spec-details-container full-width">
            <div className="spec-detail-card user-spec">
              <span className="detail-label">Expanded Unc (U)</span>
              <span className="detail-value">{U_user.toFixed(3)} ppm</span>
              <span className="detail-sub-value">k ≈ {kUser.toFixed(2)}</span>
            </div>
            <div className="spec-detail-card mfg-spec">
              <span className="detail-label">{title} (U)</span>
              <span className="detail-value">
                {!isNaN(U_spec) ? `${U_spec.toFixed(3)} ppm` : "N/A"}
              </span>
              <span className="detail-sub-value">
                {!isNaN(k_spec) ? `k = ${k_spec.toFixed(2)}` : ""}
              </span>
            </div>
          </div>
          {percentageOfSpec !== null && (
            <div className="spec-status-footer">
              <strong>Status:</strong> {status} ({percentageOfSpec.toFixed(1)}%)
            </div>
          )}
        </div>
      );
    };
    return (
      <div>
        <div className="spec-input-container">
          <div className="spec-input-column">
            <h5>Manufacturer Specs</h5>
            <label>Spec (± ppm)</label>
            <input
              type="number"
              name="mfg"
              data-field="uncertainty"
              value={specInput.mfg.uncertainty || ""}
              onChange={handleSpecInputChange}
            />
            <label>k-factor</label>
            <input
              type="number"
              name="mfg"
              data-field="k"
              value={specInput.mfg.k || ""}
              onChange={handleSpecInputChange}
            />
          </div>
          <div className="spec-input-column">
            <h5>Navy Requirements</h5>
            <label>Requirement (± ppm)</label>
            <input
              type="number"
              name="navy"
              data-field="uncertainty"
              value={specInput.navy.uncertainty || ""}
              onChange={handleSpecInputChange}
            />
            <label>k-factor</label>
            <input
              type="number"
              name="navy"
              data-field="k"
              value={specInput.navy.k || ""}
              onChange={handleSpecInputChange}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
          <ComparisonCard
            title="Manufacturer Specification"
            specData={specInput.mfg}
            userUncertainty={calcResults.expanded_uncertainty}
            kUser={calcResults.k_value}
          />
          <ComparisonCard
            title="Navy Requirement"
            specData={specInput.navy}
            userUncertainty={calcResults.expanded_uncertainty}
            kUser={calcResults.k_value}
          />
        </div>
      </div>
    );
  };

  const renderAddComponentModal = () => {
    if (!isAddComponentModalOpen) return null;
    return (
      <div className="modal-overlay">
        <div className="modal-content" style={{ maxWidth: "800px" }}>
          <button
            onClick={() => setAddComponentModalOpen(false)}
            className="modal-close-button"
          >
            &times;
          </button>
          <h3>Add Manual Uncertainty Component</h3>
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
                    type="text"
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
              className="button button-secondary"
              onClick={() => setAddComponentModalOpen(false)}
            >
              Cancel
            </button>
            <button onClick={handleAddComponent} className="button">
              Add Component
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

      {breakdownModal === "inputs" && (
        <InputsBreakdownModal
          results={riskResults}
          inputs={{
            LLow: parseFloat(riskInputs.LLow),
            LUp: parseFloat(riskInputs.LUp),
            reliability: parseFloat(sessionData.uncReq.reliability),
            guardBandMultiplier: parseFloat(sessionData.uncReq.guardBandMultiplier),
          }}
          onClose={() => setLocalBreakdownModal(null)}
        />
      )}
      {breakdownModal === "tur" && (
        <TurBreakdownModal
          results={riskResults}
          inputs={{
            LLow: parseFloat(riskInputs.LLow),
            LUp: parseFloat(riskInputs.LUp),
            reliability: parseFloat(sessionData.uncReq.reliability),
            guardBandMultiplier: parseFloat(sessionData.uncReq.guardBandMultiplier),
          }}
          onClose={() => setLocalBreakdownModal(null)}
        />
      )}
      {breakdownModal === "tar" && (
        <TarBreakdownModal
          results={riskResults}
          inputs={{
            LLow: parseFloat(riskInputs.LLow),
            LUp: parseFloat(riskInputs.LUp),
            reliability: parseFloat(sessionData.uncReq.reliability),
            guardBandMultiplier: parseFloat(sessionData.uncReq.guardBandMultiplier),
          }}
          onClose={() => setLocalBreakdownModal(null)}
        />
      )}
      {breakdownModal === "pfa" && (
        <PfaBreakdownModal
          results={riskResults}
          inputs={{
            LLow: parseFloat(riskInputs.LLow),
            LUp: parseFloat(riskInputs.LUp),
            reliability: parseFloat(sessionData.uncReq.reliability),
            guardBandMultiplier: parseFloat(sessionData.uncReq.guardBandMultiplier),
          }}
          onClose={() => setLocalBreakdownModal(null)}
        />
      )}
      {breakdownModal === "pfr" && (
        <PfrBreakdownModal
          results={riskResults}
          inputs={{
            LLow: parseFloat(riskInputs.LLow),
            LUp: parseFloat(riskInputs.LUp),
            reliability: parseFloat(sessionData.uncReq.reliability),
            guardBandMultiplier: parseFloat(sessionData.uncReq.guardBandMultiplier),
          }}
          onClose={() => setLocalBreakdownModal(null)}
        />
      )}

      <div className="analysis-tabs">
        <button
          className={analysisMode === "uncertaintyTool" ? "active" : ""}
          onClick={() => setAnalysisMode("uncertaintyTool")}
        >
          Uncertainty Tool
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
        {/* <button
          className={analysisMode === "spec" ? "active" : ""}
          onClick={() => setAnalysisMode("spec")}
        >
          Specification Comparison
        </button> */}
      </div>

      {analysisMode === "uncertaintyTool" && (
        <div className="analysis-dashboard">
          <AddTmdeModal
            isOpen={isAddTmdeModalOpen}
            onClose={() => setAddTmdeModalOpen(false)}
            onSave={handleSaveTmde}
            testPointData={testPointData}
          />
          <div className="configuration-panel">
            <h4 className="uut-components-title">Unit Under Test</h4>
            <div className="uut-seal-container">
              <div
                className={`uut-seal ${
                  testPointData.measurementType === "derived"
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
                        : `${uutNominal?.value ?? ""} ${
                            uutNominal?.unit ?? ""
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
                            onClick={() =>
                              handleOpenSessionEditor("tmdes", {
                                tmde,
                                testPoint: testPointData,
                              })
                            }
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
                      onClick={() =>
                        handleOpenSessionEditor("tmdes", {
                          tmde,
                          testPoint: testPointData,
                        })
                      }
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
                            action: () => handleOpenSessionEditor("tmdes", { tmde, testPoint: testPointData }),
                            icon: faPencilAlt,
                          },
                          { type: "divider" }
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
                          <span>Std. Unc (u<sub>i</sub>)</span>
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
                                ? `${uAbs.toPrecision(3)} ${referencePoint.unit}`
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
            {/* <Accordion title="Uncertainty Budget" startOpen={true}> */}
            <>
              {calculationError ? (
              <div className="form-section-warning">
                <p><strong>Calculation Error:</strong> {calculationError}</p>
                <p style={{ marginTop: '5px', fontSize: '0.9rem', color: 'var(--text-color-muted)'}}>
                  Please ensure all required fields are set (e.g., UUT nominal, equation, and all mapped TMDEs).
                </p>
              </div>
            ) : (
              <>
                <UncertaintyBudgetTable
                  components={calcResults?.calculatedBudgetComponents || []}
                  onRemove={handleRemoveComponent}
                  calcResults={calcResults}
                  referencePoint={uutNominal}
                  uncertaintyConfidence={sessionData.uncReq.uncertaintyConfidence}
                  onRowContextMenu={handleBudgetRowContextMenu}
                  equationString={testPointData.equationString}
                  measurementType={testPointData.measurementType}
                  riskResults={riskResults}
                  onShowDerivedBreakdown={handleShowDerivedBreakdown}
                  onShowRiskBreakdown={(modalType) =>
                    setLocalBreakdownModal(modalType)
                }
                />
                {calcResults?.calculatedBudgetComponents && (
                  <PercentageBarGraph inputs={Object.fromEntries(calcResults.calculatedBudgetComponents.map(item => [item.name, item.value_native]))} />
                )}
              </>
            )}
            </>
            {/* </Accordion> */}
          </div>
        </div>
      )}
      {analysisMode === "risk" && (
        <div>
    {/* <Accordion title="Risk & Conformance Analysis" startOpen={true}> */}
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
              {/* --- ADD THIS COMPONENT --- */}
              <RiskScatterplot
                results={riskResults}
                inputs={{
                  LLow: parseFloat(riskInputs.LLow),
                  LUp: parseFloat(riskInputs.LUp),
                }}
              />
            </>
          ) : (
            <div className="placeholder-content" style={{ minHeight: "200px" }}>
              <p>Calculating risk...</p>
            </div>
          )}
        </>
      )}
      </>
    {/* </Accordion> */}
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
            <div className="placeholder-content" style={{ minHeight: "200px" }}>
              <p>Calculating risk...</p>
            </div>
          )}
        </>
      )}
    </>
  )}
      {analysisMode === "spec" && (
        // <Accordion title="Specification Comparison Analysis (Not Fully Implemented)" startOpen={true}>
        <>
        {renderSpecComparison()}
        </>
        // </Accordion>
      )}
    </div>
  );
}

function App() {
  const defaultTestPoint = useMemo(
    () => ({
      section: "",
      tmdeDescription: "",
      tmdeTolerances: [],
      specifications: {
        mfg: { uncertainty: "", k: 2 },
        navy: { uncertainty: "", k: 2 },
      },
      components: [],
      is_detailed_uncertainty_calculated: false,
      measurementType: "direct", // 'direct' or 'derived'
      equationString: "", // e.g., "V / I"
      variableMappings: {},
      testPointInfo: {
        parameter: { name: "", value: "", unit: "" },
        qualifier: null,
      },
    }),
    []
  );

  const createNewSession = useCallback(
    () => ({
      id: Date.now(),
      name: "New Session",
      uutDescription: "",
      analyst: "",
      organization: "",
      document: "",
      documentDate: "",
      notes: "",
      noteImages: [],
      uutTolerance: {},
      testPoints: [],
      uncReq: {
        uncertaintyConfidence: 95,
        reliability:  85,
        calInt: 12,
        measRelCalcAssumed: 85,
        neededTUR: 4,
        reqPFA: 2,
        guardBandMultiplier: 1
      }
    }),
    []
  );

  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [selectedTestPointId, setSelectedTestPointId] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTestPoint, setEditingTestPoint] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [isToleranceModalOpen, setIsToleranceModalOpen] = useState(false);
  const [breakdownPoint, setBreakdownPoint] = useState(null);
  const [infoModalPoint, setInfoModalPoint] = useState(null);
  const [initialSessionTab, setInitialSessionTab] = useState("details");
  const [initialTmdeToEdit, setInitialTmdeToEdit] = useState(null);
  const [riskResults, setRiskResults] = useState(null);
  const [appNotification, setAppNotification] = useState(null);
  const [sessionImageCache, setSessionImageCache] = useState(new Map());

  const handleOpenSessionEditor = (
    initialTab = "details",
    tmdeToEdit = null
  ) => {
    setInitialSessionTab(initialTab);
    setInitialTmdeToEdit(tmdeToEdit);
    setEditingSession(currentSessionData);
  };

  useEffect(() => {
    let loadedData = false;
    const defaultSession = createNewSession();

    try {
      const savedSessions = localStorage.getItem("uncertaintySessions");
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const migratedSessions = parsed.map(session => ({
            ...defaultSession,
            ...session,
            id: session.id,
            name: session.name || defaultSession.name,
          }));

          setSessions(migratedSessions);
          setSelectedSessionId(migratedSessions[0].id);
          setSelectedTestPointId(migratedSessions[0].testPoints?.[0]?.id || null);
          loadedData = true;
        }
      }
    } catch (error) {
      console.error("Failed to load data from localStorage", error);
    }

    if (!loadedData) {
      const firstSession = defaultSession; // Use the default we already created
      setSessions([firstSession]);
      setSelectedSessionId(firstSession.id);
      setEditingSession(firstSession);
    }
  }, [createNewSession]);

  useEffect(() => {
    if (sessions.length > 0) {
      try {
        localStorage.setItem("uncertaintySessions", JSON.stringify(sessions));
      } catch (error) {
        console.error("Failed to save data to localStorage", error);
      }
    }
  }, [sessions]);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  }, [isDarkMode]);

  const handleCloseContextMenu = useCallback(() => setContextMenu(null), []);

  const handleAddNewSession = () => {
    const newSession = createNewSession();
    setSessions((prev) => [...prev, newSession]);
    setSelectedSessionId(newSession.id);
    setSelectedTestPointId(null);
    setEditingSession(newSession);
  };

  const handleDeleteSession = (sessionId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this session and all its measurement points?"
      )
    )
      return;

    setSessions((prev) => {
      const newSessions = prev.filter((s) => s.id !== sessionId);
      if (selectedSessionId === sessionId) {
        const newSelectedId = newSessions[0]?.id || null;
        setSelectedSessionId(newSelectedId);
        setSelectedTestPointId(newSessions[0]?.testPoints?.[0]?.id || null);
      }
      if (newSessions.length === 0) {
        const firstSession = createNewSession();
        setEditingSession(firstSession);
        setSelectedSessionId(firstSession.id);
        setSelectedTestPointId(null);
        return [firstSession];
      }
      return newSessions;
    });
  };

  const handleSessionChange = (updatedSession, newImageFiles = []) => {
    setSessions((prevSessions) => 
      prevSessions.map((s) => (s.id === updatedSession.id ? updatedSession : s))
    );

    // Update the image cache with the new files
    if (newImageFiles.length > 0) {
      setSessionImageCache((prevCache) => {
        const newCache = new Map(prevCache);
        const sessionCache = new Map(newCache.get(updatedSession.id) || []);

        newImageFiles.forEach((img) => {
          sessionCache.set(img.id, img.fileObject); // Store the actual File object
        });

        newCache.set(updatedSession.id, sessionCache);
        return newCache;
      });
    }

    setEditingSession(null);
  };

  const handleDeleteTmdeDefinition = (tmdeId) => {
    if (!window.confirm("Are you sure you want to delete this entire TMDE definition (all instances)?")) return;
    
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== selectedSessionId) return session;
        const updatedTestPoints = session.testPoints.map((tp) => {
          if (tp.id !== selectedTestPointId) return tp;
          const newTolerances = tp.tmdeTolerances.filter(
            (t) => t.id !== tmdeId
          );
          return { ...tp, tmdeTolerances: newTolerances };
        });
        return { ...session, testPoints: updatedTestPoints };
      })
    );
  };

  const handleDecrementTmdeQuantity = (tmdeId) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== selectedSessionId) return session;
        const updatedTestPoints = session.testPoints.map((tp) => {
          if (tp.id !== selectedTestPointId) return tp;
          
          const newTolerances = tp.tmdeTolerances.map(t => {
            if (t.id === tmdeId) {
              const newQuantity = (t.quantity || 1) - 1;
              return { ...t, quantity: newQuantity };
            }
            return t;
          }).filter(t => t.quantity > 0); // Filter out if quantity becomes 0
          
          return { ...tp, tmdeTolerances: newTolerances };
        });
        return { ...session, testPoints: updatedTestPoints };
      })
    );
  };



  const textEncoder = new TextEncoder();
  const handleSaveToFile = async () => {
    let now = new Date();

    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const year = now.getFullYear();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');

    const currentSession = sessions.find((s) => s.id === selectedSessionId);
    if (!currentSession) return;

    // Get this session's image files from the main app cache
    const imagesToSave = [];
    const sessionCache = sessionImageCache.get(currentSession.id);
    if (sessionCache && currentSession.noteImages) {
      currentSession.noteImages.forEach(imageRef => {
        if (sessionCache.has(imageRef.id)) {
          imagesToSave.push({
            fileName: imageRef.fileName,
            fileObject: sessionCache.get(imageRef.id) // This is the File object
          });
        }
      });
    }

    const fileName = `MUA_${currentSession.uutDescription || "Session"}_${year}${month}${day}_${hours}${minutes}.pdf`;

    // 1. Prepare JSON Data for attachment
    const jsonData = JSON.stringify(currentSession, null, 2);
    const jsonDataBytes = textEncoder.encode(jsonData);
    
    // 2. Initialize PDF Document
    const pdfDoc = await PDFDocument.create();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fonts = { regular: helveticaFont, bold: helveticaBoldFont };

    // 3. Set Standard PDF Document Metadata
    pdfDoc.setTitle(fileName);
    pdfDoc.setSubject('MUA Session Data and Overview');
    pdfDoc.setKeywords(['MUA', 'Session', 'JSON', 'Overview']);
    pdfDoc.setProducer('MUA Tool');
    pdfDoc.setCreator('MUA Tool');
    pdfDoc.setCreationDate(now);
    pdfDoc.setModificationDate(now);
    
    // 4. Generate the new Overview Pages
    try {
      const helpers = {
        getToleranceSummary,
        calculateUncertaintyFromToleranceObject,
        convertPpmToUnit,
        getAbsoluteLimits
      };
      await generateOverviewReport(pdfDoc, currentSession, fonts, helpers);
    } catch (error) {
      console.error("Failed to generate PDF overview report:", error);
      setAppNotification({
        title: "PDF Error",
        message: `Failed to generate PDF overview: ${error.message}`
      });
    }

    // 5. ATTACH THE JSON DATA
    await pdfDoc.attach(jsonDataBytes, 'sessionData.json', {
        mimeType: 'application/json',
        description: 'Full MUA session data',
    });

    // 6. ATTACH ALL IMAGES
    for (const image of imagesToSave) {
      try {
        const imageBytes = await image.fileObject.arrayBuffer();
        await pdfDoc.attach(imageBytes, image.fileName, {
          mimeType: image.fileObject.type,
          description: 'User-uploaded note image',
        });
      } catch (err) {
        console.error(`Failed to attach image ${image.fileName}:`, err);
        // Continue to save the PDF even if one image fails
      }
    }

    // 7. Finalize and Save
    const pdfBytes = await pdfDoc.save();

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  };

  const handleLoadFromFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;

        // 1. Load the PDF document
        let pdfDoc;
        try {
          pdfDoc = await PDFDocument.load(arrayBuffer);
        } catch (loadError) {
          console.error('PDF Load Error:', loadError);
          throw new Error('Failed to load: This does not appear to be a valid PDF file.');
        }

        // 2. Use the new helper function to get ALL attachments (including mimeType)
        const attachments = extractAttachments(pdfDoc);

        if (attachments.length === 0) {
          throw new Error('Error: This PDF does not contain any session data attachments.');
        }

        // 3. Find the 'sessionData.json' attachment
        const sessionAttachment = attachments.find(
          (a) => a.name === 'sessionData.json'
        );

        if (!sessionAttachment) {
          throw new Error('Error: Could not find the required "sessionData.json" attachment in this PDF.');
        }

        // 4. Decode and Parse the JSON
        let jsonData;
        try {
          const textDecoder = new TextDecoder(); 
          jsonData = textDecoder.decode(sessionAttachment.data);
        } catch (decodeError) {
          console.error('Text Decode Error:', decodeError);
          throw new Error('Failed to decode session data. The attachment may be corrupt.');
        }

        let loadedSession;
        try {
          loadedSession = JSON.parse(jsonData);
        } catch (parseError) {
          console.error('JSON Parse Error:', parseError);
          console.log('--- Corrupted JSON String ---', jsonData);
          throw new Error('Failed to parse session data. The JSON data inside the file is corrupt.');
        }

        if (!loadedSession || !loadedSession.id) {
           throw new Error('Error: Attached data is not a valid session object.');
        }

        // 5. FIND AND LOAD IMAGE DATA
        // This will hold the loaded images for the cache
        const newSessionImageCache = new Map();
        if (loadedSession.noteImages && loadedSession.noteImages.length > 0) {
          loadedSession.noteImages.forEach(imageRef => {
            const imageAttachment = attachments.find(
              (a) => a.name === imageRef.fileName
            );
            
            if (imageAttachment) {
              // Create a Blob from the raw data, which can be used to create an object URL
              const imageBlob = new Blob(
                [imageAttachment.data], 
                { type: imageAttachment.mimeType }
              );
              
              newSessionImageCache.set(imageRef.id, imageBlob);
            }
          });
        }

        // 6. Update the main sessions state
        setSessions((prevSessions) => {
          const sessionExists = prevSessions.some(
            (s) => s.id === loadedSession.id
          );
          let newSessions;

          if (sessionExists) {
            newSessions = prevSessions.map((s) =>
              s.id === loadedSession.id ? loadedSession : s
            );
          } else {
            newSessions = [...prevSessions, loadedSession];
          }
          return newSessions;
        });

        // 7. Update the main image cache
        setSessionImageCache((prevCache) => {
          const newCache = new Map(prevCache);
          newCache.set(loadedSession.id, newSessionImageCache);
          return newCache;
        });

        // 8. Set the UI to view the newly loaded session
        setSelectedSessionId(loadedSession.id);
        setSelectedTestPointId(loadedSession.testPoints?.[0]?.id || null);
        setEditingSession(loadedSession); 

        // 9. Use the notification modal
        setAppNotification({
          title: 'Success',
          message: `Session "${loadedSession.name}" loaded successfully.`,
        });

      } catch (err) {
        console.error('Failed to load session from PDF:', err);
        setAppNotification({
          title: 'Load Failed',
          message: err.message,
        });
      }
    };

    reader.readAsArrayBuffer(file);
    event.target.value = null; // Clear the file input
  };

  const handleSaveTestPoint = (formData) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== selectedSessionId) return session;

        // Logic for UPDATING an existing test point
        if (formData.id) {
          const updatedTestPoints = session.testPoints.map((tp) => {
            if (tp.id === formData.id) {
              return {
                ...tp, // Keep existing data
                // Overwrite with new form data
                section: formData.section,
                testPointInfo: { ...formData.testPointInfo },
                measurementType: formData.measurementType,
                equationString: formData.equationString,
                variableMappings: formData.variableMappings,
              };
            }
            return tp;
          });
          return { ...session, testPoints: updatedTestPoints };
        }

        // Logic for ADDING a new single test point
        else {
          const lastTestPoint = session.testPoints.find(
            (tp) => tp.id === selectedTestPointId
          );
          let copiedTmdes = [];
          const newTestPointParameter = formData.testPointInfo.parameter;

          if (formData.copyTmdes && lastTestPoint) {
            copiedTmdes = JSON.parse(
              JSON.stringify(lastTestPoint.tmdeTolerances || [])
            );
            const originalTestPointParameter =
              lastTestPoint.testPointInfo.parameter;

            // Update the measurement point for TMDEs that were using the UUT reference
            copiedTmdes.forEach((tmde) => {
              const wasUsingUutRef =
                tmde.measurementPoint?.value ===
                  originalTestPointParameter.value &&
                tmde.measurementPoint?.unit === originalTestPointParameter.unit;
              if (wasUsingUutRef) {
                tmde.measurementPoint = { ...newTestPointParameter };
              }
            });
          }

          const newTestPoint = {
            id: Date.now(),
            ...defaultTestPoint,
            section: formData.section,
            testPointInfo: formData.testPointInfo,
            tmdeTolerances: copiedTmdes,
            measurementType: formData.measurementType,
            equationString: formData.equationString,
            variableMappings: formData.variableMappings,
          };
          setSelectedTestPointId(newTestPoint.id);
          return {
            ...session,
            testPoints: [...session.testPoints, newTestPoint],
          };
        }
      })
    );

    setIsAddModalOpen(false);
    setEditingTestPoint(null);
  };

  const handleDeleteTestPoint = (idToDelete) => {
    if (
      !window.confirm("Are you sure you want to delete this measurement point?")
    )
      return;
    let nextSelectedTestPointId = selectedTestPointId;
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id === selectedSessionId) {
          const filteredTestPoints = session.testPoints.filter(
            (tp) => tp.id !== idToDelete
          );
          if (selectedTestPointId === idToDelete) {
            nextSelectedTestPointId = filteredTestPoints[0]?.id || null;
          }
          return { ...session, testPoints: filteredTestPoints };
        }
        return session;
      })
    );
    setSelectedTestPointId(nextSelectedTestPointId);
  };

  const handleDataSave = useCallback(
    (updatedData) => {
      setSessions((prevSessions) =>
        prevSessions.map((session) => {
          if (session.id === selectedSessionId) {
            const updatedTestPoints = session.testPoints.map((tp) =>
              tp.id === selectedTestPointId ? { ...tp, ...updatedData } : tp
            );
            return { ...session, testPoints: updatedTestPoints };
          }
          return session;
        })
      );
    },
    [selectedSessionId, selectedTestPointId]
  );

  const handleSessionSelect = (e) => {
    const newSessionId = Number(e.target.value);
    const newSession = sessions.find((s) => s.id === newSessionId);
    setSelectedSessionId(newSessionId);
    setSelectedTestPointId(newSession?.testPoints?.[0]?.id || null);
  };

  const currentSessionData = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId),
    [sessions, selectedSessionId]
  );

  const currentTestPoints = useMemo(
    () => currentSessionData?.testPoints || [],
    [currentSessionData]
  );

  const testPointData = useMemo(() => {
    if (!currentSessionData || !selectedTestPointId) return null;
    const pointData = currentTestPoints.find(
      (p) => p.id === selectedTestPointId
    );
    if (!pointData) return null;

    // This creates a complete object for the Analysis component to use,
    // combining the point's data with the session's UUT data.
    return {
      ...pointData,
      uutDescription: currentSessionData.uutDescription,
      uutTolerance: currentSessionData.uutTolerance,
    };
  }, [currentSessionData, selectedTestPointId, currentTestPoints]);

  return (
    <ThemeContext.Provider value={isDarkMode}>
      <div className="App">
        <NotificationModal
          isOpen={!!appNotification}
          onClose={() => setAppNotification(null)}
          title={appNotification?.title}
          message={appNotification?.message}
        />
        <AddTestPointModal
          isOpen={isAddModalOpen || !!editingTestPoint}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingTestPoint(null);
          }}
          onSave={handleSaveTestPoint}
          initialData={editingTestPoint}
          hasExistingPoints={currentTestPoints.length > 0}
          previousTestPointData={currentTestPoints.length > 0 ? currentTestPoints[currentTestPoints.length - 1] : null}
        />

        <EditSessionModal
          isOpen={!!editingSession}
          onClose={() => {
            setEditingSession(null);
            setInitialTmdeToEdit(null);
            setInitialSessionTab("details");
          }}
          sessionData={editingSession}
          onSave={handleSessionChange}
          onSaveToFile={handleSaveToFile}
          handleLoadFromFile={handleLoadFromFile}
          initialSection={initialSessionTab}
          initialTmdeToEdit={initialTmdeToEdit}
          sessionImageCache={sessionImageCache}
          onImageCacheChange={setSessionImageCache}
        />

        {testPointData && (
          <ToleranceToolModal
            isOpen={isToleranceModalOpen}
            onClose={() => setIsToleranceModalOpen(false)}
            onSave={(data) => {
              const { uutTolerance, ...testPointSpecificData } = data;

              // Update session-level UUT tolerance if it exists
              if (uutTolerance) {
                setSessions((prev) =>
                  prev.map((session) =>
                    session.id === selectedSessionId
                      ? { ...session, uutTolerance: uutTolerance }
                      : session
                  )
                );
              }

              // Update test point-level data (e.g., tmdeTolerances)
              handleDataSave(testPointSpecificData);
            }}
            testPointData={testPointData}
          />
        )}

        <FullBreakdownModal
          isOpen={!!breakdownPoint}
          breakdownData={breakdownPoint}
          onClose={() => setBreakdownPoint(null)}
        />

        <TestPointInfoModal
          isOpen={!!infoModalPoint}
          testPoint={infoModalPoint}
          onClose={() => setInfoModalPoint(null)}
        />

        {contextMenu && (
          <ContextMenu menu={contextMenu} onClose={handleCloseContextMenu} />
        )}

        <div className="content-area uncertainty-analysis-page">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <h2>Uncertainty Analysis</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                className="sidebar-action-button"
                onClick={handleSaveToFile}
                title="Save Session to File (.pdf)"
              >
                <FontAwesomeIcon icon={faSave} />
              </button>

              <label
                className="sidebar-action-button"
                htmlFor="load-session-pdf-main"
                title="Load Session from File (.pdf)"
                style={{ cursor: "pointer", margin: "0" }}
              >
                <FontAwesomeIcon icon={faFolderOpen} />
              </label>
              <input
                type="file"
                id="load-session-pdf-main"
                accept=".pdf"
                style={{ display: "none" }}
                onChange={handleLoadFromFile}
              />

              <label className="dark-mode-toggle">
                <input
                  type="checkbox"
                  checked={isDarkMode}
                  onChange={() => setIsDarkMode(!isDarkMode)}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>
          <div className="results-workflow-container">
            <aside className="results-sidebar">
              <div
                className="sidebar-header"
                style={{ alignItems: "flex-end" }}
              >
                <div className="session-controls">
                  <label htmlFor="session-select">Analysis Session</label>
                  <select
                    id="session-select"
                    className="session-selector"
                    value={selectedSessionId || ""}
                    onChange={handleSessionSelect}
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="session-actions">
                  <button
                    onClick={handleAddNewSession}
                    title="Add New Session"
                    className="sidebar-action-button"
                  >
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                  <button
                    onClick={() => setEditingSession(currentSessionData)}
                    title="Edit Session"
                    className="sidebar-action-button"
                  >
                    <FontAwesomeIcon icon={faEdit} />
                  </button>
                  <button
                    onClick={() => handleDeleteSession(selectedSessionId)}
                    title="Delete Session"
                    className="sidebar-action-button delete"
                  >
                    <FontAwesomeIcon icon={faTrashAlt} />
                  </button>
                </div>
              </div>

              <div className="sidebar-header">
                <h4 style={{ margin: "0" }}>Measurement Points</h4>
                <div className="add-point-controls">
                  <button
                    className="add-point-button"
                    onClick={() => setIsAddModalOpen(true)}
                    title="Add New Measurement Point"
                  >
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                </div>
              </div>
              <div className="measurement-point-list">
                {currentTestPoints.length > 0 ? (
                  currentTestPoints.map((tp) => (
                    <button
                      key={tp.id}
                      onClick={() => {
                        setSelectedTestPointId(tp.id);
                        setEditingTestPoint(tp);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        const completeTestPointForMenu = {
                          ...tp,
                          uutTolerance: currentSessionData.uutTolerance,
                          uutDescription: currentSessionData.uutDescription,
                        };
                        const menuItems = [
                          {
                            label: "Edit Details",
                            action: () => setEditingTestPoint(tp),
                            icon: faPencilAlt,
                          },
                          {
                            label: "Edit Tolerances",
                            action: () => {
                              setSelectedTestPointId(tp.id);
                              setIsToleranceModalOpen(true);
                            },
                            icon: faSlidersH,
                          },
                          { type: "divider" },
                          {
                            label: "View Details",
                            action: () =>
                              setInfoModalPoint(completeTestPointForMenu),
                            icon: faInfoCircle,
                          },
                          { type: "divider" },
                          {
                            label: "Delete Point",
                            action: () => handleDeleteTestPoint(tp.id),
                            icon: faTrashAlt,
                            className: "destructive",
                          },
                        ];
                        setContextMenu({
                          x: e.pageX,
                          y: e.pageY,
                          items: menuItems,
                        });
                      }}
                      className={`measurement-point-item ${
                        selectedTestPointId === tp.id ? "active" : ""
                      }`}
                    >
                      <span className="measurement-point-content">
                        <span className="point-main">
                          {tp.testPointInfo.parameter.name}:{" "}
                          {tp.testPointInfo.parameter.value}{" "}
                          {tp.testPointInfo.parameter.unit}
                        </span>
                        {tp.testPointInfo.qualifier &&
                          tp.testPointInfo.qualifier.value && (
                            <span className="point-qualifier">
                              @{tp.testPointInfo.qualifier.value}
                              {tp.testPointInfo.qualifier.unit}
                            </span>
                          )}
                      </span>
                    </button>
                  ))
                ) : (
                  <div
                    className="placeholder-content"
                    style={{
                      minHeight: "100px",
                      fontSize: "0.9rem",
                      margin: "1rem 0",
                    }}
                  >
                    <p>
                      No measurement points in this session. <br /> Click '+' to
                      add one.
                    </p>
                  </div>
                )}
              </div>
            </aside>
            <main className="results-content">
              {testPointData ? (
                <TestPointDetailView
                  key={selectedTestPointId}
                  testPointData={testPointData}
                >
                  <Analysis
                    sessionData={currentSessionData}
                    testPointData={testPointData}
                    onDataSave={handleDataSave}
                    defaultTestPoint={defaultTestPoint}
                    setContextMenu={setContextMenu}
                    setBreakdownPoint={setBreakdownPoint}
                    handleOpenSessionEditor={handleOpenSessionEditor}
                    budgetTestPoints={testPointData ? [testPointData] : []}
                    riskResults={riskResults}
                    setRiskResults={setRiskResults}
                    isDarkMode={isDarkMode}
                    onDeleteTmdeDefinition={handleDeleteTmdeDefinition}
                    onDecrementTmdeQuantity={handleDecrementTmdeQuantity}
                  />
                </TestPointDetailView>
              ) : currentSessionData && currentTestPoints.length > 0 ? (
                <div className="placeholder-content">
                  <h3>Select a measurement point to see details.</h3>
                </div>
              ) : currentSessionData && currentTestPoints.length === 0 ? (
                <div className="placeholder-content">
                  <h3>This session has no measurement points.</h3>
                  <p>Click the '+' button in the sidebar to add one.</p>
                </div>
              ) : (
                <div className="placeholder-content">
                  <h3>No Session Available</h3>
                  <p>Create a new session to begin your analysis.</p>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}

export default App;
