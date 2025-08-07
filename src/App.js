import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { probit, erf } from 'simple-statistics';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';
import './App.css';

// --- HELPER FUNCTIONS ---
function bivariateNormalCDF(x, y, rho) {
    if (rho === null || isNaN(rho) || rho > 1 || rho < -1) { return NaN; }
    if (rho === 0) return ((1 + erf(x / Math.sqrt(2))) / 2 * (1 + erf(y / Math.sqrt(2))) / 2);
    if (rho === 1) return (1 + erf(Math.min(x, y) / Math.sqrt(2))) / 2;
    if (rho === -1) return Math.max(0, ((1 + erf(x / Math.sqrt(2))) / 2) + ((1 + erf(y / Math.sqrt(2))) / 2) - 1);
    const rho2 = rho * rho;
    let result = 0;
    if (rho2 < 1) {
        const t = (y - rho * x) / Math.sqrt(1 - rho2);
        const biv_g = (1 / (2 * Math.PI * Math.sqrt(1 - rho2))) * Math.exp(-(x * x - 2 * rho * x * y + y * y) / (2 * (1 - rho2)));
        if (x * y * rho > 0) {
            const L = (1 + erf(x / Math.sqrt(2))) / 2 * (1 + erf(t / Math.sqrt(2))) / 2;
            let sum = 0;
            for (let i = 0; i < 5; i++) {
                sum += Math.pow(rho, i + 1) / ((i + 1) * Math.pow(2, (i / 2) + 1) * Math.exp(Math.log(i + 1) * 2) * Math.PI);
            }
            result = L - biv_g * sum;
        } else {
            const L = (1 + erf(x / Math.sqrt(2))) / 2 * (1 + erf(t / Math.sqrt(2))) / 2;
            result = L - bivariateNormalCDF(x, t, 0);
        }
    }
    return result < 0 ? 0 : result > 1 ? 1 : result;
}

const T_DISTRIBUTION_95 = { 1: 12.71, 2: 4.30, 3: 3.18, 4: 2.78, 5: 2.57, 6: 2.45, 7: 2.36, 8: 2.31, 9: 2.26, 10: 2.23, 15: 2.13, 20: 2.09, 25: 2.06, 30: 2.04, 40: 2.02, 50: 2.01, 60: 2.00, 100: 1.98, 120: 1.98 };

function getKValueFromTDistribution(dof) {
    if (dof === Infinity || dof > 120) return 1.96;
    const roundedDof = Math.round(dof);
    if (T_DISTRIBUTION_95[roundedDof]) {
        return T_DISTRIBUTION_95[roundedDof];
    }
    const lowerKeys = Object.keys(T_DISTRIBUTION_95).map(Number).filter(k => k < roundedDof);
    const upperKeys = Object.keys(T_DISTRIBUTION_95).map(Number).filter(k => k > roundedDof);
    if (lowerKeys.length === 0) return T_DISTRIBUTION_95[Math.min(...upperKeys)];
    if (upperKeys.length === 0) return T_DISTRIBUTION_95[Math.max(...lowerKeys)];
    const lowerBound = Math.max(...lowerKeys);
    const upperBound = Math.min(...upperKeys);
    const kLower = T_DISTRIBUTION_95[lowerBound];
    const kUpper = T_DISTRIBUTION_95[upperBound];
    return kLower + (roundedDof - lowerBound) * (kUpper - kLower) / (upperBound - lowerBound);
}


// --- SUB-COMPONENTS ---
const Accordion = ({ title, children, startOpen = false }) => {
    const [isOpen, setIsOpen] = useState(startOpen);
    return (
        <div className="accordion-card">
            <div className="accordion-header" onClick={() => setIsOpen(!isOpen)}>
                <h4>{title}</h4>
                <span className={`accordion-icon ${isOpen ? 'open' : ''}`}>&#9660;</span>
            </div>
            {isOpen && <div className="accordion-content">{children}</div>}
        </div>
    );
};

const NotificationModal = ({ isOpen, onClose, title, message }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <button onClick={onClose} className="modal-close-button">&times;</button>
                <h3>{title}</h3>
                <p style={{ textAlign: 'center' }}>{message}</p>
                <div className="modal-actions" style={{ justifyContent: 'center' }}>
                    <button className="button" onClick={onClose}>OK</button>
                </div>
            </div>
        </div>
    );
};

