/**
 * * The main container for the "Uncertainty Analysis" tab.
 * * Responsibilities:
 * - Renders the visual Instrument Table for UUT and TMDEs.
 * - Renders the Uncertainty Budget Table.
 * - Renders the Contribution Bar Graph.
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import * as math from 'mathjs'; 
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faPlus,
    faPencilAlt,
    faTrashAlt,
    faCalculator,
    faLink,
    faExclamationTriangle,
    faTimes,
    faUnlink
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

// --- HELPERS FOR EQUATION EDITOR ---
const SymbolButton = ({ onSymbolClick, symbol, title }) => (
    <button
        type="button"
        className="symbol-button"
        title={title || `Insert ${symbol}`}
        onClick={() => onSymbolClick(symbol)}
        onMouseDown={(e) => e.preventDefault()} 
    >
        {symbol.replace('()', '( )')}
    </button>
);

const symbolCategories = {
    'Operators': [
        { symbol: '+', title: 'Add' },
        { symbol: '-', title: 'Subtract' },
        { symbol: '*', title: 'Multiply' },
        { symbol: '/', title: 'Divide' },
        { symbol: '^', title: 'Power' },
        { symbol: '()', title: 'Parentheses' },
        { symbol: '%', title: 'Percent' },
    ],
    'Functions': [
        { symbol: 'sqrt()', title: 'Square Root' },
        { symbol: 'abs()', title: 'Absolute Value' },
        { symbol: 'log()', title: 'Log (base 10)' },
        { symbol: 'ln()', title: 'Natural Log' },
        { symbol: 'exp()', title: 'Exponential' },
    ],
    'Trigonometry': [
        { symbol: 'sin()', title: 'Sine' },
        { symbol: 'cos()', title: 'Cosine' },
        { symbol: 'tan()', title: 'Tangent' },
    ],
    'Greek': [
        { symbol: 'Δ', title: 'Delta' },
        { symbol: 'θ', title: 'Theta' },
        { symbol: 'λ', title: 'Lambda' },
        { symbol: 'π', title: 'Pi' },
        { symbol: 'Ω', title: 'Omega' },
    ]
};

const EditableCell = ({ value, onSave, type = "text", suffix = "", style = {}, placeholder = "", className = "" }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);

    useEffect(() => { setCurrentValue(value); }, [value]);

    const handleBlur = () => {
        setIsEditing(false);
        // Trim strings to prevent whitespace mismatch bugs
        const cleanVal = typeof currentValue === 'string' ? currentValue.trim() : currentValue;
        if (cleanVal != value) {
            onSave(cleanVal);
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
                className={className}
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
            className={`editable-cell-display ${className}`}
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
    onUpdateTestPoint, 
    riskResults,
    setNotification
}) => {

    const [isSymbolMenuOpen, setIsSymbolMenuOpen] = useState(false);
    const equationInputRef = useRef(null);
    const symbolMenuRef = useRef(null);
    const symbolButtonRef = useRef(null);

    // Close symbol menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (symbolMenuRef.current && !symbolMenuRef.current.contains(event.target) &&
                symbolButtonRef.current && !symbolButtonRef.current.contains(event.target)) {
                setIsSymbolMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const isUutDefined = (sessionData.uutDescription && sessionData.uutDescription.trim() !== "") ||
        (uutToleranceData && Object.keys(uutToleranceData).length > 0);

    const isDerived = testPointData.measurementType === "derived";

    // --- Available Variables for Dropdown (Fixed) ---
    const availableVariables = useMemo(() => {
        if (!isDerived) return [];
        if (testPointData.variableMappings && Object.values(testPointData.variableMappings).length > 0) {
            // Unique, non-empty, trimmed values only
            const vars = Object.values(testPointData.variableMappings)
                .map(v => v ? v.trim() : "")
                .filter(v => v !== "");
            return [...new Set(vars)];
        }
        return [];
    }, [testPointData, isDerived]);

    // --- Equation Logic ---
    const handleEquationChange = (newEquationString) => {
        let variables = [];
        try {
            if (newEquationString && newEquationString.trim()) {
                let expressionToParse = newEquationString.trim(); 
                const equalsIndex = expressionToParse.indexOf('=');
                if (equalsIndex !== -1) {
                    expressionToParse = expressionToParse.substring(equalsIndex + 1).trim();
                }

                const node = math.parse(expressionToParse);
                const varsSet = new Set();
                node.traverse(function (node, path, parent) {
                    if (node.isSymbolNode && !math[node.name] && !['e', 'pi', 'i'].includes(node.name.toLowerCase())) {
                        varsSet.add(node.name);
                    }
                });
                variables = Array.from(varsSet).sort();
            }
        } catch (e) {
            // Fail silently on incomplete equations
        }

        const currentMappings = testPointData.variableMappings || {};
        const newMappings = {};
        
        variables.forEach(v => {
            newMappings[v] = currentMappings[v] || ""; 
        });

        if (onUpdateTestPoint) {
            onUpdateTestPoint({
                equationString: newEquationString,
                variableMappings: newMappings
            });
        }
    };

    const handleSymbolClick = (symbol) => {
        const input = equationInputRef.current;
        if (!input) return;

        const start = input.selectionStart;
        const end = input.selectionEnd;
        const currentValue = input.value;
        const selectedText = currentValue.substring(start, end);

        let newValue;
        let newCursorPos;

        const isFunction = symbol.endsWith('()');

        if (isFunction) {
            const funcName = symbol.slice(0, -2);
            const textToInsert = `${funcName}(${selectedText})`;
            newValue = currentValue.substring(0, start) + textToInsert + currentValue.substring(end);
            newCursorPos = start + (selectedText ? textToInsert.length + 1 : funcName.length + 1);
        } else {
            newValue = currentValue.substring(0, start) + symbol + currentValue.substring(end);
            newCursorPos = start + symbol.length;
        }

        handleEquationChange(newValue);

        setTimeout(() => {
            if (input) {
                input.focus();
                input.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 0);
    };

    const handleVariableMappingChange = (symbol, newName) => {
        // Trim input to ensure exact matches with TMDE dropdowns
        const cleanedName = newName ? newName.trim() : "";
        const newMappings = { ...testPointData.variableMappings, [symbol]: cleanedName };
        if (onUpdateTestPoint) {
            onUpdateTestPoint({ variableMappings: newMappings });
        }
    };

    // --- NEW: Assign TMDE to Variable Handler (FIXED) ---
    const handleAssignTmdeToVariable = (symbol, tmdeIdStr) => {
        // 1. Ensure variable has a name mapping
        const varName = testPointData.variableMappings?.[symbol] || "";
        if (!varName) {
             // In a real app, maybe show a toast warning "Please name the variable first"
             return; 
        }

        // Case A: Unassigning (User selected "Manual Entry")
        if (!tmdeIdStr) {
             const currentAssigned = tmdeTolerancesData.find(t => t.variableType === varName);
             if (currentAssigned && onInlineTmdeUpdate) {
                  onInlineTmdeUpdate(currentAssigned.id, 'variableType', "");
             }
             return;
        }

        // Case B: Assigning a new Source (TMDE)
        
        // 1. Find the TMDE object loosely (handling string vs number match)
        const targetTmde = tmdeTolerancesData.find(t => t.id == tmdeIdStr);
        if (!targetTmde) return; // Should not happen given the dropdown options
        
        // Use the REAL id from the object (likely a number)
        const realTmdeId = targetTmde.id;

        // 2. Find if any other TMDE is currently holding this variable name
        const previousHolder = tmdeTolerancesData.find(t => t.variableType === varName);
        
        // If the same TMDE is already assigned, do nothing
        if (previousHolder && previousHolder.id === realTmdeId) return;

        // 3. If another TMDE holds it, clear that assignment first (enforce 1:1)
        if (previousHolder && onInlineTmdeUpdate) {
            onInlineTmdeUpdate(previousHolder.id, 'variableType', "");
        }

        // 4. Assign the variable name to the new TMDE
        if (onInlineTmdeUpdate) {
            onInlineTmdeUpdate(realTmdeId, 'variableType', varName);
        }
    };

    // --- Equation Display Data ---
    const equationDisplayData = useMemo(() => {
        if (!isDerived) return null;

        const currentMappings = testPointData.variableMappings || {};
        const vars = Object.keys(currentMappings).sort().map((symbol) => {
            const name = currentMappings[symbol];
            
            // Strict matching: Name must match TMDE variableType exactly
            const assignedTmde = tmdeTolerancesData.find(t => 
                t.variableType && name && t.variableType.trim() === name.trim()
            );
            
            return {
                symbol,
                name,
                isAssigned: !!assignedTmde,
                value: assignedTmde?.measurementPoint?.value,
                unit: assignedTmde?.measurementPoint?.unit,
                instrumentName: assignedTmde?.name,
                tmdeId: assignedTmde?.id 
            };
        });

        return {
            equation: testPointData.equationString || "",
            variables: vars
        };
    }, [isDerived, testPointData, tmdeTolerancesData]);


    const tmdeTitle = tmdeTolerancesData.length > 1
        ? "Test Measurement Equipment Devices"
        : "Test Measurement Equipment Device";

    // Original Styles
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
                flexWrap: 'wrap', 
                width: '100%', 
                paddingBottom: '20px'   
            }}>

                {/* --- LEFT PANEL: UUT & TMDE LISTS --- */}
                <div style={{ 
                    flex: '1 1 600px', 
                    minWidth: 0,
                    display: 'flex', 
                    flexDirection: 'column'
                }}>

                    {/* --- SECTION 1: UUT INFORMATION --- */}
                    <div>
                        <h3 style={sectionTitleStyle}>Unit Under Test</h3>
                        <div style={cardStyle}>
                            <div className="instrument-table-container" style={{ margin: 0, border: 'none', boxShadow: 'none', borderRadius: '8px', overflowX: 'auto' }}>
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
                                            <th>Tolerance Spec</th>
                                            <th>Limits</th>
                                            <th style={{ textAlign: 'center', paddingRight: '20px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
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

                    {/* --- SECTION 1.5: MODERN MEASUREMENT EQUATION (Derived Only) --- */}
                    {isDerived && equationDisplayData && (
                        <div className="equation-section-container">
                            <h3 style={sectionTitleStyle}>Measurement Equation</h3>
                            
                            {/* Hero Input */}
                            <div className="equation-hero-container">
                                <div className="equation-hero-input-wrapper">
                                    <input
                                        ref={equationInputRef}
                                        type="text"
                                        className="equation-hero-input"
                                        value={equationDisplayData.equation}
                                        onChange={(e) => handleEquationChange(e.target.value)}
                                        placeholder="e.g. V / R"
                                    />
                                    <button 
                                        ref={symbolButtonRef}
                                        className={`equation-tools-trigger ${isSymbolMenuOpen ? 'active' : ''}`}
                                        onClick={() => setIsSymbolMenuOpen(!isSymbolMenuOpen)}
                                        title="Math Symbols"
                                    >
                                        <FontAwesomeIcon icon={faCalculator} />
                                    </button>

                                    {/* Symbols Popout */}
                                    {isSymbolMenuOpen && (
                                        <div className="symbol-popout" ref={symbolMenuRef}>
                                             <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '5px', borderBottom: '1px solid var(--border-color)'}}>
                                                 <span style={{fontWeight: 700, fontSize: '0.85rem'}}>Math Symbols</span>
                                                 <span onClick={() => setIsSymbolMenuOpen(false)} style={{cursor: 'pointer'}}><FontAwesomeIcon icon={faTimes} /></span>
                                             </div>
                                            {Object.entries(symbolCategories).map(([category, symbols]) => (
                                                <div key={category} className="symbol-category">
                                                    <h5 className="symbol-category-title">{category}</h5>
                                                    <div className="symbol-category-grid">
                                                        {symbols.map(s => (
                                                            <SymbolButton 
                                                                key={s.symbol} 
                                                                symbol={s.symbol} 
                                                                title={s.title} 
                                                                onSymbolClick={handleSymbolClick} 
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* Modern Variable Grid */}
                            <div className="var-map-grid">
                                {equationDisplayData.variables.length === 0 ? (
                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-color-muted)', padding: '20px', background: 'var(--background-color)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                                        Start typing an equation to map variables (e.g., A + B).
                                    </div>
                                ) : (
                                    equationDisplayData.variables.map((v) => (
                                        <div key={v.symbol} className={`var-card-modern ${v.isAssigned ? 'assigned' : 'unassigned'}`}>
                                            {/* Card Header: Symbol & Name */}
                                            <div className="var-card-header">
                                                <div className="var-symbol-badge">{v.symbol}</div>
                                                <input 
                                                    type="text" 
                                                    className="var-name-input"
                                                    value={v.name}
                                                    placeholder="Map to (e.g. Volts)..."
                                                    onChange={(e) => handleVariableMappingChange(v.symbol, e.target.value)}
                                                />
                                            </div>

                                            {/* Card Body: Assignment & Values */}
                                            <div className="var-card-body">
                                                {/* Source Selector */}
                                                <div>
                                                    <label style={{display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-color-muted)', marginBottom: '5px'}}>
                                                        ASSIGNED SOURCE
                                                    </label>
                                                    <select 
                                                        className="var-source-select"
                                                        value={v.tmdeId || ""}
                                                        onChange={(e) => handleAssignTmdeToVariable(v.symbol, e.target.value)}
                                                        disabled={!v.name} /* Cannot assign if variable not named */
                                                    >
                                                        <option value="">-- No Source (Manual Entry) --</option>
                                                        {tmdeTolerancesData.map(tmde => (
                                                            <option key={tmde.id} value={tmde.id}>
                                                                {tmde.name || "Unnamed TMDE"} 
                                                                {tmde.measurementPoint?.value ? ` (${tmde.measurementPoint.value} ${tmde.measurementPoint.unit})` : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Value Display or Manual Input */}
                                                <div>
                                                    <label style={{display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-color-muted)', marginBottom: '5px'}}>
                                                        VALUE
                                                    </label>
                                                    {v.isAssigned ? (
                                                        <div className="var-value-display">
                                                            <EditableCell
                                                                value={v.value}
                                                                type="number"
                                                                onSave={(val) => onInlineTmdeUpdate && onInlineTmdeUpdate(v.tmdeId, 'nominal', val)}
                                                                style={{ 
                                                                    fontFamily: "'Consolas', monospace",
                                                                    fontSize: "1.1rem",
                                                                    fontWeight: 700,
                                                                    color: "var(--primary-color)",
                                                                    backgroundColor: "transparent", 
                                                                    border: "none",
                                                                    padding: 0,
                                                                    width: "100px" // Allows room for typing
                                                                }}
                                                            />
                                                            <span className="var-unit">{v.unit}</span>
                                                        </div>
                                                    ) : (
                                                        /* If Manual Entry (Unassigned), allow typing directly if we wanted to support it, 
                                                           but currently manual entries are placeholders in this view. 
                                                           We will show a 'Manual' placeholder or empty state. */
                                                        <div className="var-value-display" style={{backgroundColor: 'var(--input-background)'}}>
                                                            <span style={{color: 'var(--text-color-muted)', fontSize: '0.9rem', fontStyle: 'italic'}}>
                                                                <FontAwesomeIcon icon={faExclamationTriangle} style={{color: 'var(--status-warning)', marginRight: '6px'}}/>
                                                                Map source above
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- SECTION 2: TMDE LIST --- */}
                    <div>
                        <h3 style={sectionTitleStyle}>{tmdeTitle}</h3>
                        <div style={cardStyle}>
                            <div className="instrument-table-container" style={{ margin: 0, border: 'none', boxShadow: 'none', borderRadius: '8px', overflowX: 'auto' }}>
                                <table className="instrument-summary-table" style={{width: '100%'}}>
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
                                                                        value={availableVariables.includes(tmde.variableType) ? tmde.variableType : ""}
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
                    flex: '1 1 350px', 
                    minWidth: '300px',
                    display: 'flex', 
                    flexDirection: 'column',
                    backgroundColor: 'var(--content-color)' 
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