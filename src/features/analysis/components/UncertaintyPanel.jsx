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
    faTrashAlt,
    faRulerCombined
} from "@fortawesome/free-solid-svg-icons";

// Sub-components
import UncertaintyBudgetTable from "./UncertaintyBudgetTable";
import PercentageBarGraph from "./ContributionPlot";

// Utils
import {
    getToleranceSummary,
    getToleranceErrorSummary,
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
    // New prop for defining test point via modal
    onDefineTestPoint,
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

    // --- Measurement Point Check ---
    // Check if the measurement point is "Active" (has a value or is derived)
    const hasMeasurementPoint = isDerived || (uutNominal && (uutNominal.value !== undefined && uutNominal.value !== "" && uutNominal.value !== null));

    const handleClearMeasurementPoint = () => {
        if (onInlineUutUpdate) {
            onInlineUutUpdate('nominal', '');
        }
    };

    return (
        <div className="configuration-panel">

            {/* --- TOP SECTION: LISTS + MEASUREMENT DETAILS --- */}
            <div style={{ 
                display: 'flex', 
                gap: '20px', 
                alignItems: 'flex-start', 
                flexWrap: 'nowrap', 
                width: '100%', 
                overflowX: 'auto',      // Allows scrolling if tables are too wide
                paddingBottom: '20px'   // Space for scrollbar
            }}>

                {/* --- LEFT PANEL: UUT & TMDE LISTS --- */}
                <div style={{ 
                    flex: '1 0 auto',   // Grow: Yes, Shrink: NO (prevent overlapping), Basis: Auto
                    display: 'flex', 
                    flexDirection: 'column'
                }}>

                    {/* --- SECTION 1: UUT INFORMATION --- */}
                    <div>
                        <h3 style={sectionTitleStyle}>Unit Under Test</h3>
                        <div style={cardStyle}>
                            <div className="instrument-table-container" style={{ margin: 0, border: 'none', boxShadow: 'none', borderRadius: '8px' }}>
                                <table className="instrument-summary-table" style={{width: '100%'}}>
                                    <colgroup>
                                        <col style={{width: '35%'}} />
                                        <col style={{width: '25%'}} />
                                        <col style={{width: '25%'}} />
                                        <col style={{width: '15%'}} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th style={{ paddingLeft: '20px' }}>Description</th>
                                            {/* Removed Measurement Point Column from UUT Table on Left */}
                                            <th>Tolerance Spec</th>
                                            <th>Limits</th>
                                            <th style={{ textAlign: 'center', paddingRight: '20px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            {/* Added whiteSpace: 'nowrap' to prevent description wrapping */}
                                            <td style={{ paddingLeft: '20px', whiteSpace: 'nowrap' }}>
                                                <EditableCell
                                                    value={sessionData.uutDescription || ""}
                                                    onSave={(val) => onInlineUutUpdate && onInlineUutUpdate('description', val)}
                                                    style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-color)' }}
                                                    placeholder="Enter UUT Name..."
                                                />
                                            </td>
                                            <td
                                                className="clickable-spec-cell"
                                                onClick={onOpenUutModal}
                                                title="Edit UUT Specifications"
                                                style={{ whiteSpace: 'nowrap' }} 
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
                                            <td style={{ whiteSpace: 'nowrap' }}>
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
                                <table className="instrument-summary-table" style={{width: '100%'}}>
                                     {/* Define col widths for TMDE table to prevent jumping */}
                                     <colgroup>
                                        <col style={{width: '25%'}} />
                                        {isDerived && <col style={{width: '10%'}} />}
                                        <col style={{width: '15%'}} />
                                        <col style={{width: '15%'}} />
                                        <col style={{width: '15%'}} />
                                        <col style={{width: '15%'}} />
                                        <col style={{width: '5%'}} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th style={{ paddingLeft: '20px' }}>Description</th>
                                            {isDerived && <th>Input Var</th>}
                                            <th>Measurement Point</th>
                                            <th>Tolerance Spec</th>
                                            <th>Std. Unc (k=1)</th>
                                            <th>Limits</th>
                                            <th style={{ textAlign: 'center', paddingRight: '20px' }}>
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
                                                <td colSpan={isDerived ? "7" : "6"} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-color-muted)', fontStyle: 'italic' }}>
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
                                                            </td>
                                                            {isDerived && (
                                                                <td>
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
                                                                            cursor: 'pointer',
                                                                            width: '100%'
                                                                        }}
                                                                    >
                                                                        <option value="" disabled>--</option>
                                                                        {availableVariables.map(v => (
                                                                            <option key={v} value={v}>{v}</option>
                                                                        ))}
                                                                    </select>
                                                                </td>
                                                            )}
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
                </div>

                {/* --- RIGHT PANEL: MEASUREMENT POINT SECTION --- */}
                <div style={{ 
                    flex: '0 0 350px', 
                    display: 'flex', 
                    flexDirection: 'column',
                    position: 'sticky', // Stick to the right edge
                    right: 0,
                    zIndex: 10, // Ensure it sits above table content if they overlap slightly during transition
                    backgroundColor: 'var(--content-color)' // Prevent transparent background showing content behind
                }}>
                     <h3 style={sectionTitleStyle}>Measurement Point</h3>
                     <div style={cardStyle}>
                        <div className="instrument-table-container" style={{ margin: 0, border: 'none', boxShadow: 'none', borderRadius: '8px' }}>
                             <table className="instrument-summary-table" style={{width: '100%', tableLayout: 'fixed'}}>
                                 <colgroup>
                                     <col style={{width: '35%'}} />
                                     <col style={{width: '35%'}} />
                                     <col style={{width: '15%'}} />
                                     <col style={{width: '15%'}} />
                                 </colgroup>
                                 <thead>
                                     <tr>
                                         <th style={{ paddingLeft: '20px' }}>Point</th>
                                         <th>Tolerance</th>
                                         <th>Unit</th>
                                         <th style={{ textAlign: 'center', paddingRight: '20px' }}>
                                             {/* UPDATED: Add Button Moved Here & ALWAYS VISIBLE */}
                                             <span
                                                onClick={onDefineTestPoint}
                                                className="action-icon"
                                                title="Add/Edit Measurement Point"
                                                style={{
                                                    cursor: "pointer",
                                                    color: "var(--text-color-muted)",
                                                    display: "flex",
                                                    justifyContent: "center",
                                                    alignItems: "center",
                                                    transition: "color 0.2s ease",
                                                    fontSize: '0.95rem',
                                                    float: 'right'
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
                                     {hasMeasurementPoint ? (
                                         <tr>
                                             <td style={{ paddingLeft: '20px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                 <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--primary-color)' }}>
                                                    {isDerived ? (
                                                        <span>{calcResults?.calculatedNominalValue?.toPrecision(5) ?? "-"}</span>
                                                    ) : (
                                                        <EditableCell
                                                            value={uutNominal?.value}
                                                            onSave={(val) => onInlineUutUpdate && onInlineUutUpdate('nominal', val)}
                                                            type="number"
                                                            placeholder="0.00"
                                                        />
                                                    )}
                                                 </div>
                                             </td>
                                             <td 
                                                 className="clickable-spec-cell"
                                                 onClick={onOpenUutModal}
                                                 title="Edit Tolerance Spec"
                                             >
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {getToleranceErrorSummary(uutToleranceData, uutNominal) || "± 0"}
                                                    </span>
                                                    <FontAwesomeIcon icon={faPencilAlt} className="edit-icon-hover" style={{ fontSize: '0.8rem', marginLeft: '5px' }} />
                                                </div>
                                             </td>
                                             <td>
                                                 <div style={{ fontWeight: 600 }}>
                                                    <EditableCell
                                                        value={uutNominal?.unit}
                                                        onSave={(val) => onInlineUutUpdate && onInlineUutUpdate('unit', val)}
                                                        placeholder="Unit"
                                                    />
                                                 </div>
                                             </td>
                                             <td className="action-cell" style={{ paddingRight: '20px' }}>
                                                 <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                     <span
                                                         className="action-icon"
                                                         onClick={handleClearMeasurementPoint}
                                                         title="Remove Measurement Point"
                                                         style={{
                                                             cursor: "pointer",
                                                             color: "var(--status-bad)",
                                                             fontSize: '0.9rem',
                                                             transition: 'color 0.2s'
                                                         }}
                                                     >
                                                         <FontAwesomeIcon icon={faTrashAlt} />
                                                     </span>
                                                 </div>
                                             </td>
                                         </tr>
                                     ) : (
                                         <tr>
                                             <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-color-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                                                 Click <strong>+</strong> in header to add point.
                                             </td>
                                         </tr>
                                     )}
                                 </tbody>
                             </table>
                        </div>
                     </div>
                </div>

            </div>
            {/* --- END TOP SECTION --- */}


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