const ConversionInfo = ({ value, unit, nominal }) => {
    const { explanation, warning } = useMemo(() => {
        if (!value || !unit || unit === 'ppm' || !nominal || !nominal.value || !nominal.unit) {
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


const UncertaintyBudgetTable = ({ components, onRemove, calcResults, useTDistribution, setUseTDistribution }) => {
    const totalUncertainty = useMemo(() => {
        if (!components || components.length === 0) return 0;
        const combinedVariance = components.reduce((sum, comp) => sum + Math.pow(comp.value, 2), 0);
        return Math.sqrt(combinedVariance);
    }, [components]);

    const renderTBody = (title, filteredComponents) => {
        if (filteredComponents.length === 0) return null;
        return (
            <React.Fragment key={title}>
                <tr className="category-header"><td colSpan="5">{title}</td></tr>
                {filteredComponents.map(c => (
                    <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{c.type}</td>
                        <td>{c.value.toFixed(4)}</td>
                        <td>{c.dof === Infinity ? '∞' : c.dof.toFixed(0)}</td>
                        <td className="action-cell">
                            {!c.isCore && <span onClick={() => onRemove(c.id)} className="delete-action" title="Remove Component">×</span>}
                        </td>
                    </tr>
                ))}
            </React.Fragment>
        );
    };

    const typeAComponents = components.filter(c => c.type === 'A');
    const typeBComponents = components.filter(c => c.type === 'B');
    
    return (
        <table className="uncertainty-budget-table">
            <thead>
                <tr>
                    <th>Uncertainty Component</th>
                    <th>Type</th>
                    <th>uᵢ (ppm)</th>
                    <th>vᵢ (dof)</th>
                    <th style={{ width: '50px' }}></th>
                </tr>
            </thead>
            <tbody>
                {renderTBody('Type A Components', typeAComponents)}
                {renderTBody('Type B Components', typeBComponents)}
            </tbody>
            <tfoot>
                <tr>
                    <td colSpan="2">{'Combined Standard Uncertainty (uc)'}</td>
                    <td>{totalUncertainty.toFixed(4)}</td>
                    <td colSpan="2"></td>
                </tr>
                {calcResults && (
                    <>
                        <tr>
                            <td colSpan="2">{'Effective Degrees of Freedom (veff)'}</td>
                            <td>{(calcResults.effective_dof === Infinity || calcResults.effective_dof === null) ? '∞' : calcResults.effective_dof.toFixed(2)}</td>
                            <td colSpan="2"></td>
                        </tr>
                        <tr>
                            <td colSpan="2">{'Coverage Factor (k)'}</td>
                            <td>{calcResults.k_value.toFixed(3)}</td>
                            <td colSpan="2" className="k-factor-cell">
                                <label htmlFor="use-t-dist" className="k-factor-label">
                                    <input type="checkbox" id="use-t-dist" checked={useTDistribution} onChange={e => setUseTDistribution(e.target.checked)} />
                                    Use t-dist
                                </label>
                            </td>
                        </tr>
                    </>
                )}
            </tfoot>
        </table>
    );
};

const FinalUncertaintyCard = ({ calcResults, testPointInfo }) => {
    const hasInfo = testPointInfo && testPointInfo.parameter && testPointInfo.qualifier;

    return (
        <>
            <p style={{ fontSize: '0.9rem', color: '#6c757d', marginTop: '10px', textAlign: 'center' }}>
                {hasInfo ? (
                    <>
                        {testPointInfo.parameter.name}: {testPointInfo.parameter.value} {testPointInfo.parameter.unit}
                        <br />
                        {testPointInfo.qualifier.name}: {testPointInfo.qualifier.value} {testPointInfo.qualifier.unit}
                    </>
                ) : (
                    "Legacy Measurement Point Selected"
                )}
            </p>

            {!calcResults ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                    <p className="placeholder-text">
                        The uncertainty budget has not been calculated.
                        <br />
                        Please define the UUT/TMDE and any other components to display the results.
                    </p>
                </div>
            ) : (
                <div style={{ textAlign: 'center' }}>
                    <div className="final-result-value">
                        U = ± <span>{calcResults.expanded_uncertainty.toFixed(3)}</span> ppm
                    </div>
                     <ul className="result-breakdown">
                        <li><span className="label">Combined Uncertainty (uₑ)</span><span className="value">{calcResults.combined_uncertainty.toFixed(4)} ppm</span></li>
                        <li><span className="label">Effective DoF (vₑₒₒ)</span><span className="value">{(calcResults.effective_dof === Infinity || calcResults.effective_dof === null) ? '∞' : calcResults.effective_dof.toFixed(2)}</span></li>
                        <li><span className="label">Coverage Factor (k)</span><span className="value">{calcResults.k_value.toFixed(3)}</span></li>
                    </ul>
                    <p className="result-confidence-note">
                        The reported expanded uncertainty of measurement is stated as the standard uncertainty of measurement multiplied by the coverage factor k={calcResults.k_value.toFixed(3)}, which for a t-distribution with vₑₒₒ = {(calcResults.effective_dof === Infinity || calcResults.effective_dof === null) ? '∞' : calcResults.effective_dof.toFixed(2)} corresponds to a coverage probability of approximately 95%.
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
                <button onClick={onClose} className="modal-close-button">&times;</button>
                <h3>Key Inputs Breakdown</h3>
                <div className="breakdown-step">
                    <h5>Std. Unc. of Cal (uₑₐₗ)</h5>
                    <p>This value is the **Combined Standard Uncertainty**, calculated using the root sum of squares (RSS) of all individual components (uᵢ) from the detailed budget.</p>
                    <Latex>{`$$ u_{cal} = \\sqrt{\\sum_{i=1}^{N} u_i^2} = \\mathbf{${results.uCal.toFixed(4)}} \\text{ ppm} $$`}</Latex>
                </div>
                <div className="breakdown-step">
                    <h5>UUT Uncertainty (uᵤᵤₜ)</h5>
                    <p>The standard uncertainty of the UUT is isolated from the total deviation uncertainty, which is derived from the target reliability (R).</p>
                    1. Deviation Uncertainty (uₔₑᵥ): <Latex>{`$$ u_{dev} = \\frac{L_{Upper}}{\\Phi^{-1}((1+R)/2)} = \\frac{${LUp_symmetric.toFixed(2)}}{\\Phi^{-1}((1+${inputs.reliability})/2)} = ${results.uDev.toFixed(4)} \\text{ ppm} $$`}</Latex>
                    2. UUT Uncertainty: <Latex>{`$$ u_{UUT} = \\sqrt{u_{dev}^2 - u_{cal}^2} = \\sqrt{${results.uDev.toFixed(4)}^2 - ${results.uCal.toFixed(4)}^2} = \\mathbf{${results.uUUT.toFixed(4)}} \\text{ ppm} $$`}</Latex>
                </div>
                <div className="breakdown-step">
                    <h5>Acceptance Limits (A)</h5>
                    <p>Calculated by applying the **Guard Band Multiplier** to the tolerance limits.</p>
                    <Latex>{`$$ A_{Low} = L_{Low} \\times G = ${inputs.LLow.toFixed(2)} \\times ${inputs.guardBandMultiplier} = \\mathbf{${results.ALow.toFixed(4)}} \\text{ ppm} $$`}</Latex>
                    <Latex>{`$$ A_{Up} = L_{Up} \\times G = ${inputs.LUp.toFixed(2)} \\times ${inputs.guardBandMultiplier} = \\mathbf{${results.AUp.toFixed(4)}} \\text{ ppm} $$`}</Latex>
                </div>
                 <div className="breakdown-step">
                    <h5>Correlation (ρ)</h5>
                    <p>The statistical correlation between the UUT's true value and the measured value.</p>
                    <Latex>{`$$ \\rho = \\frac{u_{UUT}}{u_{dev}} = \\frac{${results.uUUT.toFixed(4)}}{${results.uDev.toFixed(4)}} = \\mathbf{${results.correlation.toFixed(4)}} $$`}</Latex>
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
                <button onClick={onClose} className="modal-close-button">&times;</button>
                <h3>TUR Calculation Breakdown</h3>
                <div className="breakdown-step">
                    <h5>Step 1: Formula</h5>
                    <p>The Test Uncertainty Ratio (TUR) is the ratio of the tolerance span to the expanded measurement uncertainty.</p>
                    <Latex>{'$$ TUR = \\frac{L_{Upper} - L_{Lower}}{U_{95}} $$'}</Latex>
                </div>
                <div className="breakdown-step">
                    <h5>Step 2: Inputs</h5>
                    <ul>
                        <li>Tolerance Span: <Latex>{`$$ L_{Upper} - L_{Lower} = ${inputs.LUp.toFixed(2)} - (${inputs.LLow.toFixed(2)}) = ${(inputs.LUp - inputs.LLow).toFixed(2)} \\text{ ppm} $$`}</Latex></li>
                        <li>Expanded Uncertainty: <Latex>{`$$ U_{95} = ${results.expandedUncertainty.toFixed(4)} \\text{ ppm} $$`}</Latex></li>
                    </ul>
                </div>
                <div className="breakdown-step">
                    <h5>Step 3: Final Calculation</h5>
                    <Latex>{`$$ TUR = \\frac{${(inputs.LUp - inputs.LLow).toFixed(2)}}{${results.expandedUncertainty.toFixed(4)}} = \\mathbf{${results.tur.toFixed(4)}:1} $$`}</Latex>
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
                <button onClick={onClose} className="modal-close-button">&times;</button>
                <h3>TAR Calculation Breakdown</h3>
                <div className="breakdown-step">
                    <h5>Step 1: Formula</h5>
                    <p>The Test Acceptance Ratio (TAR) is the ratio of the UUT's tolerance span to the TMDE's (Standard's) tolerance span.</p>
                    <Latex>{'$$ TAR = \\frac{UUT\\ Tolerance\\ Span}{TMDE\\ Tolerance\\ Span} $$'}</Latex>
                </div>
                <div className="breakdown-step">
                    <h5>Step 2: Inputs</h5>
                    <ul>
                        <li>UUT Tolerance Span: <Latex>{`$$ ${inputs.LUp.toFixed(2)} - (${inputs.LLow.toFixed(2)}) = \\mathbf{${uutToleranceSpan.toFixed(2)}} \\text{ ppm} $$`}</Latex></li>
                        <li>TMDE Tolerance Span: <Latex>{`$$ \\mathbf{${tmdeToleranceSpan.toFixed(2)}} \\text{ ppm} $$`}</Latex> <em>(Derived from the 'Standard Instrument' component in the budget)</em></li>
                    </ul>
                </div>
                <div className="breakdown-step">
                    <h5>Step 3: Final Calculation</h5>
                    <Latex>{`$$ TAR = \\frac{${uutToleranceSpan.toFixed(2)}}{${tmdeToleranceSpan.toFixed(2)}} = \\mathbf{${results.tar.toFixed(4)}:1} $$`}</Latex>
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
                <button onClick={onClose} className="modal-close-button">&times;</button>
                <h3>PFA Calculation Breakdown</h3>
                <div className="breakdown-step">
                    <h5>Step 1: Formula</h5>
                    <p>The Probability of False Accept is the risk of accepting an out-of-tolerance UUT.</p>
                    <Latex>{'$$ PFA = \\int G(x) \\left[ \\Phi(\\frac{A-x}{u_{cal}}) - \\Phi(\\frac{-A-x}{u_{cal}}) \\right] dx $$'}</Latex>
                </div>
                <div className="breakdown-step">
                    <h5>Step 2: Standardized Limits (Z-Scores)</h5>
                    <p>The limits are normalized by their respective uncertainties to create unitless Z-scores.</p>
                    <Latex>{`$$ z_{L_{Low}} = ${z1.toFixed(4)}, z_{L_{Up}} = ${z4.toFixed(4)}, z_{A_{Low}} = ${z3.toFixed(4)}, z_{A_{Up}} = ${z2.toFixed(4)} $$`}</Latex>
                </div>
                <div className="breakdown-step">
                    <h5>Step 3: Bivariate Normal Probabilities (Φ₂)</h5>
                    <p>Using Z-scores and correlation (ρ = {results.correlation.toFixed(4)}), we solve the Bivariate Normal CDF (Φ₂).</p>
                    Term A: <Latex>{`$$ \\Phi_2(${z1.toFixed(2)}, ${z2.toFixed(2)}, \\rho) = ${(bivariateNormalCDF(z1, z2, results.correlation)).toFixed(6)} $$`}</Latex>
                    Term B: <Latex>{`$$ \\Phi_2(${z1.toFixed(2)}, ${z3.toFixed(2)}, \\rho) = ${(bivariateNormalCDF(z1, z3, results.correlation)).toFixed(6)} $$`}</Latex>
                    Term C: <Latex>{`$$ \\Phi_2(${z4.toFixed(2)}, ${z5.toFixed(2)}, \\rho) = ${(bivariateNormalCDF(z4, z5, results.correlation)).toFixed(6)} $$`}</Latex>
                    Term D: <Latex>{`$$ \\Phi_2(${z4.toFixed(2)}, ${z6.toFixed(2)}, \\rho) = ${(bivariateNormalCDF(z4, z6, results.correlation)).toFixed(6)} $$`}</Latex>
                </div>
                <div className="breakdown-step">
                    <h5>Step 4: Final PFA Calculation</h5>
                    Lower Tail Risk (A-B): <Latex>{`$$ ${(results.pfa_term1 / 100).toFixed(6)} $$`}</Latex>
                    Upper Tail Risk (C-D): <Latex>{`$$ ${(results.pfa_term2 / 100).toFixed(6)} $$`}</Latex>
                    Total PFA = <Latex>{`$$ \\mathbf{${results.pfa.toFixed(4)}\\%} $$`}</Latex>
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
                <button onClick={onClose} className="modal-close-button">&times;</button>
                <h3>PFR Calculation Breakdown</h3>
                <div className="breakdown-step">
                    <h5>Step 1: Formula</h5>
                    <p>The Probability of False Reject is the risk of rejecting an in-tolerance UUT.</p>
                    <Latex>{'$$ PFR = \\int_{-L}^{L} G(x) \\left[ 1 - \\Phi(\\frac{A-x}{u_{cal}}) + \\Phi(\\frac{-A-x}{u_{cal}}) \\right] dx $$'}</Latex>
                </div>
                <div className="breakdown-step">
                    <h5>Step 2: Bivariate Normal Probabilities (Φ₂)</h5>
                    <p>Using Z-scores and correlation (ρ = {results.correlation.toFixed(4)}), we solve the Bivariate Normal CDF (Φ₂).</p>
                    Term A: <Latex>{`$$ \\Phi_2(${z1.toFixed(2)}, ${z2.toFixed(2)}, \\rho) = ${(bivariateNormalCDF(z1, z2, results.correlation)).toFixed(6)} $$`}</Latex>
                    Term B: <Latex>{`$$ \\Phi_2(${z3.toFixed(2)}, ${z2.toFixed(2)}, \\rho) = ${(bivariateNormalCDF(z3, z2, results.correlation)).toFixed(6)} $$`}</Latex>
                    Term C: <Latex>{`$$ \\Phi_2(${z4.toFixed(2)}, ${z5.toFixed(2)}, \\rho) = ${(bivariateNormalCDF(z4, z5, results.correlation)).toFixed(6)} $$`}</Latex>
                    Term D: <Latex>{`$$ \\Phi_2(${z6.toFixed(2)}, ${z5.toFixed(2)}, \\rho) = ${(bivariateNormalCDF(z6, z5, results.correlation)).toFixed(6)} $$`}</Latex>
                </div>
                <div className="breakdown-step">
                    <h5>Step 3: Final PFR Calculation</h5>
                    Lower Side Risk (A-B): <Latex>{`$$ ${(results.pfr_term1 / 100).toFixed(6)} $$`}</Latex>
                    Upper Side Risk (C-D): <Latex>{`$$ ${(results.pfr_term2 / 100).toFixed(6)} $$`}</Latex>
                    Total PFR = <Latex>{`$$ \\mathbf{${results.pfr.toFixed(4)}\\%} $$`}</Latex>
                </div>
            </div>
        </div>
    );
};

const RiskAnalysisDashboard = ({ results, onShowBreakdown }) => {
    if (!results) return null;
    const getPfaClass = (pfa) => {
        if (pfa > 5) return 'status-bad';
        if (pfa > 2) return 'status-warning';
        return 'status-good';
    };

    return (
        <div className="risk-analysis-container">
            <div className="risk-analysis-dashboard">
                <div className="risk-card">
                    <div className="risk-label" style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '15px' }}>Key Calculation Inputs</div>
                    <ul className="result-breakdown" style={{ marginTop: 0 }}>
                        <li><span className="label">Std. Unc. of Cal (uₑₐₗ)</span><span className="value">{results.uCal.toFixed(3)} ppm</span></li>
                        <li><span className="label">Std. Unc. of UUT (uᵤᵤₜ)</span><span className="value">{results.uUUT.toFixed(3)} ppm</span></li>
                        <li><span className="label">Acceptance Limit (Aₗₒw)</span><span className="value">{results.ALow.toFixed(3)} ppm</span></li>
                        <li><span className="label">Acceptance Limit (Aᵤₚ)</span><span className="value">{results.AUp.toFixed(3)} ppm</span></li>
                    </ul>
                    <button className="button button-small breakdown-button" onClick={() => onShowBreakdown('inputs')}>Show Breakdown</button>
                </div>
                <div className="risk-card tur-card">
                    <div className="risk-value">{results.tur.toFixed(2)} : 1</div>
                    <div className="risk-label">Test Uncertainty Ratio (TUR)</div>
                    <div className="risk-explanation">A ratio of the UUT's tolerance to the measurement uncertainty.</div>
                    <button className="button button-small breakdown-button" onClick={() => onShowBreakdown('tur')}>Show Breakdown</button>
                </div>
                <div className="risk-card tur-card">
                    <div className="risk-value">{results.tar.toFixed(2)} : 1</div>
                    <div className="risk-label">Test Acceptance Ratio (TAR)</div>
                    <div className="risk-explanation">A ratio of the UUT's tolerance span to the TMDE's (Standard's) tolerance span.</div>
                    <button className="button button-small breakdown-button" onClick={() => onShowBreakdown('tar')}>Show Breakdown</button>
                </div>
                <div className={`risk-card pfa-card ${getPfaClass(results.pfa)}`}>
                    <div className="risk-value">{results.pfa.toFixed(4)} %</div>
                    <div className="risk-label">Probability of False Accept (PFA)</div>
                    <ul className="result-breakdown" style={{ fontSize: '0.85rem' }}>
                        <li><span className="label">Lower Tail Risk</span><span className="value">{results.pfa_term1.toFixed(4)} %</span></li>
                        <li><span className="label">Upper Tail Risk</span><span className="value">{results.pfa_term2.toFixed(4)} %</span></li>
                    </ul>
                    <button className="button button-small breakdown-button" onClick={() => onShowBreakdown('pfa')}>Show Breakdown</button>
                </div>
                <div className="risk-card pfr-card">
                    <div className="risk-value">{results.pfr.toFixed(4)} %</div>
                    <div className="risk-label">Probability of False Reject (PFR)</div>
                    <ul className="result-breakdown" style={{ fontSize: '0.85rem' }}>
                        <li><span className="label">Lower Side Risk</span><span className="value">{results.pfr_term1.toFixed(4)} %</span></li>
                        <li><span className="label">Upper Side Risk</span><span className="value">{results.pfr_term2.toFixed(4)} %</span></li>
                    </ul>
                    <button className="button button-small breakdown-button" onClick={() => onShowBreakdown('pfr')}>Show Breakdown</button>
                </div>
            </div>
        </div>
    );
};

const ToleranceInput = ({ title, data, onChange, nominal }) => {
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        onChange({ ...data, [name]: value });
    };

    const isUUT = title.includes('UUT');
    const unitOptions = ["ppm", "%", "V", "mV", "uV", "A", "mA", "uA", "Hz", "kHz", "MHz", "Ohm", "kOhm", "MOhm", "deg F", "deg C"];

    return (
        <div className="tolerance-input-card">
            <h5>{title}</h5>
            <div className="config-stack">
                <div className="config-column">
                    <label>Distribution</label>
                    <select name="distribution" value={data.distribution} onChange={handleInputChange}>
                        <option value="uniform">Uniform (Rectangular)</option>
                        <option value="triangular">Triangular</option>
                        <option value="normal">Normal</option>
                    </select>
                </div>
                
                {isUUT && (
                     <div className="config-column">
                        <label>Tolerance Limits (±)</label>
                        <div className="input-with-unit">
                            <input type="number" step="any" name="toleranceLimit" value={data.toleranceLimit || ''} onChange={handleInputChange} placeholder="e.g., 100" />
                            <select name="unit" value={data.unit || 'ppm'} onChange={handleInputChange}>
                                {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                         <ConversionInfo value={data.toleranceLimit} unit={data.unit} nominal={nominal} />
                    </div>
                )}

                {!isUUT && (data.distribution === 'uniform' || data.distribution === 'triangular') && (
                    <div className="config-column">
                        <label>Tolerance Limits (±)</label>
                        <div className="input-with-unit">
                            <input type="number" step="any" name="toleranceLimit" value={data.toleranceLimit || ''} onChange={handleInputChange} placeholder="e.g., 100" />
                             <select name="unit" value={data.unit || 'ppm'} onChange={handleInputChange}>
                                {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                        <ConversionInfo value={data.toleranceLimit} unit={data.unit} nominal={nominal} />
                    </div>
                )}
                
                {!isUUT && data.distribution === 'normal' && (
                    <>
                        <div className="config-column">
                            <label>Expanded Uncertainty (±)</label>
                             <div className="input-with-unit">
                                <input type="number" step="any" name="expandedUncertainty" value={data.expandedUncertainty || ''} onChange={handleInputChange} placeholder="e.g., 50" />
                                 <select name="unit" value={data.unit || 'ppm'} onChange={handleInputChange}>
                                    {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <ConversionInfo value={data.expandedUncertainty} unit={data.unit} nominal={nominal} />
                        </div>
                        <div className="config-column">
                            <label>Coverage Factor (k)</label>
                            <input type="number" step="any" name="coverageFactor" value={data.coverageFactor || ''} onChange={handleInputChange} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const unitFamilies = {
    'V': 'Voltage', 'mV': 'Voltage', 'uV': 'Voltage',
    'A': 'Current', 'mA': 'Current', 'uA': 'Current',
    'Hz': 'Frequency', 'kHz': 'Frequency', 'MHz': 'Frequency',
    'Ohm': 'Resistance', 'kOhm': 'Resistance', 'MOhm': 'Resistance',
    'deg F': 'Temperature', 'deg C': 'Temperature',
    '%': 'Relative',
    'ppm': 'Relative'
};

const convertToPPM = (value, unit, nominalValue, nominalUnit, getExplanation = false) => {
    const parsedValue = parseFloat(value);
    const parsedNominal = parseFloat(nominalValue);

    if (isNaN(parsedValue) || parsedValue === 0) {
        return getExplanation ? { value: 0 } : 0;
    }

    if (unit === 'ppm') {
        return getExplanation ? { value: parsedValue, explanation: `${parsedValue.toFixed(2)} ppm (no conversion needed)` } : parsedValue;
    }

    if (unit === '%') {
        const ppmValue = (parsedValue / 100) * 1e6;
        const explanation = `(${parsedValue} / 100) × 1,000,000 = ${ppmValue.toFixed(2)} ppm`;
        return getExplanation ? { value: ppmValue, explanation } : ppmValue;
    }

    if (!nominalUnit || isNaN(parsedNominal) || parsedNominal === 0) {
        const warning = `Cannot convert from ${unit} without a valid, non-zero nominal value.`;
        return getExplanation ? { value: NaN, warning } : NaN;
    }

    const valueFamily = unitFamilies[unit];
    const nominalFamily = unitFamilies[nominalUnit];

    if (valueFamily && nominalFamily && valueFamily !== nominalFamily) {
        const warning = `Unit mismatch: Cannot convert tolerance in ${unit} (${valueFamily}) to a nominal value in ${nominalUnit} (${nominalFamily}).`;
        return getExplanation ? { value: NaN, warning } : NaN;
    }

    const multipliers = {
        'V': 1, 'mV': 1e-3, 'uV': 1e-6,
        'A': 1, 'mA': 1e-3, 'uA': 1e-6,
        'Hz': 1, 'kHz': 1e3, 'MHz': 1e6,
        'Ohm': 1, 'kOhm': 1e3, 'MOhm': 1e6,
        'deg F': NaN, 'deg C': NaN
    };

    const multiplier = multipliers[unit];
    if (isNaN(multiplier)) {
        const warning = `Conversion for unit '${unit}' is not supported or is incompatible.`;
        return getExplanation ? { value: NaN, warning } : NaN;
    }

    const absoluteValue = parsedValue * multiplier;
    const ppmValue = (absoluteValue / parsedNominal) * 1e6;
    const explanation = `((${parsedValue} ${unit} × ${multiplier}) / ${parsedNominal} ${nominalUnit}) × 1,000,000 = ${ppmValue.toFixed(2)} ppm`;
    return getExplanation ? { value: ppmValue, explanation } : ppmValue;
};


// --- ANALYSIS COMPONENT (HANDLES THE THREE VIEWS) ---
function Analysis({ testPointData, onDataSave, defaultTestPoint }) {
    const { 
        uut: initialUut, 
        tmde: initialTmde, 
        specifications: initialSpecs, 
        components: initialManualComponents,
    } = testPointData;
    
    // --- STATE MANAGEMENT ---
    const [analysisMode, setAnalysisMode] = useState('detailed');
    const [manualComponents, setManualComponents] = useState(initialManualComponents || []);
    const [uutInput, setUutInput] = useState(initialUut || defaultTestPoint.uut);
    const [tmdeInput, setTmdeInput] = useState(initialTmde || defaultTestPoint.tmde);
    const [specInput, setSpecInput] = useState(initialSpecs || defaultTestPoint.specifications);
    const [newComponent, setNewComponent] = useState({ name: '', type: 'B', distribution: 'uniform', toleranceLimit: '', unit: 'ppm', expandedUncertainty: '', coverageFactor: 2, standardUncertainty: '', dof: 'Infinity' });
    const [useTDistribution, setUseTDistribution] = useState(false);
    const [calcResults, setCalcResults] = useState(null);
    const [riskInputs, setRiskInputs] = useState({ LLow: '', LUp: '', reliability: 0.95, guardBandMultiplier: 1 });
    const [riskResults, setRiskResults] = useState(null);
    const [breakdownModal, setBreakdownModal] = useState(null);
    const [notification, setNotification] = useState(null);


    // --- EFFECTS ---
    useEffect(() => {
        const {
            uut: newUut,
            tmde: newTmde,
            specifications: newSpecs,
            components: newManualComponents,
            ...newResults
        } = testPointData;
    
        setManualComponents(newManualComponents || []);
        setUutInput(newUut || defaultTestPoint.uut);
        setTmdeInput(newTmde || defaultTestPoint.tmde);
        setSpecInput(newSpecs || defaultTestPoint.specifications);
        setCalcResults(newResults.is_detailed_uncertainty_calculated ? { ...newResults } : null);
        setRiskResults(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [testPointData.id, defaultTestPoint]);

    useEffect(() => {
        const handler = setTimeout(() => {
            onDataSave({ uut: uutInput, tmde: tmdeInput, specifications: specInput, components: manualComponents });
        }, 500);
        return () => clearTimeout(handler);
    }, [uutInput, tmdeInput, specInput, manualComponents, onDataSave]);
    
    useEffect(() => {
        const toleranceValue = parseFloat(uutInput.toleranceLimit);
        if (!isNaN(toleranceValue)) {
            const nominal = testPointData?.testPointInfo?.parameter;
            const ppmValue = convertToPPM(toleranceValue, uutInput.unit, nominal?.value, nominal?.unit);
            
            if (!isNaN(ppmValue)) {
                 setRiskInputs(prev => ({
                    ...prev,
                    LLow: -ppmValue,
                    LUp: ppmValue
                }));
            }
        } else {
             setRiskInputs(prev => ({ ...prev, LLow: '', LUp: '' }));
        }
    }, [uutInput.toleranceLimit, uutInput.unit, testPointData]);


    // --- MEMOIZED CALCULATIONS ---
    const allComponents = useMemo(() => {
        const components = [...manualComponents];
        const nominal = testPointData?.testPointInfo?.parameter;
        
        const calculateValue = (input, isUUT) => {
            let value = 0;
            let toleranceForTar = null;

            if (isUUT) {
                const tol = parseFloat(input.toleranceLimit);
                if (!isNaN(tol) && tol > 0) {
                    const ppmValue = convertToPPM(tol, input.unit, nominal?.value, nominal?.unit);
                    if (input.distribution === 'uniform') value = ppmValue / Math.sqrt(3);
                    else if (input.distribution === 'triangular') value = ppmValue / Math.sqrt(6);
                    else if (input.distribution === 'normal') value = ppmValue / 2;
                    toleranceForTar = ppmValue;
                }
            } else {
                if (input.distribution === 'uniform' || input.distribution === 'triangular') {
                    const tol = parseFloat(input.toleranceLimit);
                    if (!isNaN(tol) && tol > 0) {
                        const ppmValue = convertToPPM(tol, input.unit, nominal?.value, nominal?.unit);
                         if (input.distribution === 'uniform') value = ppmValue / Math.sqrt(3);
                         else value = ppmValue / Math.sqrt(6);
                         toleranceForTar = ppmValue;
                    }
                } else if (input.distribution === 'normal') {
                    const expUnc = parseFloat(input.expandedUncertainty);
                    const k = parseFloat(input.coverageFactor);
                    if (!isNaN(expUnc) && !isNaN(k) && expUnc > 0 && k > 0) {
                        const ppmValue = convertToPPM(expUnc, input.unit, nominal?.value, nominal?.unit);
                        value = ppmValue / k;
                        toleranceForTar = ppmValue;
                    }
                }
            }
            if (isNaN(value)) value = 0;
            return { value, toleranceForTar };
        };

        const { value: uutValue, toleranceForTar: uutTolerance } = calculateValue(uutInput, true);
        if (uutValue > 0) {
            components.push({ id: 'uut_core', name: 'Unit Under Test (UUT)', type: 'B', value: uutValue, dof: Infinity, isCore: true, toleranceLimit: uutTolerance });
        }
        
        const { value: tmdeValue, toleranceForTar: tmdeTolerance } = calculateValue(tmdeInput, false);
        if (tmdeValue > 0) {
            components.push({ id: 'tmde_core', name: 'Standard Instrument (TMDE)', type: 'B', value: tmdeValue, dof: Infinity, isCore: true, toleranceLimit: tmdeTolerance });
        }

        return components;
    }, [manualComponents, uutInput, tmdeInput, testPointData]);

    useEffect(() => {
        if (allComponents.length === 0) {
            setCalcResults(null);
            return;
        }
        const combinedVariance = allComponents.reduce((sum, comp) => sum + Math.pow(comp.value, 2), 0);
        const combinedUncertainty = Math.sqrt(combinedVariance);
        const numerator = Math.pow(combinedUncertainty, 4);
        const denominator = allComponents.reduce((sum, comp) => (comp.dof === Infinity ? sum : sum + (Math.pow(comp.value, 4) / comp.dof)), 0);
        const effectiveDof = denominator > 0 ? numerator / denominator : Infinity;
        const kValue = useTDistribution ? getKValueFromTDistribution(effectiveDof) : 2;
        const expandedUncertainty = kValue * combinedUncertainty;

        const newResults = {
            combined_uncertainty: combinedUncertainty,
            effective_dof: effectiveDof,
            k_value: kValue,
            expanded_uncertainty: expandedUncertainty,
            is_detailed_uncertainty_calculated: true
        };
        setCalcResults(newResults);
        onDataSave(newResults);
    }, [allComponents, useTDistribution, onDataSave]);


    // --- HANDLERS ---
    const handleAddComponent = () => {
        let valueInPPM = NaN;
        let dof = newComponent.dof === 'Infinity' ? Infinity : parseFloat(newComponent.dof);
        const nominal = testPointData?.testPointInfo?.parameter;
        
        if (newComponent.type === 'A') {
            const stdUnc = parseFloat(newComponent.standardUncertainty);
            if (isNaN(stdUnc) || stdUnc <= 0 || isNaN(dof) || dof < 1) {
                setNotification({ title: 'Invalid Input', message: 'For Type A, please provide a valid positive Standard Uncertainty and Degrees of Freedom (>=1).' });
                return;
            }
            const { value: ppm, warning } = convertToPPM(stdUnc, newComponent.unit, nominal?.value, nominal?.unit, true);
            if (warning) {
                setNotification({ title: 'Conversion Error', message: warning });
                return;
            }
            valueInPPM = ppm;
        } else {
            let rawValue, kFactor;
            switch (newComponent.distribution) {
                case 'uniform':
                case 'triangular':
                    rawValue = parseFloat(newComponent.toleranceLimit);
                    if (isNaN(rawValue) || rawValue <= 0) {
                        setNotification({ title: 'Invalid Input', message: 'Please provide a valid, positive tolerance limit.' });
                        return;
                    }
                    const { value: ppm, warning } = convertToPPM(rawValue, newComponent.unit, nominal?.value, nominal?.unit, true);
                     if (warning) {
                        setNotification({ title: 'Conversion Error', message: warning });
                        return;
                    }
                    valueInPPM = newComponent.distribution === 'uniform' ? ppm / Math.sqrt(3) : ppm / Math.sqrt(6);
                    break;
                case 'normal':
                    rawValue = parseFloat(newComponent.expandedUncertainty);
                    kFactor = parseFloat(newComponent.coverageFactor);
                    if (isNaN(rawValue) || isNaN(kFactor) || rawValue <= 0 || kFactor <= 0) {
                        setNotification({ title: 'Invalid Input', message: 'Please provide valid expanded uncertainty and coverage factor.' });
                        return;
                    }
                    const { value: ppmNorm, warning: warnNorm } = convertToPPM(rawValue, newComponent.unit, nominal?.value, nominal?.unit, true);
                    if (warnNorm) {
                        setNotification({ title: 'Conversion Error', message: warnNorm });
                        return;
                    }
                    valueInPPM = ppmNorm / kFactor;
                    break;
                default:
                    setNotification({ title: 'Error', message: 'Invalid distribution selected.' });
                    return;
            }
        }

        if (!newComponent.name || isNaN(valueInPPM)) {
            setNotification({ title: 'Invalid Input', message: 'Component name and a valid, convertible uncertainty value are required.' });
            return;
        }

        const componentToAdd = { ...newComponent, id: Date.now(), value: valueInPPM, dof };
        const updatedComponents = [...manualComponents, componentToAdd];
        setManualComponents(updatedComponents);
        setNewComponent({ name: '', type: 'B', distribution: 'uniform', toleranceLimit: '', unit: 'ppm', expandedUncertainty: '', coverageFactor: 2, standardUncertainty: '', dof: 'Infinity' });
    };
    
    const handleRemoveComponent = (id) => {
        const updatedComponents = manualComponents.filter(c => c.id !== id);
        setManualComponents(updatedComponents);
    };

    const handleNewComponentInputChange = (e) => setNewComponent(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleRiskInputChange = (e) => {
        const { name, value } = e.target;
        setRiskInputs(prev => ({ ...prev, [name]: value }));
    };

    const calculateRiskMetrics = () => {
        const LLow = parseFloat(riskInputs.LLow);
        const LUp = parseFloat(riskInputs.LUp);
        const reliability = parseFloat(riskInputs.reliability);
        const guardBandMultiplier = parseFloat(riskInputs.guardBandMultiplier);

        if (isNaN(LLow) || isNaN(LUp) || LUp <= LLow) { setNotification({ title: 'Invalid Input', message: 'Please enter valid UUT tolerance limits.' }); return; }
        if (isNaN(reliability) || reliability <= 0 || reliability >= 1) { setNotification({ title: 'Invalid Input', message: 'Please enter a valid reliability (e.g., 0.95).' }); return; }
        if (isNaN(guardBandMultiplier) || guardBandMultiplier < 0 || guardBandMultiplier > 1) { setNotification({ title: 'Invalid Input', message: 'Guard Band Multiplier must be between 0 and 1.' }); return; }
        if (!calcResults) { setNotification({ title: 'Calculation Required', message: 'A detailed uncertainty budget must be calculated first.' }); return; }

        const calibrationComponents = allComponents.filter(c => c.id !== 'uut_core');
        const calVariance = calibrationComponents.reduce((sum, comp) => sum + Math.pow(comp.value, 2), 0);
        const uCal = Math.sqrt(calVariance);

        const tmdeComponent = allComponents.find(c => c.id === 'tmde_core');
        if (!tmdeComponent || !tmdeComponent.toleranceLimit) {
            setNotification({ title: 'Missing Component', message: "Could not find the TMDE component with a tolerance limit in the budget. Please define it on the 'Detailed Budget' tab." });
            return;
        }
        const tmdeToleranceSpan = tmdeComponent.toleranceLimit * 2;

        const mid = (LUp + LLow) / 2;
        const LUp_symmetric = Math.abs(LUp - mid);
        const uDev = LUp_symmetric / probit((1 + reliability) / 2);
        
        const uUUT2 = uDev ** 2 - uCal ** 2;
        let uUUT = 0;
        if (uUUT2 <= 0) {
            setNotification({ title: 'Calculation Warning', message: `The calibration uncertainty (uCal=${uCal.toFixed(3)}) is greater than the required deviation uncertainty (uDev=${uDev.toFixed(3)}) for the specified reliability. UUT uncertainty will be treated as zero.` });
            uUUT = 0;
        } else {
            uUUT = Math.sqrt(uUUT2);
        }

        const ALow = LLow * guardBandMultiplier;
        const AUp = LUp * guardBandMultiplier;
        const uDev_risk = Math.sqrt(uUUT ** 2 + uCal ** 2);
        const correlation = (uUUT === 0 || uDev_risk === 0) ? 0 : uUUT / uDev_risk;
        const LLow_norm = (LLow - mid);
        const LUp_norm = (LUp - mid);
        const ALow_norm = (ALow - mid);
        const AUp_norm = (AUp - mid);

        const pfa_term1 = bivariateNormalCDF(LLow_norm / uUUT, AUp_norm / uDev_risk, correlation) - bivariateNormalCDF(LLow_norm / uUUT, ALow_norm / uDev_risk, correlation);
        const pfa_term2 = bivariateNormalCDF(-LUp_norm / uUUT, -ALow_norm / uDev_risk, correlation) - bivariateNormalCDF(-LUp_norm / uUUT, -AUp_norm / uDev_risk, correlation);
        const pfaResult = isNaN(pfa_term1) || isNaN(pfa_term2) ? 0 : pfa_term1 + pfa_term2;

        const pfr_term1 = bivariateNormalCDF(LUp_norm / uUUT, ALow_norm / uDev_risk, correlation) - bivariateNormalCDF(LLow_norm / uUUT, ALow_norm / uDev_risk, correlation);
        const pfr_term2 = bivariateNormalCDF(-LLow_norm / uUUT, -AUp_norm / uDev_risk, correlation) - bivariateNormalCDF(-LUp_norm / uUUT, -AUp_norm / uDev_risk, correlation);
        const pfrResult = isNaN(pfr_term1) || isNaN(pfr_term2) ? 0 : pfr_term1 + pfr_term2;

        const turResult = (LUp - LLow) / (2 * calcResults.expanded_uncertainty);
        const tarResult = tmdeToleranceSpan !== 0 ? (LUp - LLow) / tmdeToleranceSpan : 0;

        setRiskResults({
            tur: turResult, tar: tarResult, pfa: pfaResult * 100, pfr: pfrResult * 100,
            pfa_term1: (isNaN(pfa_term1) ? 0 : pfa_term1) * 100, pfa_term2: (isNaN(pfa_term2) ? 0 : pfa_term2) * 100,
            pfr_term1: (isNaN(pfr_term1) ? 0 : pfr_term1) * 100, pfr_term2: (isNaN(pfr_term2) ? 0 : pfr_term2) * 100,
            uCal, uUUT, uDev: uDev_risk, correlation, ALow, AUp,
            expandedUncertainty: calcResults.expanded_uncertainty, tmdeToleranceSpan: tmdeToleranceSpan
        });
    };
    
    const unitOptions = ["ppm", "%", "V", "mV", "uV", "A", "mA", "uA", "Hz", "kHz", "MHz", "Ohm", "kOhm", "MOhm", "deg F", "deg C"];


    // --- RENDER METHODS ---
    const renderSpecComparison = () => {
        if (!calcResults) {
            return <div className="form-section-warning"><p>A detailed uncertainty budget must be calculated first.</p></div>;
        }
        
        const handleSpecInputChange = (e) => setSpecInput(prev => ({...prev, [e.target.name]: { ...prev[e.target.name], [e.target.dataset.field]: e.target.value }}));

        const ComparisonCard = ({ title, specData, userUncertainty, kUser }) => {
            const U_user = userUncertainty;
            const U_spec = parseFloat(specData.uncertainty);
            const k_spec = parseFloat(specData.k);
            
            let status = 'Not Defined';
            let statusClass = '';
            let percentageOfSpec = null;

            if (!isNaN(U_spec) && U_spec > 0) {
                percentageOfSpec = (U_user / U_spec) * 100;
                statusClass = 'status-good';
                status = 'Within Specification';
                 if (percentageOfSpec > 100) { status = 'Exceeds Specification'; statusClass = 'status-bad'; } 
                 else if (percentageOfSpec > 90) { status = 'Approaching Limit'; statusClass = 'status-warning'; }
            }

            return (
                 <div className={`spec-dashboard ${statusClass}`}>
                    <h4>{title}</h4>
                    <div className="spec-details-container full-width">
                         <div className="spec-detail-card user-spec">
                            <span className="detail-label">Your Expanded Uncertainty (U)</span>
                            <span className="detail-value">{U_user.toFixed(3)} ppm</span>
                             <span className="detail-sub-value">k ≈ {kUser.toFixed(2)}</span>
                        </div>
                        <div className="spec-detail-card mfg-spec">
                            <span className="detail-label">{title} (U)</span>
                             <span className="detail-value">{!isNaN(U_spec) ? `${U_spec.toFixed(3)} ppm` : 'N/A'}</span>
                             <span className="detail-sub-value">{!isNaN(k_spec) ? `k = ${k_spec.toFixed(2)}` : ''}</span>
                        </div>
                    </div>
                    {percentageOfSpec !== null && <div className="spec-status-footer"><strong>Status:</strong> {status} ({percentageOfSpec.toFixed(1)}%)</div>}
                </div>
            );
        };
        
        return (
            <div>
                <div className="spec-input-container">
                    <div className="spec-input-column">
                        <h5>Manufacturer Specs</h5>
                        <label>Spec (± ppm)</label>
                        <input type="number" name="mfg" data-field="uncertainty" value={specInput.mfg.uncertainty || ''} onChange={handleSpecInputChange} />
                        <label>k-factor</label>
                        <input type="number" name="mfg" data-field="k" value={specInput.mfg.k || ''} onChange={handleSpecInputChange} />
                    </div>
                    <div className="spec-input-column">
                        <h5>Navy Requirements</h5>
                        <label>Requirement (± ppm)</label>
                        <input type="number" name="navy" data-field="uncertainty" value={specInput.navy.uncertainty || ''} onChange={handleSpecInputChange} />
                        <label>k-factor</label>
                        <input type="number" name="navy" data-field="k" value={specInput.navy.k || ''} onChange={handleSpecInputChange} />
                    </div>
                </div>
                <div style={{display: 'flex', gap: '20px', marginTop: '20px'}}>
                    <ComparisonCard title="Manufacturer Specification" specData={specInput.mfg} userUncertainty={calcResults.expanded_uncertainty} kUser={calcResults.k_value} />
                    <ComparisonCard title="Navy Requirement" specData={specInput.navy} userUncertainty={calcResults.expanded_uncertainty} kUser={calcResults.k_value} />
                </div>
            </div>
        );
    };

    return (
        <div>
            <NotificationModal 
                isOpen={!!notification} 
                onClose={() => setNotification(null)}
                title={notification?.title}
                message={notification?.message}
            />

            {breakdownModal && <div className="modal-placeholder" />}
            {breakdownModal === 'inputs' && <InputsBreakdownModal results={riskResults} inputs={{ ...riskInputs, LLow: parseFloat(riskInputs.LLow), LUp: parseFloat(riskInputs.LUp) }} onClose={() => setBreakdownModal(null)} />}
            {breakdownModal === 'tur' && <TurBreakdownModal results={riskResults} inputs={{ ...riskInputs, LLow: parseFloat(riskInputs.LLow), LUp: parseFloat(riskInputs.LUp) }} onClose={() => setBreakdownModal(null)} />}
            {breakdownModal === 'tar' && <TarBreakdownModal results={riskResults} inputs={{ ...riskInputs, LLow: parseFloat(riskInputs.LLow), LUp: parseFloat(riskInputs.LUp) }} onClose={() => setBreakdownModal(null)} />}
            {breakdownModal === 'pfa' && <PfaBreakdownModal results={riskResults} inputs={{ ...riskInputs, LLow: parseFloat(riskInputs.LLow), LUp: parseFloat(riskInputs.LUp) }} onClose={() => setBreakdownModal(null)} />}
            {breakdownModal === 'pfr' && <PfrBreakdownModal results={riskResults} inputs={{ ...riskInputs, LLow: parseFloat(riskInputs.LLow), LUp: parseFloat(riskInputs.LUp) }} onClose={() => setBreakdownModal(null)} />}
            
            <div className="view-toggle" style={{ justifyContent: 'center', marginBottom: '30px' }}>
                <button className={analysisMode === 'detailed' ? 'active' : ''} onClick={() => setAnalysisMode('detailed')}>Detailed Budget</button>
                <button className={analysisMode === 'risk' ? 'active' : ''} onClick={() => setAnalysisMode('risk')}>Risk Analysis</button>
                <button className={analysisMode === 'spec' ? 'active' : ''} onClick={() => setAnalysisMode('spec')}>Specification Comparison</button>
            </div>

            <Accordion title="Final Uncertainty Result" startOpen={true}>
                <FinalUncertaintyCard calcResults={calcResults} testPointInfo={testPointData?.testPointInfo} />
            </Accordion>
            
            {analysisMode === 'detailed' && (
                <>
                     <Accordion title="Tolerance Inputs" startOpen={true}>
                        <div className="tolerance-input-container">
                            <ToleranceInput title="Unit Under Test (UUT)" data={uutInput} onChange={setUutInput} nominal={testPointData?.testPointInfo?.parameter} />
                            <ToleranceInput title="Standard Instrument (TMDE)" data={tmdeInput} onChange={setTmdeInput} nominal={testPointData?.testPointInfo?.parameter} />
                        </div>
                    </Accordion>
                    <div className="analysis-dashboard">
                        <div className="configuration-panel">
                             <Accordion title="Add Manual Uncertainty Component">
                                <div className="config-stack">
                                    <div className="config-column">
                                        <label>Component Name</label>
                                        <input type="text" name="name" value={newComponent.name} onChange={handleNewComponentInputChange} placeholder="e.g., UUT Stability Spec" />
                                    </div>
                                    <div className="config-column">
                                        <label>Type</label>
                                        <select name="type" value={newComponent.type} onChange={handleNewComponentInputChange}>
                                            <option value="A">Type A</option>
                                            <option value="B">Type B</option>
                                        </select>
                                    </div>
                                    {newComponent.type === 'A' && (
                                        <>
                                            <div className="config-column">
                                                <label>Standard Uncertainty (uᵢ)</label>
                                                <div className="input-with-unit">
                                                    <input type="number" step="any" name="standardUncertainty" value={newComponent.standardUncertainty} onChange={handleNewComponentInputChange} placeholder="e.g., 15.3" />
                                                    <select name="unit" value={newComponent.unit} onChange={handleNewComponentInputChange}>
                                                        {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                                                    </select>
                                                </div>
                                                 <ConversionInfo value={newComponent.standardUncertainty} unit={newComponent.unit} nominal={testPointData?.testPointInfo?.parameter} />
                                            </div>
                                            <div className="config-column">
                                                <label>Degrees of Freedom (vᵢ)</label>
                                                <input type="number" step="1" min="1" name="dof" value={newComponent.dof} onChange={handleNewComponentInputChange} placeholder="e.g., 9" />
                                            </div>
                                        </>
                                    )}
                                    {newComponent.type === 'B' && (
                                        <>
                                            <div className="config-column">
                                                <label>Distribution</label>
                                                <select name="distribution" value={newComponent.distribution} onChange={handleNewComponentInputChange}>
                                                    <option value="uniform">Uniform (Rectangular)</option>
                                                    <option value="triangular">Triangular</option>
                                                    <option value="normal">Normal</option>
                                                </select>
                                            </div>
                                            {(newComponent.distribution === 'uniform' || newComponent.distribution === 'triangular') && (
                                                <div className="config-column">
                                                    <label>Tolerance Limits (±)</label>
                                                    <div className="input-with-unit">
                                                        <input type="number" step="any" name="toleranceLimit" value={newComponent.toleranceLimit} onChange={handleNewComponentInputChange} placeholder="e.g., 100" />
                                                        <select name="unit" value={newComponent.unit} onChange={handleNewComponentInputChange}>
                                                            {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                                                        </select>
                                                    </div>
                                                     <ConversionInfo value={newComponent.toleranceLimit} unit={newComponent.unit} nominal={testPointData?.testPointInfo?.parameter} />
                                                </div>
                                            )}
                                            {newComponent.distribution === 'normal' && (<>
                                                <div className="config-column">
                                                    <label>Expanded Uncertainty (±)</label>
                                                    <div className="input-with-unit">
                                                        <input type="number" step="any" name="expandedUncertainty" value={newComponent.expandedUncertainty} onChange={handleNewComponentInputChange} placeholder="e.g., 50" />
                                                        <select name="unit" value={newComponent.unit} onChange={handleNewComponentInputChange}>
                                                            {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                                                        </select>
                                                    </div>
                                                     <ConversionInfo value={newComponent.expandedUncertainty} unit={newComponent.unit} nominal={testPointData?.testPointInfo?.parameter} />
                                                </div>
                                                <div className="config-column">
                                                    <label>Coverage Factor (k)</label>
                                                    <input type="number" step="any" name="coverageFactor" value={newComponent.coverageFactor} onChange={handleNewComponentInputChange} />
                                                </div>
                                            </>)}
                                            <div className="config-column">
                                                <label>Degrees of Freedom</label>
                                                <input type="text" name="dof" value={newComponent.dof} onChange={handleNewComponentInputChange} placeholder="Infinity" />
                                            </div>
                                        </>
                                    )}
                                </div>
                                <button onClick={handleAddComponent} className="button" style={{ marginTop: '15px' }}>Add Component</button>
                            </Accordion>
                        </div>
                         <div className="configuration-panel">
                            <Accordion title="Uncertainty Budget" startOpen={true}>
                                <UncertaintyBudgetTable
                                    components={allComponents}
                                    onRemove={handleRemoveComponent}
                                    calcResults={calcResults}
                                    useTDistribution={useTDistribution}
                                    setUseTDistribution={setUseTDistribution}
                                />
                            </Accordion>
                        </div>
                    </div>
                </>
            )}
            {analysisMode === 'risk' && (
                 <Accordion title="Risk & Conformance Analysis" startOpen={true}>
                    {!calcResults ? (
                        <div className="form-section-warning"><p>A detailed uncertainty budget must be calculated first on the 'Detailed Budget' tab.</p></div>
                    ) : (
                        <>
                            <div className="risk-inputs-container">
                                <div className="config-column uut-tolerance-display">
                                    <label>UUT Tolerance Limits (in ppm)</label>
                                    <span>
                                        LLow: <strong>{riskInputs.LLow ? parseFloat(riskInputs.LLow).toFixed(3) : 'N/A'}</strong>
                                    </span>
                                    <span>
                                        LUp: <strong>{riskInputs.LUp ? parseFloat(riskInputs.LUp).toFixed(3) : 'N/A'}</strong>
                                    </span>
                                    <small>Derived from UUT input on the 'Detailed Budget' tab.</small>
                                </div>
                                <div className="config-column">
                                    <label>Target Reliability (R)</label>
                                    <input type="number" step="0.01" max="0.9999" min="0.5" name="reliability" value={riskInputs.reliability} onChange={handleRiskInputChange} />
                                </div>
                                <div className="config-column">
                                    <label>Guard Band Multiplier</label>
                                    <input type="number" step="0.01" max="1" min="0" name="guardBandMultiplier" value={riskInputs.guardBandMultiplier} onChange={handleRiskInputChange} />
                                </div>
                            </div>
                            <button onClick={calculateRiskMetrics} className="button" style={{ marginTop: '10px' }}>Calculate Risk Metrics</button>
                            {riskResults && <RiskAnalysisDashboard results={riskResults} onShowBreakdown={(modalType) => setBreakdownModal(modalType)} />}
                        </>
                    )}
                </Accordion>
            )}
            {analysisMode === 'spec' && (
                <Accordion title="Specification Comparison Analysis" startOpen={true}>
                    {renderSpecComparison()}
                </Accordion>
            )}
        </div>
    );
}

const AddTestPointModal = ({ isOpen, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        section: '',
        paramName: '',
        paramValue: '',
        paramUnit: '',
        UUT: '',
        qualName: '',
        qualValue: '',
        qualUnit: '',
    });
    const [notification, setNotification] = useState(null);


    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        const requiredFields = ['section', 'paramName', 'paramUnit', 'paramValue', 'UUT'];

        for (const key of requiredFields) {
            if (!formData[key]) {
                 setNotification({ title: 'Missing Information', message: `Please fill out the "${key}" field.` });
                return;
            }
        }
        onSave(formData);
    };

    return (
        <div className="modal-overlay">
            <NotificationModal 
                isOpen={!!notification} 
                onClose={() => setNotification(null)}
                title={notification?.title}
                message={notification?.message}
            />
            <div className="modal-content" style={{maxWidth: '600px'}}>
                <button onClick={onClose} className="modal-close-button">&times;</button>
                <h3>Add New Measurement Point</h3>
                <div className="config-grid" style={{borderTop: 'none', paddingTop: '0'}}>
                    <div className='form-section'>
                        <label>Section*</label>
                        <input type="text" name="section" value={formData.section} onChange={handleChange} />
                        <label>Parameter Name*</label>
                        <input type="text" name="paramName" value={formData.paramName} onChange={handleChange} />
                        <label>Parameter Unit*</label>
                        <input type="text" name="paramUnit" value={formData.paramUnit} onChange={handleChange} />
                        <label>Parameter Value*</label>
                        <input type="text" name="paramValue" value={formData.paramValue} onChange={handleChange} />
                    </div>
                     <div className='form-section'>
                        <label>UUT*</label>
                        <input type="text" name="UUT" value={formData.UUT} onChange={handleChange} />
                        <label>Qualifier Name</label>
                        <input type="text" name="qualName" value={formData.qualName} onChange={handleChange} />
                        <label>Qualifier Unit</label>
                        <input type="text" name="qualUnit" value={formData.qualUnit} onChange={handleChange} />
                        <label>Qualifier Value</label>
                        <input type="text" name="qualValue" value={formData.qualValue} onChange={handleChange} />
                    </div>
                </div>
                 <div className="modal-actions">
                    <button className="button button-secondary" onClick={onClose}>Cancel</button>
                    <button className="button" onClick={handleSave}>Save Measurement Point</button>
                </div>
            </div>
        </div>
    );
};


// --- TOP-LEVEL APP COMPONENT ---
function App() {
    const [sessions, setSessions] = useState([{ id: 1, name: 'Local Session', testPoints: [] }]);
    const [selectedSessionId, setSelectedSessionId] = useState(1);
    const [selectedTestPointId, setSelectedTestPointId] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(true);

    const defaultTestPoint = useMemo(() => ({
        uut: { distribution: 'normal', toleranceLimit: '', unit: 'ppm' },
        tmde: { distribution: 'uniform', toleranceLimit: '', unit: 'ppm' },
        specifications: {
            mfg: { uncertainty: '', k: 2 },
            navy: { uncertainty: '', k: 2 }
        },
        components: [],
        is_detailed_uncertainty_calculated: false
    }), []);

    useEffect(() => {
        try {
            const savedSessions = localStorage.getItem('uncertaintySessions');
            if (savedSessions) {
                const parsed = JSON.parse(savedSessions);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setSessions(parsed);
                    setSelectedSessionId(parsed[0].id);
                    if (parsed[0].testPoints.length > 0) {
                        setSelectedTestPointId(parsed[0].testPoints[0].id);
                    }
                }
            }
        } catch (error) { console.error("Failed to load data from localStorage", error); }
    }, []);

    useEffect(() => {
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }, [isDarkMode]);

    const saveData = (updatedSessions) => {
        try {
            localStorage.setItem('uncertaintySessions', JSON.stringify(updatedSessions));
            setSessions(updatedSessions);
        } catch (error) { console.error("Failed to save data to localStorage", error); }
    };

    const handleSaveTestPoint = (formData) => {
        const { section, paramName, paramValue, paramUnit, UUT, qualName, qualValue, qualUnit } = formData;
        
        const newTestPoint = {
            id: Date.now(),
            testpoint: { step: section, ti: UUT },
            parameter: { name: paramName, value: paramValue, unit: paramUnit },
            qualifier: { name: qualName, value: qualValue, unit: qualUnit },
            ...defaultTestPoint
        };

        const updatedSessions = sessions.map(session => {
            if (session.id === selectedSessionId) {
                return { ...session, testPoints: [...session.testPoints, newTestPoint] };
            }
            return session;
        });

        saveData(updatedSessions);
        setSelectedTestPointId(newTestPoint.id);
        setIsAddModalOpen(false);
    };

    const handleDeleteTestPoint = (idToDelete) => {
        if (!window.confirm("Are you sure you want to delete this measurement point?")) return;

        const updatedSessions = sessions.map(session => {
            if (session.id !== selectedSessionId) return session;
            
            const filteredTestPoints = session.testPoints.filter(tp => tp.id !== idToDelete);
            return { ...session, testPoints: filteredTestPoints };
        });

        if (selectedTestPointId === idToDelete) {
             const currentSession = updatedSessions.find(s => s.id === selectedSessionId);
             const firstRemainingPoint = currentSession?.testPoints[0];
             setSelectedTestPointId(firstRemainingPoint ? firstRemainingPoint.id : null);
        }

        saveData(updatedSessions);
    };

    const handleDataSave = useCallback((updatedData) => {
        setSessions(prevSessions => {
            const updatedSessions = prevSessions.map(session => {
                if (session.id === selectedSessionId) {
                    const updatedTestPoints = session.testPoints.map(tp => {
                        if (tp.id === selectedTestPointId) {
                            return { ...tp, ...updatedData };
                        }
                        return tp;
                    });
                    return { ...session, testPoints: updatedTestPoints };
                }
                return session;
            });
            try {
                localStorage.setItem('uncertaintySessions', JSON.stringify(updatedSessions));
            } catch (error) {
                console.error("Failed to save data to localStorage", error);
            }
            return updatedSessions;
        });
    }, [selectedSessionId, selectedTestPointId]);

    const testPointData = useMemo(() => {
        const currentSession = sessions.find(s => s.id === selectedSessionId);
        if (!currentSession || !selectedTestPointId) return null;

        const point = currentSession.testPoints.find(p => p.id === selectedTestPointId);
        if (point) {
            return {
                id: point.id, 
                ...point, 
                testPointInfo: point.parameter ? {
                    parameter: point.parameter,
                    qualifier: point.qualifier,
                } : null
            };
        }
        return null;
    }, [sessions, selectedSessionId, selectedTestPointId]);
    
    const currentTestPoints = useMemo(() => {
        return sessions.find(s => s.id === selectedSessionId)?.testPoints || [];
    }, [sessions, selectedSessionId]);

    return (
        <div className="App">
            <AddTestPointModal 
                isOpen={isAddModalOpen} 
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleSaveTestPoint}
            />

            <div className="content-area uncertainty-analysis-page">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>Uncertainty Analysis</h2>
                    <label className="dark-mode-toggle">
                        <input type="checkbox" checked={isDarkMode} onChange={() => setIsDarkMode(!isDarkMode)} />
                        <span className="slider"></span>
                    </label>
                </div>
                
                <div className="results-workflow-container">
                    <aside className="results-sidebar">
                        <div className="sidebar-header">
                            <h4>Measurement Points</h4>
                            <button className="add-point-button" onClick={() => setIsAddModalOpen(true)} title="Add New Measurement Point">+</button>
                        </div>
                        {currentTestPoints.length === 0 ? (
                             <div className="form-section-warning"><p>No measurement points available. Click the "+" button to begin.</p></div>
                        ) : (
                            <div className="measurement-point-list">
                                {currentTestPoints.map(tp => {
                                    const isSelected = selectedTestPointId === tp.id;
                                    return (
                                        <button
                                            key={tp.id}
                                            onClick={() => setSelectedTestPointId(tp.id)}
                                            className={`measurement-point-item ${isSelected ? 'active' : ''}`}
                                        >
                                            <span className="measurement-point-details">
                                                <span className="point-data">{tp.testpoint ? `${tp.testpoint.step} ${tp.testpoint.ti}` : `N/A`}</span>
                                                <span className="point-main">{tp.parameter ? `${tp.parameter.name}: ${tp.parameter.value}${tp.parameter.unit}` : `Legacy Point`}</span>
                                                <span className="point-qualifier">{tp.qualifier ? `@ ${tp.qualifier.value}${tp.qualifier.unit}`: ''}</span>
                                            </span>
                                            <span 
                                                className="delete-action" 
                                                title="Delete Measurement Point"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteTestPoint(tp.id);
                                                }}
                                            >
                                                ×
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </aside>
                    <main className="results-content">
                        {testPointData ? (
                            <Analysis
                                testPointData={testPointData}
                                onDataSave={handleDataSave}
                                defaultTestPoint={defaultTestPoint}
                            />
                        ) : (
                            <div className="placeholder-content">
                                <h3>Select or Add a Measurement Point</h3>
                                <p>Please select a measurement point from the list or add a new one to begin.</p>
                            </div>
                        )}
                    </main>
                </div>
                
            </div>
        </div>
    );
}

export default App;