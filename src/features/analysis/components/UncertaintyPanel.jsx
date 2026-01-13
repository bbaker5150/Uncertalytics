/**
 * * The main container for the "Uncertainty Analysis" tab.
 * * Responsibilities:
 * - Renders the visual Instrument Table for UUT and TMDEs.
 * - Renders the Uncertainty Budget Table.
 * - Renders the Contribution Bar Graph.
 */

import React, { useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faPlus,
    faPencilAlt,
    faTrashAlt
} from "@fortawesome/free-solid-svg-icons";

// Sub-components
import UncertaintyBudgetTable from "./UncertaintyBudgetTable";
import PercentageBarGraph from "./ContributionPlot";

// Utils
import {
    getToleranceSummary,
    getAbsoluteLimits,
    calculateUncertaintyFromToleranceObject,
    convertPpmToUnit,
} from "../../../utils/uncertaintyMath";

const EditableCell = ({ value, onSave, type = "text", suffix = "", style = {}, placeholder = "" }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);

    useEffect(() => { setCurrentValue(value); }, [value]);

    const handleBlur = () => {
        setIsEditing(false);
        if (currentValue != value) {
            onSave(currentValue);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleBlur();
        }
    };

    if (isEditing) {
        return (
            <input
                autoFocus
                type={type}
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                style={{ width: '100%', padding: '4px', boxSizing: 'border-box', ...style }}
            />
        )
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            style={{
                cursor: 'text',
                minHeight: '20px',
                borderBottom: '1px dashed var(--border-color)',
                paddingBottom: '2px',
                color: !value && placeholder ? 'var(--text-color-muted)' : 'inherit',
                ...style
            }}
            className="editable-cell-display"
            title="Click to edit"
        >
            {value || placeholder} {suffix}
        </div>
    )
};

