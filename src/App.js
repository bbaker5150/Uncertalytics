import React, { useState, useMemo, useEffect, useCallback } from "react";
import { probit, erf } from "simple-statistics";
import Latex from "react-latex-next";
import "katex/dist/katex.min.css";
import "./App.css";
import AddTestPointModal from "./components/AddTestPointModal";
import TestPointDetailView from "./components/TestPointDetailView";
import ToleranceToolModal from "./components/ToleranceToolModal";
import EditSessionModal from "./components/EditSessionModal";
import ContextMenu from "./components/ContextMenu";
import FullBreakdownModal from "./components/FullBreakdownModal";
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

function bivariateNormalCDF(x, y, rho) {
  if (rho === null || isNaN(rho) || rho > 1 || rho < -1) {
    return NaN;
  }
  if (rho === 0)
    return (
      (((1 + erf(x / Math.sqrt(2))) / 2) * (1 + erf(y / Math.sqrt(2)))) / 2
    );
  if (rho === 1) return (1 + erf(Math.min(x, y) / Math.sqrt(2))) / 2;
  if (rho === -1)
    return Math.max(
      0,
      (1 + erf(x / Math.sqrt(2))) / 2 + (1 + erf(y / Math.sqrt(2))) / 2 - 1
    );
  const rho2 = rho * rho;
  let result = 0;
  if (rho2 < 1) {
    const t = (y - rho * x) / Math.sqrt(1 - rho2);
    const biv_g =
      (1 / (2 * Math.PI * Math.sqrt(1 - rho2))) *
      Math.exp(-(x * x - 2 * rho * x * y + y * y) / (2 * (1 - rho2)));
    if (x * y * rho > 0) {
      const L =
        (((1 + erf(x / Math.sqrt(2))) / 2) * (1 + erf(t / Math.sqrt(2)))) / 2;
      let sum = 0;
      for (let i = 0; i < 5; i++) {
        sum +=
          Math.pow(rho, i + 1) /
          ((i + 1) *
            Math.pow(2, i / 2 + 1) *
            Math.exp(Math.log(i + 1) * 2) *
            Math.PI);
      }
      result = L - biv_g * sum;
    } else {
      const L =
        (((1 + erf(x / Math.sqrt(2))) / 2) * (1 + erf(t / Math.sqrt(2)))) / 2;
      result = L - bivariateNormalCDF(x, t, 0);
    }
  }
  return result < 0 ? 0 : result > 1 ? 1 : result;
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
  useTDistribution,
  setUseTDistribution,
  displayUnit,
  setDisplayUnit,
  unitOptions,
  referencePoint,
  uncertaintyConfidence,
}) => {
  const totalUncertaintyPPM = useMemo(() => {
    if (!components || components.length === 0) return 0;
    const combinedVariance = components.reduce((sum, comp) => {
      const value = typeof comp.value === "number" ? comp.value : 0;
      return sum + Math.pow(value, 2);
    }, 0);
    return Math.sqrt(combinedVariance);
  }, [components]);

  const confidencePercent = parseFloat(uncertaintyConfidence) || 95;

  // Convert both combined and expanded uncertainty to the selected display unit
  const displayedCombinedUncertainty = convertPpmToUnit(
    totalUncertaintyPPM,
    displayUnit,
    referencePoint
  );
  const displayedExpandedUncertainty = calcResults
    ? convertPpmToUnit(
        calcResults.expanded_uncertainty,
        displayUnit,
        referencePoint
      )
    : 0;

  const renderTBody = (title, filteredComponents) => {
    if (filteredComponents.length === 0) return null;
    return (
      <React.Fragment key={title}>
        <tr className="category-header">
          <td colSpan="6">{title}</td>
        </tr>
        {filteredComponents.map((c) => {
          const displayedValue = convertPpmToUnit(
            c.value,
            displayUnit,
            referencePoint
          );
          const formattedValue =
            typeof displayedValue === "number"
              ? displayedValue.toPrecision(4)
              : displayedValue;

          return (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.type}</td>
              <td>{formattedValue}</td>
              <td>{c.distribution}</td>
              <td>{c.dof === Infinity ? "∞" : (c.dof ?? 0).toFixed(0)}</td>
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
      </React.Fragment>
    );
  };

  const typeAComponents = components.filter((c) => c.type === "A");
  const typeBComponents = components.filter((c) => c.type === "B");

  const formattedDof = calcResults
    ? calcResults.effective_dof === Infinity ||
      calcResults.effective_dof === null
      ? "∞"
      : calcResults.effective_dof.toFixed(2)
    : "N/A";

  return (
    <table className="uncertainty-budget-table">
      <thead>
        <tr>
          <th>Uncertainty Component</th>
          <th>Type</th>
          <th>
            <div className="header-with-select">
              <span>uᵢ</span>
              <select
                value={displayUnit}
                onChange={(e) => setDisplayUnit(e.target.value)}
              >
                {unitOptions.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </th>
          <th>Distribution</th>
          <th>vᵢ (dof)</th>
          <th style={{ width: "50px" }}></th>
        </tr>
      </thead>
      <tbody>
        {renderTBody("Type A Components", typeAComponents)}
        {renderTBody("Type B Components", typeBComponents)}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan="2">{"Combined Standard Uncertainty (uₑ)"}</td>
          <td>
            {typeof displayedCombinedUncertainty === "number"
              ? displayedCombinedUncertainty.toPrecision(4)
              : displayedCombinedUncertainty}
          </td>
          <td colSpan="3"></td>
        </tr>
        {calcResults && (
          <>
            <tr>
              <td colSpan="2">{"Effective Degrees of Freedom (vₑₒₒ)"}</td>
              <td>{formattedDof}</td>
              <td colSpan="3"></td>
            </tr>
            <tr>
              <td colSpan="2">{"Coverage Factor (k)"}</td>
              <td>{calcResults.k_value.toFixed(3)}</td>
              {/* <td colSpan="3" className="k-factor-cell">
                <label htmlFor="use-t-dist" className="k-factor-label">
                  <input
                    type="checkbox"
                    id="use-t-dist"
                    checked={useTDistribution}
                    onChange={(e) => setUseTDistribution(e.target.checked)}
                  />
                  Use t-dist
                </label>
              </td> */}
            </tr>
            <tr className="final-uncertainty-row">
              <td colSpan="6">
                <div className="final-result-display">
                  <span className="final-result-label">
                    Expanded Uncertainty (U)
                  </span>
                  <div className="final-result-value">
                    ±{" "}
                    {typeof displayedExpandedUncertainty === "number"
                      ? displayedExpandedUncertainty.toPrecision(5)
                      : "N/A"}
                    <span className="final-result-unit">{displayUnit}</span>
                  </div>
                  <span className="final-result-confidence-note">
                    The reported expanded uncertainty of measurement is stated
                    as the standard uncertainty of measurement multiplied by the
                    coverage factor{" "}
                    <strong>k≈{calcResults.k_value.toFixed(3)}</strong>, which
                    for a t-distribution with vₑₒₒ = {formattedDof} corresponds
                    to a coverage probability of approximately{" "}
                    <strong>{confidencePercent}%</strong>.
                  </span>
                </div>
              </td>
            </tr>
          </>
        )}
      </tfoot>
    </table>
  );
};

const FinalUncertaintyCard = ({ calcResults, testPointInfo }) => {
  const hasInfo =
    testPointInfo && testPointInfo.parameter && testPointInfo.qualifier;

  return (
    <>
      <p
        style={{
          fontSize: "0.9rem",
          color: "#6c757d",
          marginTop: "10px",
          textAlign: "center",
        }}
      >
        {hasInfo ? (
          <>
            {testPointInfo.parameter.name}: {testPointInfo.parameter.value}{" "}
            {testPointInfo.parameter.unit}
            {testPointInfo.qualifier && testPointInfo.qualifier.value && (
              <>
                <br />
                {testPointInfo.qualifier.name}: {testPointInfo.qualifier.value}{" "}
                {testPointInfo.qualifier.unit}
              </>
            )}
          </>
        ) : (
          "Legacy Measurement Point Selected"
        )}
      </p>

      {!calcResults ? (
        <div style={{ textAlign: "center", padding: "20px" }}>
          <p className="placeholder-text">
            The uncertainty budget has not been calculated.
            <br />
            Please define the UUT/TMDE and any other components to display the
            results.
          </p>
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <div className="final-result-value">
            U = ± <span>{calcResults.expanded_uncertainty.toFixed(3)}</span> ppm
          </div>
          <ul className="result-breakdown">
            <li>
              <span className="label">Combined Uncertainty (uₑ)</span>
              <span className="value">
                {calcResults.combined_uncertainty.toFixed(4)} ppm
              </span>
            </li>
            <li>
              <span className="label">Effective DoF (vₑₒₒ)</span>
              <span className="value">
                {calcResults.effective_dof === Infinity ||
                calcResults.effective_dof === null
                  ? "∞"
                  : calcResults.effective_dof.toFixed(2)}
              </span>
            </li>
            <li>
              <span className="label">Coverage Factor (k)</span>
              <span className="value">{calcResults.k_value.toFixed(3)}</span>
            </li>
          </ul>
          <p className="result-confidence-note">
            The reported expanded uncertainty of measurement is stated as the
            standard uncertainty of measurement multiplied by the coverage
            factor k={calcResults.k_value.toFixed(3)}, which for a
            t-distribution with vₑₒₒ ={" "}
            {calcResults.effective_dof === Infinity ||
            calcResults.effective_dof === null
              ? "∞"
              : calcResults.effective_dof.toFixed(2)}{" "}
            corresponds to a coverage probability of approximately 95%.
          </p>
        </div>
      )}
    </>
  );
};

const InputsBreakdownModal = ({ results, inputs, onClose }) => {
  const mid = (inputs.LUp + inputs.LLow) / 2;
  const LUp_symmetric = Math.abs(inputs.LUp - mid);

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
          <Latex>{`$$ u_{cal} = \\sqrt{\\sum_{i=1}^{N} u_i^2} = \\mathbf{${results.uCal.toFixed(
            4
          )}} \\text{ ppm} $$`}</Latex>
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
            2
          )}}{\\Phi^{-1}((1+${inputs.reliability})/2)} = ${results.uDev.toFixed(
            4
          )} \\text{ ppm} $$`}</Latex>
          2. UUT Uncertainty:{" "}
          <Latex>{`$$ u_{UUT} = \\sqrt{u_{dev}^2 - u_{cal}^2} = \\sqrt{${results.uDev.toFixed(
            4
          )}^2 - ${results.uCal.toFixed(
            4
          )}^2} = \\mathbf{${results.uUUT.toFixed(4)}} \\text{ ppm} $$`}</Latex>
        </div>
        <div className="breakdown-step">
          <h5>Acceptance Limits (A)</h5>
          <p>
            Calculated by applying the **Guard Band Multiplier** to the
            tolerance limits.
          </p>
          <Latex>{`$$ A_{Low} = L_{Low} \\times G = ${inputs.LLow.toFixed(
            2
          )} \\times ${
            inputs.guardBandMultiplier
          } = \\mathbf{${results.ALow.toFixed(4)}} \\text{ ppm} $$`}</Latex>
          <Latex>{`$$ A_{Up} = L_{Up} \\times G = ${inputs.LUp.toFixed(
            2
          )} \\times ${
            inputs.guardBandMultiplier
          } = \\mathbf{${results.AUp.toFixed(4)}} \\text{ ppm} $$`}</Latex>
        </div>
        <div className="breakdown-step">
          <h5>Correlation (ρ)</h5>
          <p>
            The statistical correlation between the UUT's true value and the
            measured value.
          </p>
          <Latex>{`$$ \\rho = \\frac{u_{UUT}}{u_{dev}} = \\frac{${results.uUUT.toFixed(
            4
          )}}{${results.uDev.toFixed(
            4
          )}} = \\mathbf{${results.correlation.toFixed(4)}} $$`}</Latex>
        </div>
      </div>
    </div>
  );
};

const TurBreakdownModal = ({ results, inputs, onClose }) => {
  if (!results || !inputs) return null;
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
            to the expanded measurement uncertainty.
          </p>
          <Latex>{"$$ TUR = \\frac{L_{Upper} - L_{Lower}}{U_{95}} $$"}</Latex>
        </div>
        <div className="breakdown-step">
          <h5>Step 2: Inputs</h5>
          <ul>
            <li>
              Tolerance Span:{" "}
              <Latex>{`$$ L_{Upper} - L_{Lower} = ${inputs.LUp.toFixed(
                2
              )} - (${inputs.LLow.toFixed(2)}) = ${(
                inputs.LUp - inputs.LLow
              ).toFixed(2)} \\text{ ppm} $$`}</Latex>
            </li>
            <li>
              Expanded Uncertainty:{" "}
              <Latex>{`$$ U_{95} = ${results.expandedUncertainty.toFixed(
                4
              )} \\text{ ppm} $$`}</Latex>
            </li>
          </ul>
        </div>
        <div className="breakdown-step">
          <h5>Step 3: Final Calculation</h5>
          <Latex>{`$$ TUR = \\frac{${(inputs.LUp - inputs.LLow).toFixed(
            2
          )}}{${results.expandedUncertainty.toFixed(
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
              )}} \\text{ ppm} $$`}</Latex>
            </li>
            <li>
              TMDE Tolerance Span:{" "}
              <Latex>{`$$ \\mathbf{${tmdeToleranceSpan.toFixed(
                2
              )}} \\text{ ppm} $$`}</Latex>{" "}
              <em>
                (Derived from the 'Standard Instrument' component in the budget)
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

  return (
    <div className="risk-analysis-container">
      <div className="risk-analysis-dashboard">
        <div className="risk-card">
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
              <span className="label">Std. Unc. of Cal (uₑₐₗ)</span>
              <span className="value">{results.uCal.toFixed(3)} ppm</span>
            </li>
            <li>
              <span className="label">Std. Unc. of UUT (uᵤᵤₜ)</span>
              <span className="value">{results.uUUT.toFixed(3)} ppm</span>
            </li>
            <li>
              <span className="label">Acceptance Limit (Aₗₒw)</span>
              <span className="value">{results.ALow.toFixed(3)} ppm</span>
            </li>
            <li>
              <span className="label">Acceptance Limit (Aᵤₚ)</span>
              <span className="value">{results.AUp.toFixed(3)} ppm</span>
            </li>
          </ul>
          <button
            className="button button-small breakdown-button"
            onClick={() => onShowBreakdown("inputs")}
          >
            Show Breakdown
          </button>
        </div>
        <div className="risk-card tur-card">
          <div className="risk-value">{results.tur.toFixed(2)} : 1</div>
          <div className="risk-label">Test Uncertainty Ratio (TUR)</div>
          <div className="risk-explanation">
            A ratio of the UUT's tolerance to the measurement uncertainty.
          </div>
          <button
            className="button button-small breakdown-button"
            onClick={() => onShowBreakdown("tur")}
          >
            Show Breakdown
          </button>
        </div>
        <div className="risk-card tur-card">
          <div className="risk-value">{results.tar.toFixed(2)} : 1</div>
          <div className="risk-label">Test Acceptance Ratio (TAR)</div>
          <div className="risk-explanation">
            A ratio of the UUT's tolerance span to the TMDE's (Standard's)
            tolerance span.
          </div>
          <button
            className="button button-small breakdown-button"
            onClick={() => onShowBreakdown("tar")}
          >
            Show Breakdown
          </button>
        </div>
        <div className={`risk-card pfa-card ${getPfaClass(results.pfa)}`}>
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
          <button
            className="button button-small breakdown-button"
            onClick={() => onShowBreakdown("pfa")}
          >
            Show Breakdown
          </button>
        </div>
        <div className="risk-card pfr-card">
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
          <button
            className="button button-small breakdown-button"
            onClick={() => onShowBreakdown("pfr")}
          >
            Show Breakdown
          </button>
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

    let halfSpanPPM;
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
    }

    if (!isNaN(halfSpanPPM)) {
      const u_i = Math.abs(halfSpanPPM / distributionDivisor);
      budgetComponents.push({
        id: `${prefix}_${name
          .toLowerCase()
          .replace(/\s/g, "")}_${Math.random()}`,
        name: `${prefix} - ${name}`,
        type: "B",
        value: u_i,
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

function Analysis({
  sessionData,
  testPointData,
  onDataSave,
  defaultTestPoint,
  setContextMenu,
  setBreakdownPoint,
  handleOpenSessionEditor,
}) {
  const { specifications: initialSpecs, components: initialManualComponents } =
    testPointData;

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const [year, month, day] = dateString.split("-");
    return `${month}/${day}/${year}`;
  };

  const [isAddTmdeModalOpen, setAddTmdeModalOpen] = useState(false);
  const [analysisMode, setAnalysisMode] = useState("uncertaintyTool");
  const [manualComponents, setManualComponents] = useState(
    initialManualComponents || []
  );
  const [specInput, setSpecInput] = useState(
    initialSpecs || defaultTestPoint.specifications
  );
  const [newComponent, setNewComponent] = useState({
    name: "",
    type: "B",
    errorDistributionDivisor: "1.732",
    toleranceLimit: "",
    unit: "ppm",
    standardUncertainty: "",
    dof: "Infinity",
  });
  const [useTDistribution, setUseTDistribution] = useState(false);
  const [calcResults, setCalcResults] = useState(null);
  const [riskInputs, setRiskInputs] = useState({
    LLow: "",
    LUp: "",
    reliability: 0.95,
    guardBandMultiplier: 1,
  });
  const [riskResults, setRiskResults] = useState(null);
  const [breakdownModal, setLocalBreakdownModal] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isAddComponentModalOpen, setAddComponentModalOpen] = useState(false);
  const [displayUnit, setDisplayUnit] = useState(testPointData?.testPointInfo?.parameter?.unit || "ppm");

  const uutToleranceData = useMemo(
    () => sessionData.uutTolerance || {},
    [sessionData.uutTolerance]
  );
  const tmdeTolerancesData = useMemo(
    () => testPointData.tmdeTolerances || [],
    [testPointData.tmdeTolerances]
  );

  useEffect(() => {
    const {
      specifications: newSpecs,
      components: newManualComponents,
      ...newResults
    } = testPointData;

    setManualComponents(newManualComponents || []);
    setSpecInput(newSpecs || defaultTestPoint.specifications);
    setCalcResults(
      newResults.is_detailed_uncertainty_calculated ? { ...newResults } : null
    );
    setRiskResults(null);
  }, [testPointData, defaultTestPoint]);

  useEffect(() => {
    const handler = setTimeout(() => {
      onDataSave({ specifications: specInput });
    }, 500);
    return () => clearTimeout(handler);
  }, [specInput, onDataSave]);

  useEffect(() => {
    const nominal = testPointData?.testPointInfo?.parameter;
    const { totalToleranceForTar } = calculateUncertaintyFromToleranceObject(
      uutToleranceData, // Use session-level UUT tolerance
      nominal
    );

    if (totalToleranceForTar > 0) {
      setRiskInputs((prev) => ({
        ...prev,
        LLow: -totalToleranceForTar,
        LUp: totalToleranceForTar,
      }));
    } else {
      setRiskInputs((prev) => ({ ...prev, LLow: "", LUp: "" }));
    }
  }, [testPointData, uutToleranceData]);

  const allComponents = useMemo(() => {
    const uutNominal = testPointData?.testPointInfo?.parameter;

    const tmdeBudgetComponents = tmdeTolerancesData.flatMap((tmde) => {
      if (tmde.measurementPoint && tmde.measurementPoint.value) {
        return getBudgetComponentsFromTolerance(tmde, tmde.measurementPoint);
      }
      return [];
    });

    const allUutComponents = getBudgetComponentsFromTolerance(
      uutToleranceData,
      uutNominal
    );

    // Only include the UUT's resolution in the uncertainty budget, not its own tolerance spec.
    const uutBudgetComponents = allUutComponents.filter((comp) =>
      comp.name.endsWith(" - Resolution")
    );

    return [
      ...manualComponents,
      ...tmdeBudgetComponents,
      ...uutBudgetComponents,
    ];
  }, [
    manualComponents,
    tmdeTolerancesData,
    uutToleranceData,
    testPointData.testPointInfo,
  ]);

  useEffect(() => {
    if (allComponents.length === 0) {
      setCalcResults(null);
      return;
    }
    const combinedVariance = allComponents.reduce(
      (sum, comp) => sum + Math.pow(comp.value, 2),
      0
    );
    const combinedUncertainty = Math.sqrt(combinedVariance);
    const numerator = Math.pow(combinedUncertainty, 4);
    const denominator = allComponents.reduce(
      (sum, comp) =>
        comp.dof === Infinity ? sum : sum + Math.pow(comp.value, 4) / comp.dof,
      0
    );
    const effectiveDof = denominator > 0 ? numerator / denominator : Infinity;
    const confidencePercent =
      parseFloat(sessionData.uncertaintyConfidence) || 95;
    const probability = 1 - (1 - confidencePercent / 100) / 2;

    const kValue = useTDistribution
      ? getKValueFromTDistribution(effectiveDof)
      : probit(probability);

    const expandedUncertainty = kValue * combinedUncertainty;

    const newResults = {
      combined_uncertainty: combinedUncertainty,
      effective_dof: effectiveDof,
      k_value: kValue,
      expanded_uncertainty: expandedUncertainty,
      is_detailed_uncertainty_calculated: true,
    };
    setCalcResults(newResults);
    onDataSave({ ...newResults, components: manualComponents });
  }, [
    allComponents,
    useTDistribution,
    onDataSave,
    manualComponents,
    sessionData.uncertaintyConfidence,
  ]);

  const handleSaveTmde = (newTmde) => {
    const updatedTolerances = [...tmdeTolerancesData, newTmde];
    onDataSave({ tmdeTolerances: updatedTolerances });
    setAddTmdeModalOpen(false);
  };

  const handleAddComponent = () => {
    let valueInPPM = NaN;
    let dof =
      newComponent.dof === "Infinity" ? Infinity : parseFloat(newComponent.dof);
    const nominal = testPointData?.testPointInfo?.parameter;

    if (newComponent.type === "A") {
      const stdUnc = parseFloat(newComponent.standardUncertainty);
      if (isNaN(stdUnc) || stdUnc <= 0 || isNaN(dof) || dof < 1) {
        setNotification({
          title: "Invalid Input",
          message:
            "For Type A, please provide a valid positive Standard Uncertainty and Degrees of Freedom (>=1).",
        });
        return;
      }
      const { value: ppm, warning } = convertToPPM(
        stdUnc,
        newComponent.unit,
        nominal?.value,
        nominal?.unit,
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
            "Please provide a valid, positive tolerance limit and select a distribution.",
        });
        return;
      }
      const { value: ppm, warning } = convertToPPM(
        rawValue,
        newComponent.unit,
        nominal?.value,
        nominal?.unit,
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
        message:
          "Component name and a valid, convertible uncertainty value are required.",
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
    setManualComponents(updatedComponents);
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
    setManualComponents(updatedComponents);
  };

  const handleNewComponentInputChange = (e) =>
    setNewComponent((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  const handleRiskInputChange = (e) => {
    const { name, value } = e.target;
    setRiskInputs((prev) => ({ ...prev, [name]: value }));
  };

  const calculateRiskMetrics = () => {
    // This function's logic is preserved from your original file
    const LLow = parseFloat(riskInputs.LLow);
    const LUp = parseFloat(riskInputs.LUp);
    const reliability = parseFloat(riskInputs.reliability);
    const guardBandMultiplier = parseFloat(riskInputs.guardBandMultiplier);

    if (isNaN(LLow) || isNaN(LUp) || LUp <= LLow) {
      setNotification({
        title: "Invalid Input",
        message: "Please enter valid UUT tolerance limits.",
      });
      return;
    }
    if (isNaN(reliability) || reliability <= 0 || reliability >= 1) {
      setNotification({
        title: "Invalid Input",
        message: "Please enter a valid reliability (e.g., 0.95).",
      });
      return;
    }
    if (
      isNaN(guardBandMultiplier) ||
      guardBandMultiplier < 0 ||
      guardBandMultiplier > 1
    ) {
      setNotification({
        title: "Invalid Input",
        message: "Guard Band Multiplier must be between 0 and 1.",
      });
      return;
    }
    if (!calcResults) {
      setNotification({
        title: "Calculation Required",
        message: "An uncertainty budget must be calculated first.",
      });
      return;
    }

    const uutNominal = testPointData?.testPointInfo?.parameter;
    const calibrationComponents = allComponents.filter(
      (c) => !c.name.startsWith("UUT")
    );
    const calVariance = calibrationComponents.reduce(
      (sum, comp) => sum + Math.pow(comp.value, 2),
      0
    );
    const uCal = Math.sqrt(calVariance);

    let tmdeToleranceSpan = 0;
    let missingTmdeRef = false;

    if (tmdeTolerancesData.length > 0) {
      tmdeToleranceSpan = tmdeTolerancesData.reduce((totalSpan, tmde) => {
        if (!tmde.measurementPoint || !tmde.measurementPoint.value) {
          missingTmdeRef = true;
          return totalSpan;
        }
        const { totalToleranceForTar } =
          calculateUncertaintyFromToleranceObject(tmde, tmde.measurementPoint);
        return totalSpan + totalToleranceForTar;
      }, 0);
    }

    if (missingTmdeRef) {
      setNotification({
        title: "Missing Information",
        message:
          "One or more TMDE components are missing a Reference Measurement Point, which is required for TAR calculation. They will be ignored.",
      });
    } else if (tmdeToleranceSpan === 0 && LUp - LLow > 0) {
      setNotification({
        title: "Missing Component",
        message:
          "Could not find any TMDE tolerances required for the TAR calculation. Please define them using the Tolerance Editor.",
      });
    }

    const mid = (LUp + LLow) / 2;
    const LUp_symmetric = Math.abs(LUp - mid);
    const uDev = LUp_symmetric / probit((1 + reliability) / 2);

    const uUUT2 = uDev ** 2 - uCal ** 2;
    let uUUT = 0;
    if (uUUT2 <= 0) {
      setNotification({
        title: "Calculation Warning",
        message: `The calibration uncertainty (uCal=${uCal.toFixed(
          3
        )}) is greater than the required deviation uncertainty (uDev=${uDev.toFixed(
          3
        )}) for the specified reliability. UUT uncertainty will be treated as zero.`,
      });
      uUUT = 0;
    } else {
      uUUT = Math.sqrt(uUUT2);
    }

    const ALow = LLow * guardBandMultiplier;
    const AUp = LUp * guardBandMultiplier;
    const uDev_risk = Math.sqrt(uUUT ** 2 + uCal ** 2);
    const correlation = uUUT === 0 || uDev_risk === 0 ? 0 : uUUT / uDev_risk;
    const LLow_norm = LLow - mid;
    const LUp_norm = LUp - mid;
    const ALow_norm = ALow - mid;
    const AUp_norm = AUp - mid;

    const pfa_term1 =
      bivariateNormalCDF(LLow_norm / uUUT, AUp_norm / uDev_risk, correlation) -
      bivariateNormalCDF(LLow_norm / uUUT, ALow_norm / uDev_risk, correlation);
    const pfa_term2 =
      bivariateNormalCDF(
        -LUp_norm / uUUT,
        -ALow_norm / uDev_risk,
        correlation
      ) -
      bivariateNormalCDF(-LUp_norm / uUUT, -AUp_norm / uDev_risk, correlation);
    const pfaResult =
      isNaN(pfa_term1) || isNaN(pfa_term2) ? 0 : pfa_term1 + pfa_term2;

    const pfr_term1 =
      bivariateNormalCDF(LUp_norm / uUUT, ALow_norm / uDev_risk, correlation) -
      bivariateNormalCDF(LLow_norm / uUUT, ALow_norm / uDev_risk, correlation);
    const pfr_term2 =
      bivariateNormalCDF(
        -LLow_norm / uUUT,
        -AUp_norm / uDev_risk,
        correlation
      ) -
      bivariateNormalCDF(-LUp_norm / uUUT, -AUp_norm / uDev_risk, correlation);
    const pfrResult =
      isNaN(pfr_term1) || isNaN(pfr_term2) ? 0 : pfr_term1 + pfr_term2;

    const turResult = (LUp - LLow) / calcResults.expanded_uncertainty;
    const tarResult =
      tmdeToleranceSpan !== 0 ? (LUp - LLow) / tmdeToleranceSpan : 0;

    setRiskResults({
      tur: turResult,
      tar: tarResult,
      pfa: pfaResult * 100,
      pfr: pfrResult * 100,
      pfa_term1: (isNaN(pfa_term1) ? 0 : pfa_term1) * 100,
      pfa_term2: (isNaN(pfa_term2) ? 0 : pfa_term2) * 100,
      pfr_term1: (isNaN(pfr_term1) ? 0 : pfr_term1) * 100,
      pfr_term2: (isNaN(pfr_term2) ? 0 : pfr_term2) * 100,
      uCal,
      uUUT,
      uDev: uDev_risk,
      correlation,
      ALow,
      AUp,
      expandedUncertainty: calcResults.expanded_uncertainty,
      tmdeToleranceSpan: tmdeToleranceSpan,
    });
  };

  const unitOptions = useMemo(() => {
    const nominalUnit = testPointData?.testPointInfo?.parameter?.unit;
    if (!nominalUnit) return ["ppm"];
    const relevant = unitSystem.getRelevantUnits(nominalUnit);
    return ["ppm", ...relevant.filter((u) => u !== "ppm" && u !== "dB")];
  }, [testPointData]);

  useEffect(() => {
    const newUnit = testPointData?.testPointInfo?.parameter?.unit || "ppm";
    setDisplayUnit(newUnit);
}, [testPointData.id, testPointData?.testPointInfo?.parameter?.unit]);

  const renderSpecComparison = () => {
    // This function is preserved from your original file
    if (!calcResults) {
      return (
        <div className="form-section-warning">
          <p>An uncertainty budget must be calculated first.</p>
        </div>
      );
    }

    const handleSpecInputChange = (e) =>
      setSpecInput((prev) => ({
        ...prev,
        [e.target.name]: {
          ...prev[e.target.name],
          [e.target.dataset.field]: e.target.value,
        },
      }));

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
              <span className="detail-label">
                Your Expanded Uncertainty (U)
              </span>
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
    // This function is preserved from your original file
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
                  <label>Standard Uncertainty (uᵢ)</label>
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
                    nominal={testPointData?.testPointInfo?.parameter}
                  />
                </div>
                <div className="config-column">
                  <label>Degrees of Freedom (vᵢ)</label>
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
                  <label>Error Limit Distribution Type</label>
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
                    nominal={testPointData?.testPointInfo?.parameter}
                  />
                </div>
                <div className="config-column">
                  <label>Degrees of Freedom</label>
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

      {breakdownModal && <div className="modal-placeholder" />}
      {breakdownModal === "inputs" && (
        <InputsBreakdownModal
          results={riskResults}
          inputs={{
            ...riskInputs,
            LLow: parseFloat(riskInputs.LLow),
            LUp: parseFloat(riskInputs.LUp),
          }}
          onClose={() => setLocalBreakdownModal(null)}
        />
      )}
      {breakdownModal === "tur" && (
        <TurBreakdownModal
          results={riskResults}
          inputs={{
            ...riskInputs,
            LLow: parseFloat(riskInputs.LLow),
            LUp: parseFloat(riskInputs.LUp),
          }}
          onClose={() => setLocalBreakdownModal(null)}
        />
      )}
      {breakdownModal === "tar" && (
        <TarBreakdownModal
          results={riskResults}
          inputs={{
            ...riskInputs,
            LLow: parseFloat(riskInputs.LLow),
            LUp: parseFloat(riskInputs.LUp),
          }}
          onClose={() => setLocalBreakdownModal(null)}
        />
      )}
      {breakdownModal === "pfa" && (
        <PfaBreakdownModal
          results={riskResults}
          inputs={{
            ...riskInputs,
            LLow: parseFloat(riskInputs.LLow),
            LUp: parseFloat(riskInputs.LUp),
          }}
          onClose={() => setLocalBreakdownModal(null)}
        />
      )}
      {breakdownModal === "pfr" && (
        <PfrBreakdownModal
          results={riskResults}
          inputs={{
            ...riskInputs,
            LLow: parseFloat(riskInputs.LLow),
            LUp: parseFloat(riskInputs.LUp),
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
                className="uut-seal"
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
                            referencePoint:
                              testPointData.testPointInfo.parameter,
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
                    <span>Current Point</span>
                    <strong>
                      {testPointData.testPointInfo.parameter.value}{" "}
                      {testPointData.testPointInfo.parameter.unit}
                    </strong>
                  </div>
                  <div className="seal-info-item">
                    <span>Tolerance Spec</span>
                    <strong>{getToleranceSummary(uutToleranceData)}</strong>
                  </div>
                  <div className="seal-info-item">
                    <span>Calculated Error</span>
                    <strong>
                      {getToleranceErrorSummary(
                        uutToleranceData,
                        testPointData.testPointInfo.parameter
                      )}
                    </strong>
                  </div>
                  <div className="seal-limits-split">
                    <div className="seal-info-item">
                      <span>Low Limit</span>
                      <strong className="calculated-limit">
                        {
                          getAbsoluteLimits(
                            uutToleranceData,
                            testPointData.testPointInfo.parameter
                          ).low
                        }
                      </strong>
                    </div>
                    <div className="seal-info-item">
                      <span>High Limit</span>
                      <strong className="calculated-limit">
                        {
                          getAbsoluteLimits(
                            uutToleranceData,
                            testPointData.testPointInfo.parameter
                          ).high
                        }
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
                if (!referencePoint?.value) return null;
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
                        <span>Std. Uncertainty (u)</span>
                        <strong>
                          {(() => {
                            const uncertaintyPpm =
                              calculateUncertaintyFromToleranceObject(
                                tmde,
                                referencePoint
                              ).standardUncertainty;

                            const uncertaintyInBase = convertPpmToUnit(
                              uncertaintyPpm,
                              referencePoint.unit,
                              referencePoint
                            );

                            return typeof uncertaintyInBase === "number"
                              ? `${uncertaintyInBase.toPrecision(3)} ${
                                  referencePoint.unit
                                }`
                              : uncertaintyInBase;
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
            <Accordion
              title="Uncertainty Budget"
              startOpen={true}
              // actions={
              //   <button
              //     className="button button-small"
              //     onClick={() => setAddComponentModalOpen(true)}
              //     title="Add a manual uncertainty component"
              //   >
              //     <FontAwesomeIcon
              //       icon={faPlus}
              //       style={{ marginRight: "5px" }}
              //     />
              //     Add Manual
              //   </button>
              // }
            >
              <UncertaintyBudgetTable
                components={allComponents}
                onRemove={handleRemoveComponent}
                calcResults={calcResults}
                useTDistribution={useTDistribution}
                setUseTDistribution={setUseTDistribution}
                displayUnit={displayUnit}
                setDisplayUnit={setDisplayUnit}
                unitOptions={unitOptions}
                referencePoint={testPointData?.testPointInfo?.parameter}
                uncertaintyConfidence={sessionData.uncertaintyConfidence}
              />
            </Accordion>
          </div>
        </div>
      )}
      {analysisMode === "risk" && (
        <Accordion title="Risk & Conformance Analysis" startOpen={true}>
          {!calcResults ? (
            <div className="form-section-warning">
              <p>
                An uncertainty budget must be calculated first on the
                'Uncertainty Tool' tab.
              </p>
            </div>
          ) : (
            <>
              <div className="risk-inputs-container">
                <div className="config-column uut-tolerance-display">
                  <label>UUT Tolerance Limits (in ppm)</label>
                  <span>
                    LLow:{" "}
                    <strong>
                      {riskInputs.LLow
                        ? parseFloat(riskInputs.LLow).toFixed(3)
                        : "N/A"}
                    </strong>
                  </span>
                  <span>
                    LUp:{" "}
                    <strong>
                      {riskInputs.LUp
                        ? parseFloat(riskInputs.LUp).toFixed(3)
                        : "N/A"}
                    </strong>
                  </span>
                  <small>Derived from UUT tolerance specifications.</small>
                </div>
                <div className="config-column">
                  <label>Target Reliability (R)</label>
                  <input
                    type="number"
                    step="0.01"
                    max="0.9999"
                    min="0.5"
                    name="reliability"
                    value={riskInputs.reliability}
                    onChange={handleRiskInputChange}
                  />
                </div>
                <div className="config-column">
                  <label>Guard Band Multiplier</label>
                  <input
                    type="number"
                    step="0.01"
                    max="1"
                    min="0"
                    name="guardBandMultiplier"
                    value={riskInputs.guardBandMultiplier}
                    onChange={handleRiskInputChange}
                  />
                </div>
              </div>
              <button
                onClick={calculateRiskMetrics}
                className="button"
                style={{ marginTop: "10px" }}
              >
                Calculate Risk Metrics
              </button>
              {riskResults && (
                <RiskAnalysisDashboard
                  results={riskResults}
                  onShowBreakdown={(modalType) =>
                    setLocalBreakdownModal(modalType)
                  }
                />
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
    try {
      const savedSessions = localStorage.getItem("uncertaintySessions");
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          setSelectedSessionId(parsed[0].id);
          setSelectedTestPointId(parsed[0].testPoints?.[0]?.id || null);
          loadedData = true;
        }
      }
    } catch (error) {
      console.error("Failed to load data from localStorage", error);
    }

    if (!loadedData) {
      const firstSession = createNewSession();
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

  const handleSaveToFile = () => {
    const currentSession = sessions.find((s) => s.id === selectedSessionId);
    if (!currentSession) return;
    const fileName = `MUA ${currentSession.uutDescription || "Session"}.json`;
    const dataToSave = JSON.stringify(currentSession, null, 2);
    const blob = new Blob([dataToSave], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
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
              };
            }
            return tp;
          });
          return { ...session, testPoints: updatedTestPoints };
        }

        // Logic for ADDING a new test point
        else {
          const newTestPoint = {
            id: Date.now(),
            ...defaultTestPoint, // Start with defaults
            // Overwrite with new form data
            section: formData.section,
            testPointInfo: formData.testPointInfo,
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
      />

      <EditSessionModal
        isOpen={!!editingSession}
        onClose={() => setEditingSession(null)}
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
              <button
                className="add-point-button"
                onClick={() => setIsAddModalOpen(true)}
                title="Add New Measurement Point"
              >
                <FontAwesomeIcon icon={faPlus} />
              </button>
            </div>
            <p className="sidebar-hint">
              Right-click an item for more options.
            </p>
            <div className="measurement-point-list">
              {currentTestPoints.length > 0 ? (
                currentTestPoints.map((tp) => {
                  const uutSummary = getToleranceSummary(
                    currentSessionData.uutTolerance
                  );
                  const tmdeSummary = (tp.tmdeTolerances || [])
                    .map((t) => getToleranceSummary(t))
                    .join("; ");

                  const tooltipText = `UUT: ${uutSummary}\nTMDEs: ${
                    tmdeSummary || "Not Set"
                  }`;

                  return (
                    <button
                      key={tp.id}
                      onClick={() => setSelectedTestPointId(tp.id)}
                      title={tooltipText}
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
                  );
                })
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
