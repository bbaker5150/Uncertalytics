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
import AddTmdeModal from "./components/AddTmdeModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faInfoCircle,
  faCalculator,
  faPlus,
  faEdit,
  faTrashAlt,
  faPencilAlt,
  faSlidersH,
} from "@fortawesome/free-solid-svg-icons";
import { PDFDocument, StandardFonts } from 'pdf-lib';

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
    <div className="modal-overlay">
      <div className="modal-content">
        <button onClick={onClose} className="modal-close-button">
          &times;
        </button>
        <h3>{title}</h3>
        <p style={{ textAlign: "center" }}>{message}</p>
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
}) => {
  const confidencePercent = parseFloat(uncertaintyConfidence) || 95;
  const derivedUnit = referencePoint?.unit || "Units";
  const derivedName = referencePoint?.name || "Derived";

  const isDirect = measurementType === "direct";
  const headerColSpan = isDirect ? 6 : 8;
  const finalColSpan = isDirect ? 3 : 5;

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
              <td>{c.name}</td>
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

            <td className="action-cell"></td>
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
                  {riskResults && (
                    <div className="budget-risk-metrics">
                      <div className={`metric-pod ${getPfaClass(riskResults.pfa)}`}>
                        <span className="metric-pod-label">PFA</span>
                        <span className="metric-pod-value">
                          {riskResults.pfa.toFixed(4)} %
                        </span>
                      </div>
                      <div className="metric-pod pfr">
                        <span className="metric-pod-label">PFR</span>
                        <span className="metric-pod-value">
                          {riskResults.pfr.toFixed(4)} %
                        </span>
                      </div>
                      <div className="metric-pod tur">
                        <span className="metric-pod-label">TUR</span>
                        <span className="metric-pod-value">
                          {riskResults.tur.toFixed(2)} : 1
                        </span>
                      </div>
                      <div className="metric-pod tar">
                        <span className="metric-pod-label">TAR</span>
                        <span className="metric-pod-value">
                          {riskResults.tar.toFixed(2)} : 1
                        </span>
                      </div>
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

  return (
    <div className="modal-overlay">
      <div className="modal-content breakdown-modal-content">
        <button onClick={onClose} className="modal-close-button">
          &times;
        </button>
        <h3>Key Inputs Breakdown</h3>
        <div className="breakdown-step">
          <h5>Std. Unc. of Cal (uₑₐₗ)</h5>
          <p>
            This value is the **Combined Standard Uncertainty**, calculated
            using the root sum of squares (RSS) of all individual components
            (uᵢ) from the detailed budget.
          </p>
          <Latex>{`$$ u_{cal} = \\sqrt{\\sum_{i=1}^{N} u_i^2} = \\mathbf{${results.uCal.toPrecision(
            4
          )}} \\text{ ${safeNativeUnit}} $$`}</Latex>
        </div>
        <div className="breakdown-step">
          <h5>UUT Uncertainty (uᵤᵤₜ)</h5>
          <p>
            The standard uncertainty of the UUT is isolated from the total
            deviation uncertainty, which is derived from the target reliability
            (R).
          </p>
          1. Deviation Uncertainty (uₔₑᵥ):{" "}
          <Latex>{`$$ u_{dev} = \\frac{L_{Upper}}{\\Phi^{-1}((1+R)/2)} = \\frac{${LUp_symmetric.toFixed(
            6
          )}}{\\Phi^{-1}((1+${inputs.reliability})/2)} = ${results.uDev.toPrecision(
            4
          )} \\text{ ${safeNativeUnit}} $$`}</Latex>
          2. UUT Uncertainty:{" "}
          <Latex>{`$$ u_{UUT} = \\sqrt{u_{dev}^2 - u_{cal}^2} = \\sqrt{${results.uDev.toPrecision(
            4
          )}^2 - ${results.uCal.toPrecision(
            4
          )}^2} = \\mathbf{${results.uUUT.toPrecision(4)}} \\text{ ${safeNativeUnit}} $$`}</Latex>
        </div>
        <div className="breakdown-step">
          <h5>Acceptance Limits (A)</h5>
          <p>
            Calculated by applying the **Guard Band Multiplier** to the
            tolerance limits.
          </p>
          <Latex>{`$$ A_{Low} = L_{Low} \\times G = ${parseFloat(inputs.LLow).toFixed(
            6
          )} \\times ${
            inputs.guardBandMultiplier
          } = \\mathbf{${results.ALow.toFixed(6)}} \\text{ ${safeNativeUnit}} $$`}</Latex>
          <Latex>{`$$ A_{Up} = L_{Up} \\times G = ${parseFloat(inputs.LUp).toFixed(
            6
          )} \\times ${
            inputs.guardBandMultiplier
          } = \\mathbf{${results.AUp.toFixed(6)}} \\text{ ${safeNativeUnit}} $$`}</Latex>
        </div>
        <div className="breakdown-step">
          <h5>Correlation (ρ)</h5>
          <p>
            The statistical correlation between the UUT's true value and the
            measured value.
          </p>
          <Latex>{`$$ \\rho = \\frac{u_{UUT}}{u_{dev}} = \\frac{${results.uUUT.toPrecision(
            4
          )}}{${results.uDev.toPrecision(
            4
          )}} = \\mathbf{${results.correlation.toFixed(4)}} $$`}</Latex>
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
          <Latex>{"$$ TUR = \\frac{L_{Upper} - L_{Lower}}{2 \\times U_{95}} $$"}</Latex>
        </div>
        <div className="breakdown-step">
          <h5>Step 2: Inputs</h5>
          <ul>
            <li>
              Tolerance Span:{" "}
              <Latex>{`$$ L_{Upper} - L_{Lower} = ${inputs.LUp.toPrecision(
                6
              )} - (${inputs.LLow.toPrecision(
                6
              )}) = ${uutToleranceSpan.toPrecision(
                4
              )} \\text{ ${safeNativeUnit}} $$`}</Latex>
            </li>
            <li>
              Expanded Uncertainty Span:{" "}
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
  const uutToleranceSpan = inputs.LUp - inputs.LLow;
  const tmdeToleranceSpan = results.tmdeToleranceSpan;
  
  const safeNativeUnit = results.nativeUnit === "%" ? "\\%" : (results.nativeUnit || "units");

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
            The Test Acceptance Ratio (TAR) is the ratio of the UUT's tolerance
            span to the TMDE's (Standard's) tolerance span.
          </p>
          <Latex>
            {
              "$$ TAR = \\frac{UUT\\ Tolerance\\ Span}{TMDE\\ Tolerance\\ Span} $$"
            }
          </Latex>
        </div>
        <div className="breakdown-step">
          <h5>Step 2: Inputs</h5>
          <ul>
            <li>
              UUT Tolerance Span:{" "}
              <Latex>{`$$ ${inputs.LUp.toFixed(2)} - (${inputs.LLow.toFixed(
                2
              )}) = \\mathbf{${uutToleranceSpan.toFixed(
                2
              )}} \\text{ ${safeNativeUnit}} $$`}</Latex>
            </li>
            <li>
              TMDE Tolerance Span:{" "}
              <Latex>{`$$ \\mathbf{${tmdeToleranceSpan.toFixed(
                2
              )}} \\text{ ${safeNativeUnit}} $$`}</Latex>{" "}
              <em>
                (Derived from all TMDE tolerance spans, converted and summed)
              </em>
            </li>
          </ul>
        </div>
        <div className="breakdown-step">
          <h5>Step 3: Final Calculation</h5>
          <Latex>{`$$ TAR = \\frac{${uutToleranceSpan.toFixed(
            2
          )}}{${tmdeToleranceSpan.toFixed(2)}} = \\mathbf{${results.tar.toFixed(
            4
          )}:1} $$`}</Latex>
        </div>
      </div>
    </div>
  );
};

const PfaBreakdownModal = ({ results, inputs, onClose }) => {
  if (!results || !inputs) return null;
  const mid = (inputs.LUp + inputs.LLow) / 2;
  const LLow_norm = inputs.LLow - mid;
  const LUp_norm = inputs.LUp - mid;
  const ALow_norm = results.ALow - mid;
  const AUp_norm = results.AUp - mid;
  const z1 = LLow_norm / results.uUUT;
  const z2 = AUp_norm / results.uDev;
  const z3 = ALow_norm / results.uDev;
  const z4 = -LUp_norm / results.uUUT;
  const z5 = -ALow_norm / results.uDev;
  const z6 = -AUp_norm / results.uDev;

  return (
    <div className="modal-overlay">
      <div className="modal-content breakdown-modal-content">
        <button onClick={onClose} className="modal-close-button">
          &times;
        </button>
        <h3>PFA Calculation Breakdown</h3>
        <div className="breakdown-step">
          <h5>Step 1: Formula</h5>
          <p>
            The Probability of False Accept is the risk of accepting an
            out-of-tolerance UUT.
          </p>
          <Latex>
            {
              "$$ PFA = \\int G(x) \\left[ \\Phi(\\frac{A-x}{u_{cal}}) - \\Phi(\\frac{-A-x}{u_{cal}}) \\right] dx $$"
            }
          </Latex>
        </div>
        <div className="breakdown-step">
          <h5>Step 2: Standardized Limits (Z-Scores)</h5>
          <p>
            The limits are normalized by their respective uncertainties to
            create unitless Z-scores.
          </p>
          <Latex>{`$$ z_{L_{Low}} = ${z1.toFixed(4)}, z_{L_{Up}} = ${z4.toFixed(
            4
          )}, z_{A_{Low}} = ${z3.toFixed(4)}, z_{A_{Up}} = ${z2.toFixed(
            4
          )} $$`}</Latex>
        </div>
        <div className="breakdown-step">
          <h5>Step 3: Bivariate Normal Probabilities (Φ₂)</h5>
          <p>
            Using Z-scores and correlation (ρ = {results.correlation.toFixed(4)}
            ), we solve the Bivariate Normal CDF (Φ₂).
          </p>
          Term A:{" "}
          <Latex>{`$$ \\Phi_2(${z1.toFixed(2)}, ${z2.toFixed(
            2
          )}, \\rho) = ${bivariateNormalCDF(
            z1,
            z2,
            results.correlation
          ).toFixed(6)} $$`}</Latex>
          Term B:{" "}
          <Latex>{`$$ \\Phi_2(${z1.toFixed(2)}, ${z3.toFixed(
            2
          )}, \\rho) = ${bivariateNormalCDF(
            z1,
            z3,
            results.correlation
          ).toFixed(6)} $$`}</Latex>
          Term C:{" "}
          <Latex>{`$$ \\Phi_2(${z4.toFixed(2)}, ${z5.toFixed(
            2
          )}, \\rho) = ${bivariateNormalCDF(
            z4,
            z5,
            results.correlation
          ).toFixed(6)} $$`}</Latex>
          Term D:{" "}
          <Latex>{`$$ \\Phi_2(${z4.toFixed(2)}, ${z6.toFixed(
            2
          )}, \\rho) = ${bivariateNormalCDF(
            z4,
            z6,
            results.correlation
          ).toFixed(6)} $$`}</Latex>
        </div>
        <div className="breakdown-step">
          <h5>Step 4: Final PFA Calculation</h5>
          Lower Tail Risk (A-B):{" "}
          <Latex>{`$$ ${(results.pfa_term1 / 100).toFixed(6)} $$`}</Latex>
          Upper Tail Risk (C-D):{" "}
          <Latex>{`$$ ${(results.pfa_term2 / 100).toFixed(6)} $$`}</Latex>
          Total PFA ={" "}
          <Latex>{`$$ \\mathbf{${results.pfa.toFixed(4)}\\%} $$`}</Latex>
        </div>
      </div>
    </div>
  );
};

const PfrBreakdownModal = ({ results, inputs, onClose }) => {
  if (!results || !inputs) return null;
  const mid = (inputs.LUp + inputs.LLow) / 2;
  const LLow_norm = inputs.LLow - mid;
  const LUp_norm = inputs.LUp - mid;
  const ALow_norm = results.ALow - mid;
  const AUp_norm = results.AUp - mid;
  const z1 = LUp_norm / results.uUUT;
  const z2 = ALow_norm / results.uDev;
  const z3 = LLow_norm / results.uUUT;
  const z4 = -LLow_norm / results.uUUT;
  const z5 = -AUp_norm / results.uDev;
  const z6 = -LUp_norm / results.uUUT;

  return (
    <div className="modal-overlay">
      <div className="modal-content breakdown-modal-content">
        <button onClick={onClose} className="modal-close-button">
          &times;
        </button>
        <h3>PFR Calculation Breakdown</h3>
        <div className="breakdown-step">
          <h5>Step 1: Formula</h5>
          <p>
            The Probability of False Reject is the risk of rejecting an
            in-tolerance UUT.
          </p>
          <Latex>
            {
              "$$ PFR = \\int_{-L}^{L} G(x) \\left[ 1 - \\Phi(\\frac{A-x}{u_{cal}}) + \\Phi(\\frac{-A-x}{u_{cal}}) \\right] dx $$"
            }
          </Latex>
        </div>
        <div className="breakdown-step">
          <h5>Step 2: Bivariate Normal Probabilities (Φ₂)</h5>
          <p>
            Using Z-scores and correlation (ρ = {results.correlation.toFixed(4)}
            ), we solve the Bivariate Normal CDF (Φ₂).
          </p>
          Term A:{" "}
          <Latex>{`$$ \\Phi_2(${z1.toFixed(2)}, ${z2.toFixed(
            2
          )}, \\rho) = ${bivariateNormalCDF(
            z1,
            z2,
            results.correlation
          ).toFixed(6)} $$`}</Latex>
          Term B:{" "}
          <Latex>{`$$ \\Phi_2(${z3.toFixed(2)}, ${z2.toFixed(
            2
          )}, \\rho) = ${bivariateNormalCDF(
            z3,
            z2,
            results.correlation
          ).toFixed(6)} $$`}</Latex>
          Term C:{" "}
          <Latex>{`$$ \\Phi_2(${z4.toFixed(2)}, ${z5.toFixed(
            2
          )}, \\rho) = ${bivariateNormalCDF(
            z4,
            z5,
            results.correlation
          ).toFixed(6)} $$`}</Latex>
          Term D:{" "}
          <Latex>{`$$ \\Phi_2(${z6.toFixed(2)}, ${z5.toFixed(
            2
          )}, \\rho) = ${bivariateNormalCDF(
            z6,
            z5,
            results.correlation
          ).toFixed(6)} $$`}</Latex>
        </div>
        <div className="breakdown-step">
          <h5>Step 3: Final PFR Calculation</h5>
          Lower Side Risk (A-B):{" "}
          <Latex>{`$$ ${(results.pfr_term1 / 100).toFixed(6)} $$`}</Latex>
          Upper Side Risk (C-D):{" "}
          <Latex>{`$$ ${(results.pfr_term2 / 100).toFixed(6)} $$`}</Latex>
          Total PFR ={" "}
          <Latex>{`$$ \\mathbf{${results.pfr.toFixed(4)}\\%} $$`}</Latex>
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
          {/* Button Removed */}
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
          {/* Button Removed */}
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
          {/* Button Removed */}
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

    let sumOfSquaresNative = 0; // <-- FIX: Changed name for clarity
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

      // --- START FIX ---
      const ui_absolute_base = (ui_ppm / 1e6) * Math.abs(nominalInBase);
      const ui_absolute_native = (ui_ppm / 1e6) * Math.abs(nominalValue); // <-- Get native uncertainty
      if (
        isNaN(ui_absolute_base) ||
        ui_absolute_base < 0 ||
        isNaN(ui_absolute_native)
      ) {
        console.warn(
          "Could not calculate valid absolute uncertainty for TMDE:",
          tmde
        );
        return;
      }
      // --- END FIX ---

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
        // --- START FIX ---
        uncertaintyInputs[tmde.variableType].ui_squared_sum_base +=
          ui_absolute_base ** 2;
        uncertaintyInputs[tmde.variableType].ui_squared_sum_native +=
          ui_absolute_native ** 2; // <-- Sum native
        // --- END FIX ---
      } else {
        // --- START FIX ---
        uncertaintyInputs[tmde.variableType] = {
          ui_squared_sum_base: ui_absolute_base ** 2,
          ui_squared_sum_native: ui_absolute_native ** 2, // <-- Store native
          nominal: nominalValue,
          unit: tmde.measurementPoint.unit,
          symbol: variableSymbol,
        };
        // --- END FIX ---
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
      // --- START FIX ---
      uncertaintyInputs[type].ui_base = Math.sqrt(
        uncertaintyInputs[type].ui_squared_sum_base
      );
      uncertaintyInputs[type].ui_native = Math.sqrt(
        uncertaintyInputs[type].ui_squared_sum_native
      ); // <-- Get native
      // --- END FIX ---
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

      // --- START FIX ---
      const ui_native = inputData.ui_native; // <-- Use NATIVE uncertainty
      const ui_base = inputData.ui_base; // <-- Use BASE for display
      // --- END FIX ---

      const derivativeNode = math.derivative(node, variableSymbol);
      const derivativeStr = derivativeNode.toString(); // Get string representation
      const derivativeFunc = derivativeNode.compile();
      const sensitivityCoeff = derivativeFunc.evaluate(nominalScope); // This is native derivative

      if (isNaN(sensitivityCoeff)) {
        throw new Error(
          `Could not evaluate derivative for '${variableSymbol}'.`
        );
      }

      // --- START FIX ---
      const contribution_native = sensitivityCoeff * ui_native; // <-- Calculate NATIVE contribution
      const termSquared_native = contribution_native ** 2;

      sumOfSquaresNative += termSquared_native; // <-- Sum NATIVE variances
      // --- END FIX ---

      calculationBreakdown.push({
        variable: variableSymbol,
        type: variableType,
        nominal: inputData.nominal,
        unit: inputData.unit,
        ui_absolute_base: ui_base, // <-- Pass BASE for display logic
        ci: sensitivityCoeff,
        derivativeString: derivativeStr, // Store the string
        contribution_native: Math.abs(contribution_native), // <-- Pass NATIVE contribution
        termSquared_native: termSquared_native, // <-- Pass NATIVE variance
      });
    });

    const combinedUncertaintyNative = math.sqrt(sumOfSquaresNative); // <-- Final native unc

    let nominalResult = NaN;
    try {
      nominalResult = node.compile().evaluate(nominalScope);
    } catch (evalError) {
      console.error("Error evaluating nominal equation result:", evalError);
    }

    // --- FIX: Return native uncertainty ---
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
    const reliability = parseFloat(sessionData.uncReq.reliability)/100;
    const nominalUnit = uutNominal?.unit;
    const targetUnitInfo = unitSystem.units[nominalUnit];
    const pfaRequired = parseFloat(sessionData.uncReq.reqPFA)/100;

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
    if (!targetUnitInfo || isNaN(targetUnitInfo.to_si)) {
      setNotification({
        title: "Calculation Error",
        message: `Invalid UUT unit (${nominalUnit}) for risk analysis.`,
      });
      return;
    }

    const guardBandMultiplier = parseFloat(sessionData.uncReq.guardBandMultiplier);

    if (
      isNaN(guardBandMultiplier) ||
      guardBandMultiplier < 0 ||
      guardBandMultiplier > 1
    ) {
      setNotification({
        title: "Invalid Input",
        message: "Guard Band Multiplier must be 0 to 1.",
      });
      return;
    }

    

    const uCal_Base = calcResults.combined_uncertainty_absolute_base;
    const uCal_Native = uCal_Base / targetUnitInfo.to_si;

    let tmdeToleranceSpan_Native = 0;
    let missingTmdeRef = false;

    if (tmdeTolerancesData.length > 0) {
      tmdeToleranceSpan_Native = tmdeTolerancesData.reduce((totalSpan, tmde) => {
        if (!tmde.measurementPoint || !tmde.measurementPoint.value) {
          missingTmdeRef = true;
          return totalSpan;
        }

        const { breakdown: tmdeBreakdown } =
          calculateUncertaintyFromToleranceObject(tmde, tmde.measurementPoint);
        const tmdeNominal = parseFloat(tmde.measurementPoint.value);

        const tmdeSpecComponents = tmdeBreakdown.filter(
          (comp) => comp.absoluteHigh !== undefined && comp.absoluteLow !== undefined
        );
        if (tmdeSpecComponents.length === 0) return totalSpan;

        const tmdeHighDev = tmdeSpecComponents.reduce(
          (sum, comp) => sum + (comp.absoluteHigh - tmdeNominal),
          0
        );
        const tmdeLowDev = tmdeSpecComponents.reduce(
          (sum, comp) => sum + (comp.absoluteLow - tmdeNominal),
          0
        );

        const tmdeSpan = tmdeHighDev - tmdeLowDev;

        const tmdeUnitInfo = unitSystem.units[tmde.measurementPoint.unit];
        if (!tmdeUnitInfo || isNaN(tmdeUnitInfo.to_si)) {
          missingTmdeRef = true;
          return totalSpan;
        }
        const tmdeSpanInBase = tmdeSpan * tmdeUnitInfo.to_si;
        const tmdeSpanInUutNative = tmdeSpanInBase / targetUnitInfo.to_si;

        return totalSpan + tmdeSpanInUutNative;
      }, 0);
    }

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

    const mid = (LUp + LLow) / 2;
    const LUp_symmetric = Math.abs(LUp - mid);
    const uDev = LUp_symmetric / probit((1 + reliability) / 2);
    const uUUT2 = uDev ** 2 - uCal_Native ** 2;
    let uUUT = 0;
    if (uUUT2 <= 0) {
      setNotification({
        title: "Calc Warning",
        message: `uCal (${uCal_Native.toFixed(
          3
        )}) exceeds uDev (${uDev.toFixed(
          3
        )}) for reliability ${reliability}. UUT unc treated as zero.`,
      });
      uUUT = 0;
    } else {
      uUUT = Math.sqrt(uUUT2);
    }

    const ALow = LLow * guardBandMultiplier;
    const AUp = LUp * guardBandMultiplier;
    const correlation = uUUT === 0 || uDev === 0 ? 0 : uUUT / uDev;
    const LLow_norm = LLow - mid;
    const LUp_norm = LUp - mid;
    const ALow_norm = ALow - mid;
    const AUp_norm = AUp - mid;

    const pfa_term1 =
      bivariateNormalCDF(LLow_norm / uUUT, AUp_norm / uDev, correlation) -
      bivariateNormalCDF(LLow_norm / uUUT, ALow_norm / uDev, correlation);
    const pfa_term2 =
      bivariateNormalCDF(-LUp_norm / uUUT, -ALow_norm / uDev, correlation) -
      bivariateNormalCDF(-LUp_norm / uUUT, -AUp_norm / uDev, correlation);
    const pfaResult =
      isNaN(pfa_term1) || isNaN(pfa_term2) ? 0 : pfa_term1 + pfa_term2;

    const pfr_term1 =
      bivariateNormalCDF(LUp_norm / uUUT, ALow_norm / uDev, correlation) -
      bivariateNormalCDF(LLow_norm / uUUT, ALow_norm / uDev, correlation);
    const pfr_term2 =
      bivariateNormalCDF(-LLow_norm / uUUT, -AUp_norm / uDev, correlation) -
      bivariateNormalCDF(-LUp_norm / uUUT, -AUp_norm / uDev, correlation);
    const pfrResult =
      isNaN(pfr_term1) || isNaN(pfr_term2) ? 0 : pfr_term1 + pfr_term2;

    const U_Base = calcResults.expanded_uncertainty_absolute_base;
    const U_Native = U_Base / targetUnitInfo.to_si;

    const turResult = (LUp - LLow) / (2 * U_Native);
    const tarResult =
      tmdeToleranceSpan_Native !== 0
        ? (LUp - LLow) / tmdeToleranceSpan_Native
        : 0;

    setRiskResults({
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
      correlation,
      ALow: ALow,
      AUp: AUp,
      expandedUncertainty: U_Native,
      tmdeToleranceSpan: tmdeToleranceSpan_Native,
      nativeUnit: nominalUnit,
    });
  }, [
    riskInputs.LLow,
    riskInputs.LUp,
    sessionData,
    uutNominal,
    calcResults,
    tmdeTolerancesData,
    setNotification,
    setRiskResults
  ]);

  useEffect(() => {
    const shouldCalculate = (analysisMode === "risk" || analysisMode === "uncertaintyTool");

    if (shouldCalculate && calcResults) {
      calculateRiskMetrics();
    }
    
    // If we are NOT on a tab that shows risk, clear the results
    if (!shouldCalculate) {
      setRiskResults(prevResults => {
        if (prevResults !== null) {
          return null; // Only set to null if it's not already null
        }
        return prevResults;
      });
    }
  }, [
    analysisMode, 
    calcResults, 
    sessionData.uncReq.reliability, 
    sessionData.uncReq.guardBandMultiplier,
    calculateRiskMetrics,
    setRiskResults
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
        // Handle 'direct' measurementType
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

        uutResolutionComponents.forEach((comp) => {
          totalVariancePPM += comp.value ** 2;
          componentsForBudgetTable.push(comp);
        });

        const tmdeComponents = tmdeTolerancesData
          .flatMap((tmde) => {
            if (tmde.measurementPoint && tmde.measurementPoint.value) {
              return getBudgetComponentsFromTolerance(
                tmde,
                tmde.measurementPoint
              );
            }
            return [];
          })
          .map((c) => ({
            ...c,
            sourcePointLabel: `${uutNominal.value} ${uutNominal.unit}`,
          }));
        tmdeComponents.forEach((comp) => {
          totalVariancePPM += comp.value ** 2;
          componentsForBudgetTable.push(comp);
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
            newResults.combined_uncertainty_inputs_native, // Save intermediate
          combined_uncertainty_inputs_base:
            newResults.combined_uncertainty_inputs_base, // Save intermediate
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
    };

    setDerivedBreakdownData(breakdownPayload);
    setIsDerivedBreakdownOpen(true);
  };

  const handleSaveTmde = (tmdeToSave) => {
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
    setAddTmdeModalOpen(false);
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
          className={analysisMode === "spec" ? "active" : ""}
          onClick={() => setAnalysisMode("spec")}
        >
          Specification Comparison
        </button>
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
              {tmdeTolerancesData.map((tmde, index) => {
                const referencePoint = tmde.measurementPoint;
                if (!referencePoint?.value || !referencePoint?.unit) {
                  console.warn("TMDE missing ref:", tmde);
                  return (
                    <div
                      key={tmde.id || index}
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
                    key={tmde.id || index}
                    className="tmde-seal"
                    onClick={() =>
                      handleOpenSessionEditor("tmdes", {
                        tmde,
                        testPoint: testPointData,
                      })
                    }
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({
                        x: e.pageX,
                        y: e.pageY,
                        items: [
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
                        ],
                      });
                    }}
                  >
                    <div className="uut-seal-content">
                      <span className="seal-label">TMDE</span>
                      <h4 className="seal-title">{tmde.name || "TMDE"}</h4>
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
                        <span>Measurement Point</span>
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
                        <span>Std. Unc (u)</span>
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
            <Accordion title="Uncertainty Budget" startOpen={true}>
              {calculationError ? (
              <div className="form-section-warning">
                <p><strong>Calculation Error:</strong> {calculationError}</p>
                <p style={{ marginTop: '5px', fontSize: '0.9rem', color: 'var(--text-color-muted)'}}>
                  Please ensure all required fields are set (e.g., UUT nominal, equation, and all mapped TMDEs).
                </p>
              </div>
            ) : (
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
              />
            )}
            </Accordion>
          </div>
        </div>
      )}
      {analysisMode === "risk" && (
        <Accordion title="Risk & Conformance Analysis" startOpen={true}>
          {!calcResults ? (
            <div className="form-section-warning">
              <p>Uncertainty budget must be calculated first.</p>
            </div>
          ) : (
            <>         
              {riskResults ? (
                <RiskAnalysisDashboard
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
        </Accordion>
      )}
      {analysisMode === "spec" && (
        <Accordion title="Specification Comparison Analysis" startOpen={true}>
          {renderSpecComparison()}
        </Accordion>
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
        // FIX: These lines ensure the app state is correct after deleting the last session
        setSelectedSessionId(firstSession.id);
        setSelectedTestPointId(null);
        return [firstSession];
      }
      return newSessions;
    });
  };

  const handleSessionChange = (updatedSession) => {
    setSessions((prevSessions) => 
      prevSessions.map((s) => (s.id === updatedSession.id ? updatedSession : s))
    );
    setEditingSession(null);
  };

  const handleSaveToFile = async () => {
    let now = new Date();

    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const year = now.getFullYear();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const formattedDate = `${month}/${day}/${year}`;
    const formattedTime = `${hours}:${minutes}:${seconds}`;

    const currentSession = sessions.find((s) => s.id === selectedSessionId);
    if (!currentSession) return;

    const fileName = `MUA_${currentSession.uutDescription || "Session_"}${formattedDate + "_" + formattedTime}.pdf`;

    const jsonData = JSON.stringify(currentSession, null, 2);
    
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 12;

    const summaryText = `Session Summary\n\nDescription: ${currentSession.uutDescription}\nDate: ${formattedDate} ${formattedTime}`;
    page.drawText(summaryText, {
      x: 50,
      y: height - 50,
      size: fontSize,
      font,
      lineHeight: 16,
    });

    pdfDoc.setTitle(fileName);
    pdfDoc.setSubject('MUA Session Data');
    pdfDoc.setKeywords(['MUA', 'Session', 'JSON']);
    pdfDoc.setProducer('MUA Tool');
    pdfDoc.setCreator('MUA Tool');
    pdfDoc.setCreationDate(now);
    pdfDoc.setModificationDate(now);
    
    const lineHeight = 10;
    const margin = 50;
    const maxWidth = width - margin * 2;

    const jsonLines = jsonData.split('\n');
    let y = height - margin;
    let metadataPage = pdfDoc.addPage();

    for (const line of jsonLines) {
      if (y < margin) {
        metadataPage = pdfDoc.addPage();
        y = height - margin;
      }

      metadataPage.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
      });

      y -= lineHeight;
    }

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

  // App.js

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
    <div className="App">
      <AddTestPointModal
        isOpen={isAddModalOpen || !!editingTestPoint}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTestPoint(null);
        }}
        onSave={handleSaveTestPoint}
        initialData={editingTestPoint}
        hasExistingPoints={currentTestPoints.length > 0}
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
        initialSection={initialSessionTab}
        initialTmdeToEdit={initialTmdeToEdit}
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
          <label className="dark-mode-toggle">
            <input
              type="checkbox"
              checked={isDarkMode}
              onChange={() => setIsDarkMode(!isDarkMode)}
            />
            <span className="slider"></span>
          </label>
        </div>
        <div className="results-workflow-container">
          <aside className="results-sidebar">
            <div className="sidebar-header" style={{ alignItems: "flex-end" }}>
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
            <p className="sidebar-hint">
              Check items to include them in the budget.
            </p>
            <div className="measurement-point-list">
              {currentTestPoints.length > 0 ? (
                currentTestPoints.map((tp) => (
                  <button
                    key={tp.id}
                    onClick={() => setSelectedTestPointId(tp.id)}
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
  );
}

export default App;
