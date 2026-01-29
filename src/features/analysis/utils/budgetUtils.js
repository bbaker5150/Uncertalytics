/**
 * * This utility file contains helper functions for breaking down tolerance objects
 * * into individual uncertainty budget components.
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
  rawToleranceObject,
  referenceMeasurementPoint
) => {

  // --- 1. STRUCTURE NORMALIZATION & DATA PRESERVATION ---
  let toleranceObject = rawToleranceObject;
  
  // Handle Array wrapper
  if (Array.isArray(toleranceObject)) {
    toleranceObject = toleranceObject[0];
  }

  // **CRITICAL FIX**: Capture Resolution from the PARENT object before we normalize 
  // down to the inner 'tolerances' object.
  let outerResolution = null;
  let outerResolutionUnit = null;
  
  if (toleranceObject) {
      // Check standard keys for resolution on the outer object
      outerResolution = toleranceObject.resolution || toleranceObject.measuringResolution;
      outerResolutionUnit = toleranceObject.resolutionUnit || toleranceObject.measuringResolutionUnit;
  }

  // Normalize: If specs are nested in 'tolerance' or 'tolerances', dive in.
  if (toleranceObject && typeof toleranceObject === 'object') {
     if (toleranceObject.tolerance) {
        toleranceObject = toleranceObject.tolerance;
     } else if (toleranceObject.tolerances) {
        toleranceObject = toleranceObject.tolerances;
     }
  }

  const hasValidValue = referenceMeasurementPoint && 
                        referenceMeasurementPoint.value !== null && 
                        referenceMeasurementPoint.value !== undefined && 
                        referenceMeasurementPoint.value !== "";

  if (
    !toleranceObject ||
    !referenceMeasurementPoint ||
    !hasValidValue ||
    !referenceMeasurementPoint.unit
  ) {
    return [];
  }

  const budgetComponents = [];
  const nominalValue = parseFloat(referenceMeasurementPoint.value);
  const nominalUnit = referenceMeasurementPoint.unit;
  const prefix = toleranceObject.name || (outerResolution ? "UUT" : "TMDE");

  const processComponent = (
    tolComp,
    name,
    baseValueForRelative,
    isResolution = false
  ) => {
    // Check for missing data
    if (!tolComp && !isResolution) return;

    // Check if tolComp is malformed
    if (tolComp && typeof tolComp !== 'object' && !isResolution) return;

    const distributionDivisor = isResolution
      ? 1.732
      : parseFloat(tolComp.distribution) || 1.732;
    
    const distributionLabel = isResolution
      ? "Rectangular"
      : errorDistributions.find((d) => d.value === String(tolComp.distribution))?.label || "Rectangular";

    let halfSpanPPM = NaN; 
    let u_i_native = NaN;
    let unit_native = nominalUnit;

    if (isResolution) {
      const value = parseFloat(tolComp);
      if (isNaN(value) || value === 0) return;
      
      // Use override if available (from parent), else fall back to current object, else nominal
      const unit = outerResolutionUnit || toleranceObject.measuringResolutionUnit || nominalUnit;
      
      // PPM Calc
      if (nominalValue !== 0) {
        halfSpanPPM = convertToPPM(value / 2, unit, nominalValue, nominalUnit);
      }
      
      u_i_native = value / 2 / distributionDivisor;
      unit_native = unit;

    } else {
      const high = parseFloat(tolComp?.high || 0);
      let low = parseFloat(tolComp?.low || -high);

      // --- FIX: HANDLE POSITIVE LOW VALUES ---
      // If symmetric, or if High/Low are identical positive numbers, flip Low to negative.
      if (tolComp.symmetric && low > 0) {
          low = -Math.abs(low);
      } else if (low > 0 && high > 0 && Math.abs(high - low) < 1e-9) {
          low = -Math.abs(low);
      }
      
      const halfSpan = (high - low) / 2;

      if (halfSpan === 0) return;

      const unit = tolComp.unit;
      let valueInNominalUnits;

      if (["%", "ppm", "ppb"].includes(unit)) {
        let multiplier = 0;
        if (unit === "%") multiplier = 0.01;
        else if (unit === "ppm") multiplier = 1e-6;
        else if (unit === "ppb") multiplier = 1e-9;

        if (isNaN(baseValueForRelative)) return;

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

    // --- LOGIC FIX: ALLOW COMPONENT IF PPM *OR* ABSOLUTE IS VALID ---
    const canUsePPM = !isNaN(halfSpanPPM);
    const canUseAbsolute = !isNaN(u_i_native);

    if (canUsePPM || canUseAbsolute) {
      
      let finalValue;
      let isBaseUnitValue = false;

      if (canUsePPM) {
        finalValue = Math.abs(halfSpanPPM / distributionDivisor);
      } else {
        // Fallback: Use Absolute Base Value if PPM failed (e.g. 0V nominal)
        const u_i_base = unitSystem.toBaseUnit(u_i_native, unit_native);
        finalValue = u_i_base;
        isBaseUnitValue = true;
      }
      
      const uniqueSuffix = toleranceObject.id ? `_${toleranceObject.id}` : '';
      const cleanName = name.toLowerCase().replace(/\s/g, "");
      const componentId = `${prefix}_${cleanName}${uniqueSuffix}`;

      budgetComponents.push({
        id: componentId,
        name: `${prefix} - ${name}`,
        type: "B",
        value: finalValue,              
        isBaseUnitValue: isBaseUnitValue, 
        value_native: u_i_native,       
        unit_native: unit_native,
        dof: Infinity,
        isCore: true,
        distribution: distributionLabel,
      });
    }
  };
  
  // Use normalized 'toleranceObject' for reading/floor
  processComponent(toleranceObject.reading, "Reading", nominalValue);
  processComponent(toleranceObject.readings_iv, "Readings (IV)", nominalValue);

  processComponent(
    toleranceObject.range,
    "Range",
    parseFloat(toleranceObject.max) || parseFloat(toleranceObject.range?.value)
  );
  processComponent(toleranceObject.floor, "Floor", nominalValue);

  if (toleranceObject.db && !isNaN(parseFloat(toleranceObject.db.high))) {
     const highDb = parseFloat(toleranceObject.db.high || 0);
     const lowDb = parseFloat(toleranceObject.db.low || -highDb);
     const dbTol = (highDb - lowDb) / 2;

     if (dbTol > 0 && nominalValue > 0) {
        const dbMult = parseFloat(toleranceObject.db.multiplier) || 20;
        const dbRef = parseFloat(toleranceObject.db.ref) || 1;
        const distributionDivisor = parseFloat(toleranceObject.db.distribution) || 1.732;
        const distributionLabel = errorDistributions.find(d => d.value === String(toleranceObject.db.distribution))?.label || "Rectangular";
        
        const dbNominal = dbMult * Math.log10(nominalValue / dbRef);
        const centerDb = (highDb + lowDb) / 2;
        const nominalAtCenterTol = dbRef * Math.pow(10, (dbNominal + centerDb) / dbMult);
        const upperValue = dbRef * Math.pow(10, (dbNominal + highDb) / dbMult);
        const absoluteDeviation = Math.abs(upperValue - nominalAtCenterTol);
  
        const ppm = convertToPPM(absoluteDeviation, nominalUnit, nominalValue, nominalUnit);
        
        if (!isNaN(ppm)) {
          const u_i = Math.abs(ppm / distributionDivisor);
          budgetComponents.push({
            id: `${prefix}_db_${toleranceObject.id || "manual"}`,
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

  // --- RESOLUTION PROCESSING ---
  // We use 'outerResolution' (captured from parent) OR check the inner object as fallback
  const finalResolution = outerResolution || toleranceObject.measuringResolution;
  
  if (finalResolution) {
    processComponent(
      finalResolution,
      "Resolution",
      nominalValue,
      true
    );
  }

  return budgetComponents;
};