const UncertaintyPanel = ({
    testPointData,
    sessionData,
    calcResults,
    calculationError,
    uutNominal,
    uutToleranceData,
    tmdeTolerancesData,
    // Handlers
    onAddManualComponent,
    onEditManualComponent,
    onRemoveComponent,
    onAddTmde,
    onEditTmde,
    onDeleteTmdeDefinition,
    onDecrementTmdeQuantity,
    onOpenUutModal,
    onDeleteUut,
    onInlineUutUpdate,
    onInlineTmdeUpdate,
    onBudgetRowContextMenu,
    onShowDerivedBreakdown,
    onShowRiskBreakdown,
    showContribution,
    setShowContribution,
    onOpenRepeatability,
    riskResults,
    setNotification
}) => {

    // Determine if UUT is defined (has a description or specs)
    const isUutDefined = (sessionData.uutDescription && sessionData.uutDescription.trim() !== "") ||
        (uutToleranceData && Object.keys(uutToleranceData).length > 0);

    // --- Derived Variable Logic ---
    const isDerived = testPointData.measurementType === "derived";

    // Get available variables from mapping (e.g., A, B, C) or fallback
    const availableVariables = useMemo(() => {
        if (!isDerived) return [];
        if (testPointData.variableMappings && Object.values(testPointData.variableMappings).length > 0) {
            return Object.values(testPointData.variableMappings);
        }
        return ["A", "B", "C", "D", "E"];
    }, [testPointData, isDerived]);

    // Determine TMDE Title Pluralization
    const tmdeTitle = tmdeTolerancesData.length > 1
        ? "Test Measurement Equipment Devices"
        : "Test Measurement Equipment Device";

    // Common styles
    const cardStyle = {
        backgroundColor: 'var(--content-background)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        marginBottom: '30px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.02)'
    };

    const sectionTitleStyle = {
        margin: '0 0 10px 0',
        fontSize: '1.1rem',
        fontWeight: 700,
        color: 'var(--text-color)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
    };

    return (
        <div className="configuration-panel">

            {/* --- SECTION 1: UUT INFORMATION --- */}
            <div>
                <h3 style={sectionTitleStyle}>Unit Under Test</h3>
                <div style={cardStyle}>
                    <div className="instrument-table-container" style={{ margin: 0, border: 'none', boxShadow: 'none', borderRadius: '8px' }}>
                        <table className="instrument-summary-table">
                            <thead>
                                <tr>
                                    <th style={{ paddingLeft: '20px' }}>Description</th>
                                    <th>Measurement Point</th>
                                    <th>Tolerance Spec</th>
                                    <th>Limits</th>
                                    <th style={{ width: '80px', textAlign: 'center', paddingRight: '20px' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={{ paddingLeft: '20px' }}>
                                        <EditableCell
                                            value={sessionData.uutDescription || ""}
                                            onSave={(val) => onInlineUutUpdate && onInlineUutUpdate('description', val)}
                                            style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-color)' }}
                                            placeholder="Enter UUT Name..."
                                        />
                                    </td>
                                    <td>
                                        {isDerived ? (
                                            <div style={{ padding: '2px 0', borderBottom: '1px dashed transparent' }}>
                                                Derived: {calcResults?.calculatedNominalValue?.toPrecision(5) ?? "N/A"} {uutNominal?.unit}
                                            </div>
                                        ) : (
                                            <EditableCell
                                                value={uutNominal?.value}
                                                suffix={uutNominal?.unit}
                                                onSave={(val) => onInlineUutUpdate && onInlineUutUpdate('nominal', val)}
                                                type="number"
                                                placeholder="0.00"
                                            />
                                        )}
                                    </td>
                                    <td
                                        className="clickable-spec-cell"
                                        onClick={onOpenUutModal}
                                        title="Edit UUT Specifications"
                                    >
                                        {isUutDefined ? (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span>{getToleranceSummary(uutToleranceData)}</span>
                                                <FontAwesomeIcon icon={faPencilAlt} className="edit-icon-hover" style={{ fontSize: '0.8rem' }} />
                                            </div>
                                        ) : (
                                            <span style={{ color: 'var(--primary-color)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                                                + Define Spec
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        {isUutDefined && uutNominal ? (
                                            <div className="limits-cell">
                                                <span className="limit-val">{getAbsoluteLimits(uutToleranceData, uutNominal).low}</span>
                                                <span className="limit-sep" style={{ margin: '0 8px' }}>to</span>
                                                <span className="limit-val">{getAbsoluteLimits(uutToleranceData, uutNominal).high}</span>
                                            </div>
                                        ) : <span style={{ color: 'var(--text-color-muted)' }}>-</span>}
                                    </td>
                                    <td className="action-cell" style={{ paddingRight: '20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                            {isUutDefined && (
                                                <span
                                                    className="action-icon"
                                                    onClick={onDeleteUut}
                                                    title="Delete UUT Info"
                                                    style={{
                                                        cursor: "pointer",
                                                        color: "var(--status-bad)",
                                                        fontSize: '0.9rem',
                                                        transition: 'color 0.2s'
                                                    }}
                                                >
                                                    <FontAwesomeIcon icon={faTrashAlt} />
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* --- SECTION 2: TMDE LIST --- */}
            <div>
                <h3 style={sectionTitleStyle}>{tmdeTitle}</h3>
                <div style={cardStyle}>
                    <div className="instrument-table-container" style={{ margin: 0, border: 'none', boxShadow: 'none', borderRadius: '8px' }}>
                        <table className="instrument-summary-table">
                            <thead>
                                <tr>
                                    <th style={{ paddingLeft: '20px' }}>Description</th>
                                    <th>Measurement Point</th>
                                    <th>Tolerance Spec</th>
                                    <th>Std. Unc (k=1)</th>
                                    <th>Limits</th>
                                    <th style={{ width: '80px', textAlign: 'center', paddingRight: '20px' }}>
                                        {/* Add TMDE Button */}
                                        <span
                                            onClick={onAddTmde}
                                            className="action-icon"
                                            title="Add New TMDE"
                                            style={{
                                                cursor: "pointer",
                                                color: "var(--text-color-muted)",
                                                display: "flex",
                                                justifyContent: "center",
                                                alignItems: "center",
                                                transition: "color 0.2s ease",
                                                fontSize: '0.95rem'
                                            }}
                                            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--primary-color)")}
                                            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-color-muted)")}
                                        >
                                            <FontAwesomeIcon icon={faPlus} />
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {tmdeTolerancesData.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-color-muted)', fontStyle: 'italic' }}>
                                            No TMDEs configured. Click the <strong>+</strong> icon above to add standards.
                                        </td>
                                    </tr>
                                ) : (
                                    tmdeTolerancesData.map((tmde, index) => {
                                        const quantity = tmde.quantity || 1;
                                        return Array.from({ length: quantity }).map((_, i) => {
                                            const referencePoint = tmde.measurementPoint;
                                            const isError = !referencePoint?.value || !referencePoint?.unit;
                                            const key = `${tmde.id}-${i}`;

                                            // Calculate Std Unc for display
                                            let stdUncDisplay = "-";
                                            if (!isError) {
                                                const { standardUncertainty: uPpm } = calculateUncertaintyFromToleranceObject(tmde, referencePoint);
                                                const uAbs = convertPpmToUnit(uPpm, referencePoint.unit, referencePoint);
                                                stdUncDisplay = typeof uAbs === "number" ? `${uAbs.toPrecision(3)}` : uAbs;
                                            }

                                            return (
                                                <tr key={key} className="tmde-row">
                                                    <td style={{ paddingLeft: '20px' }}>
                                                        <div style={{ fontWeight: 600, color: 'var(--text-color)' }}>
                                                            <EditableCell
                                                                value={tmde.name || "Unknown TMDE"}
                                                                onSave={(val) => onInlineTmdeUpdate && onInlineTmdeUpdate(tmde.id, 'name', val)}
                                                                suffix={quantity > 1 ? ` #${i + 1}` : ""}
                                                            />
                                                        </div>

                                                        {/* Derived Variable Mapping - DROPDOWN */}
                                                        {isDerived && (
                                                            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-color-muted)', marginRight: '8px', textTransform: 'uppercase', fontWeight: 700 }}>
                                                                    Input Var:
                                                                </span>
                                                                <select
                                                                    value={tmde.variableType || ""}
                                                                    onChange={(e) => onInlineTmdeUpdate && onInlineTmdeUpdate(tmde.id, 'variableType', e.target.value)}
                                                                    style={{
                                                                        fontSize: '0.8rem',
                                                                        padding: '2px 6px',
                                                                        borderRadius: '4px',
                                                                        border: '1px solid var(--border-color)',
                                                                        backgroundColor: 'var(--input-background)',
                                                                        color: 'var(--primary-color)',
                                                                        fontWeight: 600,
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    <option value="" disabled>--</option>
                                                                    {availableVariables.map(v => (
                                                                        <option key={v} value={v}>{v}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {isError ? (
                                                            <span className="status-bad" style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Missing Ref</span>
                                                        ) : (
                                                            <EditableCell
                                                                value={referencePoint.value}
                                                                suffix={referencePoint.unit}
                                                                onSave={(val) => onInlineTmdeUpdate && onInlineTmdeUpdate(tmde.id, 'nominal', val)}
                                                                type="number"
                                                            />
                                                        )}
                                                    </td>
                                                    <td
                                                        className="clickable-spec-cell"
                                                        onClick={() => onEditTmde(tmde)}
                                                        title="Edit TMDE Specifications"
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <span>{getToleranceSummary(tmde)}</span>
                                                            <FontAwesomeIcon icon={faPencilAlt} className="edit-icon-hover" />
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {stdUncDisplay} <span style={{ fontSize: '0.8rem', color: 'var(--text-color-muted)' }}>{!isError ? referencePoint.unit : ''}</span>
                                                    </td>
                                                    <td>
                                                        {!isError ? (
                                                            <div className="limits-cell">
                                                                <span className="limit-val">{getAbsoluteLimits(tmde, referencePoint).low}</span>
                                                                <span className="limit-sep">to</span>
                                                                <span className="limit-val">{getAbsoluteLimits(tmde, referencePoint).high}</span>
                                                            </div>
                                                        ) : "-"}
                                                    </td>
                                                    <td className="action-cell" style={{ paddingRight: '20px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                            {quantity > 1 ? (
                                                                <span
                                                                    className="action-icon"
                                                                    onClick={() => onDecrementTmdeQuantity(tmde.id)}
                                                                    title="Remove this instance"
                                                                    style={{ cursor: "pointer", color: "var(--status-bad)", fontSize: '0.9rem' }}
                                                                >
                                                                    <FontAwesomeIcon icon={faTrashAlt} />
                                                                </span>
                                                            ) : (
                                                                <span
                                                                    className="action-icon"
                                                                    onClick={() => onDeleteTmdeDefinition(tmde.id)}
                                                                    title="Remove TMDE"
                                                                    style={{ cursor: "pointer", color: "var(--status-bad)", fontSize: '0.9rem' }}
                                                                >
                                                                    <FontAwesomeIcon icon={faTrashAlt} />
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* --- UNCERTAINTY BUDGET & GRAPH --- */}
            {calculationError ? (
                <div className="form-section-warning">
                    <p>Calculation Error: {calculationError}</p>
                    <p style={{ marginTop: "5px", fontSize: "0.9rem", color: "var(--text-color-muted)" }}>
                        Please ensure all required fields are set (e.g., UUT nominal, equation, and all mapped TMDEs).
                    </p>
                </div>
            ) : (
                <>
                    <UncertaintyBudgetTable
                        components={calcResults?.calculatedBudgetComponents || []}
                        onRemove={onRemoveComponent}
                        calcResults={calcResults}
                        referencePoint={uutNominal}
                        uncertaintyConfidence={sessionData.uncReq.uncertaintyConfidence}
                        onRowContextMenu={onBudgetRowContextMenu}
                        equationString={testPointData.equationString}
                        measurementType={testPointData.measurementType}
                        riskResults={riskResults}
                        onShowDerivedBreakdown={onShowDerivedBreakdown}
                        onShowRiskBreakdown={onShowRiskBreakdown}
                        showContribution={showContribution}
                        setShowContribution={setShowContribution}
                        hasTmde={tmdeTolerancesData.length > 0}
                        onAddManualComponent={onAddManualComponent}
                        onEdit={onEditManualComponent}
                        onOpenRepeatability={onOpenRepeatability}
                        setNotification={setNotification}
                    />
                    {showContribution && calcResults?.calculatedBudgetComponents?.length > 0 && (
                        <PercentageBarGraph
                            type={testPointData.measurementType === "derived"}
                            unit={uutNominal?.unit || "Units"}
                            data={Object.fromEntries(
                                calcResults.calculatedBudgetComponents.map((item) => {
                                    const value = testPointData.measurementType === "derived"
                                        ? item.contribution || 0
                                        : item.value_native || item.value || 0;
                                    const label = item.name.startsWith("Input: ") ? item.name.substring(7) : item.name;
                                    return [label, value];
                                })
                            )}
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default UncertaintyPanel;