/**
 * * This hook handles the heavy lifting of the Uncertainty Analysis calculation.
 * It monitors the test point data, TMDE tolerances, and UUT specs. When these change,
 * it recalculates the Combined Uncertainty, Expanded Uncertainty, and Effective Degrees of Freedom.
 * * Key Responsibilities:
 * - Handling both "Direct" and "Derived" measurement types.
 * - Aggregating variance from all contributors (Manual, TMDE, UUT Resolution).
 * - Calculating Welch-Satterthwaite Effective DoF.
 * - Returning the final calculated results object used by the UI table.
 */

import { useState, useEffect } from "react";
import { probit } from "simple-statistics";
import { 
  unitSystem, 
  getKValueFromTDistribution, 
  calculateDerivedUncertainty 
} from "../../../utils/uncertaintyMath";
import { getBudgetComponentsFromTolerance } from "../utils/budgetUtils";

export const useUncertaintyCalculation = (
  testPointData,
  sessionData,
  tmdeTolerancesData,
  uutToleranceData,
  uutNominal,
  manualComponents,
  onDataSave
) => {
  const [calcResults, setCalcResults] = useState(null);
  const [calculationError, setCalculationError] = useState(null);

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
            ? getBudgetComponentsFromTolerance(
                contributingTmde,
                contributingTmde.measurementPoint
              )[0]?.distribution || "N/A"
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

        // -------------------------------------------------------------
        // NEW CODE START: Handle Manual Components (e.g., Repeatability)
        // -------------------------------------------------------------
        if (manualComponents && manualComponents.length > 0) {
            manualComponents.forEach((comp, idx) => {
                // Manual components typically come in as PPM (relative).
                // We need to convert them to absolute native units to add to the
                // Derived Total Variance (which is calculated in Native Units squared).
                
                // comp.value is the uncertainty (usually PPM/Relative).
                // derivedNominalValue is the calculated nominal result of the equation.
                
                // Calculate Absolute Uncertainty in Native Units
                // (PPM / 1,000,000) * Nominal
                const absUncNative = (comp.value / 1e6) * Math.abs(derivedNominalValue);

                // Calculate Absolute Uncertainty in Base Units (SI)
                const absUncBase = absUncNative * targetUnitInfo.to_si;

                if (!isNaN(absUncNative)) {
                    // Add to Total Variance (Sum of Squares)
                    totalVariance_Native += absUncNative ** 2;

                    componentsForBudgetTable.push({
                        ...comp,
                        id: comp.id || `manual_derived_${idx}`,
                        sourcePointLabel: "Manual",
                        // For derived table, 'value' often represents the Base Unit value 
                        // (matching the logic in derivedBreakdown push above)
                        value: absUncBase, 
                        unit: derivedNominalUnit,
                        isBaseUnitValue: true,
                        sensitivityCoefficient: 1, // Direct contributor to the result
                        contribution: absUncNative,
                        dof: comp.dof || Infinity,
                        isCore: false
                    });
                }
            });
        }
        // -------------------------------------------------------------
        // NEW CODE END
        // -------------------------------------------------------------

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
    testPointData.id,
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
    testPointData.expanded_uncertainty_absolute_base
  ]);

  return { calcResults, calculationError };
};