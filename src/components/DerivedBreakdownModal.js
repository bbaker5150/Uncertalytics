/* global math */
import React, { useMemo } from 'react';
import Latex from "react-latex-next";
import { unitSystem } from '../App';

// Helper to format numbers for LaTeX display
const formatNumberForLatex = (num, precision = 4) => {
    if (typeof num !== 'number' || isNaN(num)) return 'NaN';
    // Use exponential notation for small numbers, increase precision
    if (Math.abs(num) < 1e-3 && num !== 0) {
        return num.toExponential(precision);
    }
    // Use toPrecision for other numbers
    return parseFloat(num.toPrecision(precision)).toString();
};


const DerivedBreakdownModal = ({ isOpen, onClose, breakdownData }) => {

    // Calculate terms for display and final calculation check
    const formulaTerms = useMemo(() => {
        const components = breakdownData?.results?.calculatedBudgetComponents || [];
        const derivedUnit = breakdownData?.derivedNominalPoint?.unit || 'Units';
        const targetUnitInfo = unitSystem.units[derivedUnit];
        if (!components || !targetUnitInfo?.to_si) return []; // Need target conversion factor

        return components.map(c => {
            const symbolMatch = c.name?.match(/\(([^)]+)\)$/);
            const symbol = symbolMatch ? symbolMatch[1] : (c.name?.includes('Resolution') ? 'res' : 'i');
            let termSymbolLatex = '';
            let ciValue = NaN;
            let uiValueAbsoluteNative = NaN; // ui in native units (e.g., inches, oz)
            let uiUnit = c.unit || '';
            let contributionInDerivedUnit = NaN; // |ci * ui| in derived units
            let varianceInDerivedUnitSq = NaN; // (ci * ui)^2 in derived units sq

            // Get ui in native absolute units
            if (c.isBaseUnitValue && !isNaN(c.value) && c.unit) {
                const unitInfo = unitSystem.units[c.unit];
                if (unitInfo?.to_si) {
                    uiValueAbsoluteNative = c.value / unitInfo.to_si; // Convert base ui back to native unit
                }
            } else if (!c.isBaseUnitValue && !isNaN(c.value)) { // Direct component (PPM) - Fallback
                 uiValueAbsoluteNative = c.value; uiUnit = 'ppm';
            }

            // Calculate contribution and variance in derived units
            if (typeof c.sensitivityCoefficient === 'number' && !isNaN(uiValueAbsoluteNative)) {
                ciValue = c.sensitivityCoefficient;

                // --- START FIX ---

                // Calculate contribution in derived units using NATIVE values
                contributionInDerivedUnit = Math.abs(ciValue * uiValueAbsoluteNative);
                
                // The variance is just the square of this contribution
                varianceInDerivedUnitSq = contributionInDerivedUnit ** 2;

                // --- END FIX ---


                 if (c.name?.includes('Input:')) {
                    termSymbolLatex = `(c_{${symbol}} u_{${symbol}})^2`;
                 } else if (c.name?.includes('Resolution')) {
                    termSymbolLatex = `u_{${symbol}}^2`;
                    ciValue = 1; // Explicitly state Ci=1 for resolution contribution
                    
                    // --- START FIX (for Resolution) ---
                    
                    // For resolution, ui_native IS the contribution
                    contributionInDerivedUnit = Math.abs(uiValueAbsoluteNative);
                    varianceInDerivedUnitSq = contributionInDerivedUnit ** 2;
                    uiUnit = derivedUnit;
                    
                    // --- END FIX (for Resolution) ---
                 }
            } else { return null; } // Skip invalid data

            return {
                symbolLatex: termSymbolLatex, // (ci*ui)^2 or u_res^2 (LaTeX)
                varianceDerivedSq: varianceInDerivedUnitSq, // Variance term (derived units sq)
                ci: ciValue,
                ui_native: uiValueAbsoluteNative, // ui in native absolute units
                ui_unit_native: uiUnit, // native unit string
                contribution: contributionInDerivedUnit, // |ci * ui| in derived units
                varSymbol: symbol
            };
        }).filter(term => term !== null);
    }, [breakdownData]);

    // Reconstruct nominal scope for display
    const nominalScopeForDisplay = useMemo(() => {
        // ... (logic remains the same) ...
        const scope = {}; const components = breakdownData?.results?.calculatedBudgetComponents || [];
         components.forEach(c => {
             if (c.name?.includes('Input:')) {
                 const symbolMatch = c.name.match(/\(([^)]+)\)$/); const symbol = symbolMatch ? symbolMatch[1] : null;
                 const nominalMatch = c.sourcePointLabel?.match(/^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)/); const nominalValue = nominalMatch ? parseFloat(nominalMatch[1]) : NaN;
                 if (symbol && !isNaN(nominalValue)) { scope[symbol] = nominalValue; }
             }
         }); return scope;
    }, [breakdownData]);


    // Early return
    if (!isOpen || !breakdownData || !breakdownData.results) return null;

    // Destructure data
    const { equationString, components, derivedNominalPoint } = breakdownData;
    let displayEquation = equationString || 'N/A';
    const equalsIndex = displayEquation.indexOf('=');
    let expressionOnly = displayEquation; if (equalsIndex !== -1) { expressionOnly = displayEquation.substring(equalsIndex + 1).trim(); }
     let equationTex = displayEquation; try { equationTex = math.parse(displayEquation).toTex(); } catch(e) {}
     let expressionTex = expressionOnly; try { expressionTex = math.parse(expressionOnly).toTex(); } catch(e) {}

    const derivedUnit = derivedNominalPoint?.unit || 'Units';

    // Calculate final combined uncertainty in derived units using the variances calculated in the memo
    const sumOfVariancesDerivedUnits = formulaTerms.reduce((sum, term) => sum + (isNaN(term.varianceDerivedSq) ? 0 : term.varianceDerivedSq), 0);
    const combinedUncertaintyInDerivedUnit = Math.sqrt(sumOfVariancesDerivedUnits);

    return (
        <div className="modal-overlay">
            <div className="modal-content breakdown-modal-content" style={{ maxWidth: '700px' }}>
                <button onClick={onClose} className="modal-close-button">&times;</button>
                <h3>Derived Uncertainty Calculation Breakdown</h3>

                <div className="modal-body-scrollable">
                    {/* Equation Display */}
                    <div className="breakdown-step">
                        <h5>Measurement Equation (<Latex>$y = f(x_1, x_2, ...)$</Latex>)</h5>
                        <div style={{ fontSize: '1.1em', textAlign: 'center' }}> <Latex>{`$$ ${equationTex} $$`}</Latex> </div>
                    </div>

                    {/* Component Breakdown Loop */}
                    {components.map((comp, index) => {
                         const formulaTerm = formulaTerms.find(ft => ft.varSymbol === (comp.name?.match(/\(([^)]+)\)$/)?.[1] || (comp.name?.includes('Resolution') ? 'res' : null)));
                         const formattedValueUi = formulaTerm ? formatNumberForLatex(formulaTerm.ui_native) : 'N/A';
                         const displayValueUnitUi = formulaTerm ? formulaTerm.ui_unit_native : '';
                         const formattedCi = formulaTerm ? formatNumberForLatex(formulaTerm.ci) : 'N/A'; // Use ci from formulaTerm
                         const formattedContribution = (formulaTerm && !isNaN(formulaTerm.contribution)) ? formatNumberForLatex(formulaTerm.contribution) : 'N/A';

                        let derivativeDisplay = comp.derivativeString;
                        let derivativeTex = '';
                        let symbol = '?';
                        const symbolMatch = comp.name?.match(/\(([^)]+)\)$/);
                        if(symbolMatch) symbol = symbolMatch[1]; else if (comp.name?.includes('Resolution')) symbol = 'res';

                         if(derivativeDisplay){ try { derivativeTex = math.parse(derivativeDisplay).toTex(); } catch (e) { derivativeTex = derivativeDisplay; } }

                        let evaluationStepTex = '';
                        if (derivativeDisplay && Object.keys(nominalScopeForDisplay).length > 0) {
                            try { const derivativeNode = math.parse(derivativeDisplay); evaluationStepTex = derivativeNode.toTex({ handler: (node, options) => { if (node.isSymbolNode && nominalScopeForDisplay.hasOwnProperty(node.name)) { return formatNumberForLatex(nominalScopeForDisplay[node.name]); } } }); evaluationStepTex = `${evaluationStepTex} = ${formattedCi}`; } catch (e) { evaluationStepTex = `${formattedCi}`; }
                        } else if (derivativeTex) { evaluationStepTex = `${derivativeTex} = ${formattedCi}`; }

                        return (
                            <div className="breakdown-step" key={comp.id || index}>
                                <h5>{comp.name}</h5>
                                <ul>
                                    <li><strong>Source/Nominal:</strong> {comp.sourcePointLabel}</li>
                                    <li><strong>Std. Uncertainty (<Latex>{`$u_{${symbol}}$`}</Latex>):</strong> {formattedValueUi} {displayValueUnitUi}</li>
                                    <li><strong>Distribution:</strong> {comp.distribution}</li>
                                    <li><strong>Sensitivity Coeffcient (Partial Derivative):</strong>
                                    {expressionTex && comp.name.includes('Input:') && ( <li><Latex>{`$$ \\text{Calculate } c_{${symbol}} = \\frac{\\partial}{\\partial ${symbol}} \\left( ${expressionTex} \\right) $$`}</Latex></li> )}
                                    {derivativeTex && ( <li><Latex>{`$$ \\rightarrow c_{${symbol}} = ${derivativeTex} $$`}</Latex></li> )}
                                    {(derivativeDisplay || comp.name.includes('Resolution')) && evaluationStepTex && ( <li><Latex>{`$$ \\text{Evaluate: } c_{${symbol}} = ${evaluationStepTex} $$`}</Latex></li> )}
                                    </li>
                                    <li><strong>Contribution (<Latex>{`$|c_{${symbol}} \\times u_{${symbol}}|$`}</Latex>):</strong> {formattedContribution} {derivedUnit}</li>
                                </ul>
                            </div>
                        );
                    })}

                    {/* Final Calculation Section */}
                    <div className="breakdown-step">
                        <h5>Combined Uncertainty Calculation (<Latex>{`$u_y$`}</Latex> in {derivedUnit})</h5>
                        <p>Using the formula:</p>
                        <Latex>{`$$ u_y = \\sqrt{\\sum_{i} (c_i u_i)^2 + \\sum_{j} u_j^2} $$`}</Latex>
                        <p>Where <Latex>$c_i u_i$</Latex> terms are contributions from input variables and <Latex>$u_j$</Latex> terms are direct uncertainties (like resolution).</p>
                        <Latex>{`$$ u_y = \\sqrt{${formulaTerms.map(t => t.symbolLatex).join(" + ")}} $$`}</Latex>

                        <p>Plugging in values (using absolute units):</p>
                        {/* This step shows (ci x ui_native)^2 */}
                        <Latex>{`$$ u_y = \\sqrt{${formulaTerms.map(t => `(${formatNumberForLatex(t.ci)} \\times ${formatNumberForLatex(t.ui_native)})^2`).join(" + ")}} $$`}</Latex>
                        <Latex>{`$$ u_y = \\sqrt{${formulaTerms.map(t => isNaN(t.varianceDerivedSq) ? 'NaN' : formatNumberForLatex(t.varianceDerivedSq, 5)).join(" + ")}} $$`}</Latex>
                        <Latex>{`$$ u_y = \\sqrt{${formatNumberForLatex(sumOfVariancesDerivedUnits, 5)}} = \\mathbf{${formatNumberForLatex(combinedUncertaintyInDerivedUnit, 5)}} \\text{ (${derivedUnit})} $$`}</Latex>

                        <hr style={{margin: '15px 0'}}/>
                         <strong>Final Combined Uncertainty (<Latex>$u_y$</Latex>): {isNaN(combinedUncertaintyInDerivedUnit) ? 'N/A' : `${combinedUncertaintyInDerivedUnit.toPrecision(5)} ${derivedUnit}`}</strong>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DerivedBreakdownModal;