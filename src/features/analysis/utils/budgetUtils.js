/**
 * * This utility file contains helper functions for breaking down tolerance objects
 * into individual uncertainty budget components (e.g., Reading, Range, Floor, Resolution).
 * * It isolates the "Business Logic" of how a tolerance specification (Type B)
 * translates into a row in the Uncertainty Budget Table.
 * * Exports:
 * - oldErrorDistributions: Array of standard distribution divisors (Rectangular, Normal, etc.).
 * - getBudgetComponentsFromTolerance: The core function that parses a tolerance object.
 */

import { 
  unitSystem, 
  convertToPPM, 
  errorDistributions 
} from "../../../utils/uncertaintyMath";

export const oldErrorDistributions = [
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

export const getBudgetComponentsFromTolerance = (
  toleranceObject,
  referenceMeasurementPoint
) => {

  if (
    !toleranceObject ||
    !referenceMeasurementPoint ||
    !referenceMeasurementPoint.value ||
    !referenceMeasurementPoint.unit
  ) {
    if (toleranceObject?.name) console.groupEnd();
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
    // --- DEBUG: Component Check ---
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
      // DEBUG: Log how 'low' is calculated
      const low = parseFloat(tolComp?.low || -high);
      
      const halfSpan = (high - low) / 2;

      if (halfSpan === 0) {
          if (toleranceObject.name) console.warn(`  -> SKIPPED: HalfSpan is 0`);
          return;
      }

      const unit = tolComp.unit;
      let valueInNominalUnits;

      if (["%", "ppm", "ppb"].includes(unit)) {
        let multiplier = 0;
        if (unit === "%") multiplier = 0.01;
        else if (unit === "ppm") multiplier = 1e-6;
        else if (unit === "ppb") multiplier = 1e-9;

        // DEBUG: Check if baseValueForRelative (e.g. Range Value) is missing
        if (isNaN(baseValueForRelative)) {
             console.error(`  -> ERROR: baseValueForRelative is NaN! (Likely missing Range Value)`);
        }

        valueInNominalUnits = halfSpan * multiplier * baseValueForRelative;
        if (toleranceObject.name) {
            console.log(`  -> Relative Calc: ${halfSpan} * ${multiplier} * ${baseValueForRelative} = ${valueInNominalUnits}`);
        }
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
      if (toleranceObject.name) console.log(`  -> SUCCESS: Added component with u_i=${u_i}`);
    } else {
       if (toleranceObject.name) console.warn(`  -> FAILED: halfSpanPPM is NaN`);
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

  if (toleranceObject.name) console.groupEnd();
  return budgetComponents;
};