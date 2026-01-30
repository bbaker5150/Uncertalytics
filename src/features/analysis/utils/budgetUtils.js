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

  // --- 1. STRUCTURE NORMALIZATION ---
  let toleranceObject = rawToleranceObject;
  
  if (Array.isArray(toleranceObject)) {
    toleranceObject = toleranceObject[0];
  }

  let outerResolution = null;
  let outerResolutionUnit = null;
  
  if (toleranceObject) {
      outerResolution = toleranceObject.resolution || toleranceObject.measuringResolution;
      outerResolutionUnit = toleranceObject.resolutionUnit || toleranceObject.measuringResolutionUnit;
  }

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

  // --- HELPER: Get Error Magnitude ---
  const getComponentErrorMagnitude = (tolComp, baseValueForRelative) => {
    if (!tolComp || typeof tolComp !== 'object') return 0;

    const high = parseFloat(tolComp.high || 0);
    let low = parseFloat(tolComp.low || -high);

    if (tolComp.symmetric && low > 0) {
        low = -Math.abs(low);
    } else if (low > 0 && high > 0 && Math.abs(high - low) < 1e-9) {
        low = -Math.abs(low);
    }
    
    const halfSpan = (high - low) / 2;
    if (halfSpan === 0) return 0;

    const unit = tolComp.unit;
    
    if (["%", "ppm", "ppb"].includes(unit)) {
      let multiplier = 0;
      if (unit === "%") multiplier = 0.01;
      else if (unit === "ppm") multiplier = 1e-6;
      else if (unit === "ppb") multiplier = 1e-9;

      if (isNaN(baseValueForRelative)) return 0;
      return Math.abs(halfSpan * multiplier * baseValueForRelative);
    } else {
      const valueInBase = unitSystem.toBaseUnit(halfSpan, unit);
      const nominalUnitInBase = unitSystem.toBaseUnit(1, nominalUnit);
      return Math.abs(valueInBase / nominalUnitInBase);
    }
  };

  // --- 2. ACCUMULATE LINEAR SUM ---
  let totalLinearErrorNative = 0;
  let hasAccuracyComponents = false;

  if (toleranceObject.reading) {
      totalLinearErrorNative += getComponentErrorMagnitude(toleranceObject.reading, nominalValue);
      hasAccuracyComponents = true;
  }
  if (toleranceObject.readings_iv) {
      totalLinearErrorNative += getComponentErrorMagnitude(toleranceObject.readings_iv, nominalValue);
      hasAccuracyComponents = true;
  }

  const rangeBase = parseFloat(toleranceObject.max) || parseFloat(toleranceObject.range?.value);
  if (toleranceObject.range) {
      totalLinearErrorNative += getComponentErrorMagnitude(toleranceObject.range, rangeBase);
      hasAccuracyComponents = true;
  }

  if (toleranceObject.floor) {
      totalLinearErrorNative += getComponentErrorMagnitude(toleranceObject.floor, nominalValue);
      hasAccuracyComponents = true;
  }

  if (toleranceObject.db && !isNaN(parseFloat(toleranceObject.db.high))) {
      const highDb = parseFloat(toleranceObject.db.high || 0);
      const lowDb = parseFloat(toleranceObject.db.low || -highDb);
      const dbTol = (highDb - lowDb) / 2;

      if (dbTol > 0 && nominalValue > 0) {
        const dbMult = parseFloat(toleranceObject.db.multiplier) || 20;
        const dbRef = parseFloat(toleranceObject.db.ref) || 1;
        
        const dbNominal = dbMult * Math.log10(nominalValue / dbRef);
        const centerDb = (highDb + lowDb) / 2;
        const nominalAtCenterTol = dbRef * Math.pow(10, (dbNominal + centerDb) / dbMult);
        const upperValue = dbRef * Math.pow(10, (dbNominal + highDb) / dbMult);
        const absoluteDeviation = Math.abs(upperValue - nominalAtCenterTol);

        totalLinearErrorNative += absoluteDeviation;
        hasAccuracyComponents = true;
      }
  }

  // --- 3. CREATE COMBINED ACCURACY COMPONENT ---
  if (hasAccuracyComponents) {
      const distVal = toleranceObject.distribution || "1.732";
      const distDiv = parseFloat(distVal) || 1.732;
      const distLabel = errorDistributions.find(d => d.value === String(distVal))?.label || "Rectangular";

      // Native Standard Uncertainty
      const u_i_native = totalLinearErrorNative / distDiv;

      // PPM for Direct Mode Calculator
      let u_i_ppm = NaN;
      if (nominalValue !== 0) {
        u_i_ppm = Math.abs((u_i_native / nominalValue) * 1e6);
      }

      const uniqueSuffix = toleranceObject.id ? `_${toleranceObject.id}` : '';
      
      budgetComponents.push({
        id: `${prefix}_accuracy${uniqueSuffix}`,
        name: `${prefix} - Accuracy`,
        type: "B",
        
        value: u_i_ppm, 
        isBaseUnitValue: false, 
        
        value_native: u_i_native,     
        unit_native: nominalUnit,     
        
        dof: Infinity,
        isCore: true,
        distribution: distLabel,
        distributionValue: distVal,
        
        // --- NEW FLAGS FOR IN-TABLE EDITING ---
        allowDistributionEdit: true, 
        toleranceId: toleranceObject.id // Used to find the parent tolerance to update
      });
  }

  // --- 4. RESOLUTION COMPONENT ---
  const processResolution = () => {
      const resVal = parseFloat(outerResolution || toleranceObject.measuringResolution);
      const resUnit = outerResolutionUnit || toleranceObject.measuringResolutionUnit || nominalUnit;

      if (!isNaN(resVal) && resVal > 0) {
          const halfRes = resVal / 2;
          const distDiv = 1.732; 

          let u_i_native = halfRes / distDiv; 
          
          if (resUnit !== nominalUnit) {
              const resBase = unitSystem.toBaseUnit(halfRes, resUnit);
              const nomBase = unitSystem.toBaseUnit(1, nominalUnit);
              u_i_native = (resBase / nomBase) / distDiv;
          }

          let u_i_ppm = NaN;
          if (nominalValue !== 0) {
             u_i_ppm = Math.abs((u_i_native / nominalValue) * 1e6);
          }

          budgetComponents.push({
              id: `${prefix}_resolution${toleranceObject.id ? `_${toleranceObject.id}` : ''}`,
              name: `${prefix} - Resolution`,
              type: "B",
              value: u_i_ppm,       
              isBaseUnitValue: false,
              value_native: u_i_native,
              unit_native: nominalUnit, 
              dof: Infinity,
              isCore: true,
              distribution: "Rectangular (Resolution)"
          });
      }
  };

  processResolution();

  return budgetComponents;
};