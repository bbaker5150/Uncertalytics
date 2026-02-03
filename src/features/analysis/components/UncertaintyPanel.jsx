/**
 * src/features/analysis/components/UncertaintyPanel.jsx
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import * as math from 'mathjs';
import Select from "react-select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faPlus,
    faTrashAlt,
    faTimes,
    faExclamationTriangle,
    faCheckCircle,
    faTimesCircle,
    faMicroscope,
    faCube,
    faArrowRight,
    faRulerCombined,
    faTools
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
    unitSystem,
    unitCategories
} from "../../../utils/uncertaintyMath";

const handleRowSelection = (e, id, currentSelected, setSelected) => {
    if (e.ctrlKey || e.metaKey) {
        // Toggle selection if modifier key is held
        setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    } else {
        // Single select if simply clicked
        setSelected([id]);
    }
};

// --- HELPER: Decompose Tolerance into Rows (Intuitive Format) ---
const getSpecRows = (tolerance) => {
    if (!tolerance) return ["-"];
    const rows = [];

    // Robust Helper to extract numeric value from object or primitive
    const getVal = (prop) => {
        if (prop === undefined || prop === null) return "";
        if (typeof prop === 'object') {
            if (prop.value !== undefined && prop.value !== null) return prop.value;
            if (prop.pcn !== undefined && prop.pcn !== null) return prop.pcn;
            if (prop.reading !== undefined && prop.reading !== null) return prop.reading;
            if (prop.range !== undefined && prop.range !== null) return prop.range;
            if (prop.floor !== undefined && prop.floor !== null) return prop.floor;
            return "";
        }
        return prop;
    };

    // 1. Explicit sub-components (recursion)
    if (Array.isArray(tolerance.tolerances) && tolerance.tolerances.length > 0) {
        tolerance.tolerances.forEach(t => {
            rows.push(...getSpecRows(t));
        });
        return rows;
    }

    // 2. Standard Components - Intuitive Formatting
    let foundComponent = false;

    // Reading
    if (tolerance.reading !== undefined && tolerance.reading !== null && tolerance.reading !== "") {
        const val = getVal(tolerance.reading);
        if (val !== "") {
            rows.push(`± ${val}% of Reading`);
            foundComponent = true;
        }
    }

    // Range
    if (tolerance.range !== undefined && tolerance.range !== null && tolerance.range !== "") {
        const val = getVal(tolerance.range);
        if (val !== "" && !isNaN(parseFloat(val))) {
            rows.push(`± ${val}% of Range`);
            foundComponent = true;
        }
    }

    // Floor
    if (tolerance.floor !== undefined && tolerance.floor !== null && tolerance.floor !== "") {
        const val = getVal(tolerance.floor);
        if (val !== "") {
            rows.push(`± ${val} ${tolerance.unit || ''} Floor`);
            foundComponent = true;
        }
    }

    // Offset
    if (tolerance.offset !== undefined && tolerance.offset !== null) {
        const val = getVal(tolerance.offset);
        if (val !== "") {
            rows.push(`± ${val} ${tolerance.unit || ''} Offset`);
            foundComponent = true;
        }
    }

    // Linearity
    if (tolerance.linearity !== undefined && tolerance.linearity !== null) {
        const val = getVal(tolerance.linearity);
        if (val !== "") {
            rows.push(`± ${val} ${tolerance.unit || ''} Linearity`);
            foundComponent = true;
        }
    }

    // 3. Fallback
    if (!foundComponent || rows.length === 0) {
        const summary = getToleranceSummary(tolerance);
        return [summary];
    }

    return rows;
};

// --- SHARED HELPER: Resolve UUT Range ---
const resolveUutRangeHelper = (uut, activeRangeIndices, savedTolerance, uutNominal) => {
    // 1. Normalize Ranges
    let allRanges = [];
    if (Array.isArray(uut.ranges) && uut.ranges.length > 0) {
        allRanges = uut.ranges.map(r => ({ ...r, ...(r.tolerances || r.tolerance || {}) }));
    } else if (Array.isArray(uut.instrument?.functions) && uut.instrument.functions.length > 0) {
        allRanges = uut.instrument.functions.flatMap(fn =>
            (fn.ranges || []).map(r => ({
                ...r,
                ...(r.tolerances || {}),
                functionName: fn.name,
                unit: fn.unit || r.unit
            }))
        );
    } else if (Array.isArray(uut.instrument?.ranges) && uut.instrument.ranges.length > 0) {
        allRanges = uut.instrument.ranges.map(r => ({ ...r, ...(r.tolerances || {}) }));
    } else {
        const baseTolerance = uut.tolerance || uut.instrument?.tolerance || {};
        allRanges = [{ id: 'default', range: 'Default', ...baseTolerance }];
    }
    allRanges = allRanges.map((r, i) => ({ ...r, _index: i }));

    // Helper: fit check
    const doesRangeFit = (r) => {
        const val = parseFloat(uutNominal?.value);
        if (isNaN(val)) return false;
        const min = parseFloat(r.min);
        const max = parseFloat(r.max);

        // Check unit
        const unitMatch = !r.unit || !uutNominal?.unit || r.unit.toLowerCase() === uutNominal.unit.toLowerCase();
        if (!unitMatch) return false;

        // Check value bounds
        if (!isNaN(min) && !isNaN(max)) return val >= min && val <= max;

        // If no bounds, assume fit
        return true;
    };

    // 2. Identify Display Ranges
    const userHasValue = uutNominal && !isNaN(parseFloat(uutNominal.value));
    let displayRanges = allRanges;

    // FILTER: Only show ranges that fit the value (if value exists)
    if (userHasValue) {
        const fittingRanges = allRanges.filter(r => doesRangeFit(r));
        if (fittingRanges.length > 0) {
            displayRanges = fittingRanges;
        }
    }

    // 3. Determine Active Index (in displayRanges)
    let activeIndex = -1;

    // Priority A: Manual Selection (UI State)
    if (activeRangeIndices && activeRangeIndices[uut.id] !== undefined) {
        const uiIndex = activeRangeIndices[uut.id];
        if (displayRanges[uiIndex]) {
            activeIndex = uiIndex;
        }
    }

    // Priority B: Saved Tolerance (Robust Match)
    if (activeIndex === -1 && savedTolerance) {
        activeIndex = displayRanges.findIndex(r => {
            // ID Match (Best)
            if (r.id && savedTolerance.id && r.id === savedTolerance.id) return true;

            // Name Match
            if (savedTolerance.range && r.range && savedTolerance.range === r.range) {
                return savedTolerance.functionName ? savedTolerance.functionName === r.functionName : true;
            }

            // Props Match (Fallback)
            const minMatch = r.min == savedTolerance.min;
            const maxMatch = r.max == savedTolerance.max;
            const unitMatch = (r.unit || "") === (savedTolerance.unit || "");
            const funcMatch = r.functionName === savedTolerance.functionName; // strict function name

            // Looser function match if one is missing? No, stay strict.
            return minMatch && maxMatch && unitMatch && (!r.functionName || funcMatch);
        });
    }

    // Priority C: Default (First Item)
    if (activeIndex === -1) {
        activeIndex = 0;
    }

    return { ranges: displayRanges, activeIndex: activeIndex, activeRange: displayRanges[activeIndex] || {} };
};

// --- SHARED HELPER: Calculate Tolerance & Limits (Core Logic) ---
const calculateToleranceMetrics = (activeTolerance, nominalObj) => {
    const nominalVal = parseFloat(nominalObj?.value);

    if (!activeTolerance || Object.keys(activeTolerance).length === 0) {
        return { numericTolerance: null, limits: { low: "-", high: "-" }, display: "No Range / Spec" };
    }

    if (isNaN(nominalVal)) {
        return { numericTolerance: null, limits: { low: "-", high: "-" }, display: "No Value" };
    }

    // 1. Try Meticulous Calculation (Complex Objects: Reading + Floor)
    const getComponentValue = (comp) => {
        if (comp === undefined || comp === null) return 0;
        if (typeof comp === 'object') {
            const valStr = comp.high || comp.value || comp.tolerance;
            const parsed = parseFloat(valStr);
            return isNaN(parsed) ? 0 : parsed;
        }
        const parsed = parseFloat(comp);
        return isNaN(parsed) ? 0 : parsed;
    };

    let total = 0;
    let found = false;

    // Reading
    const readingComp = activeTolerance.reading || activeTolerance.tolerances?.reading;
    if (readingComp) {
        const readingPcn = getComponentValue(readingComp);
        if (readingPcn !== 0) {
            total += Math.abs(nominalVal * (readingPcn / 100));
            found = true;
        }
    }

    // Floor
    const floorComp = activeTolerance.floor || activeTolerance.tolerances?.floor;
    if (floorComp) {
        const floorVal = getComponentValue(floorComp);
        if (floorVal !== 0) {
            total += Math.abs(floorVal);
            found = true;
        }
    }

    // Generic (Single Value)
    if (!found && (activeTolerance.tolerance || activeTolerance.value)) {
        const tolVal = getComponentValue(activeTolerance);
        if (tolVal !== 0) {
            total += Math.abs(tolVal);
            found = true;
        }
    }

    // Range (% of Full Scale) - FIX
    const rangeComp = activeTolerance.range || activeTolerance.tolerances?.range;
    if (rangeComp) {
        const rangePcn = getComponentValue(rangeComp);
        // Use the range's Max as Full Scale (FS)
        const fs = parseFloat(activeTolerance.max);

        if (rangePcn !== 0 && !isNaN(fs)) {
            // Basic % of Range calculation
            total += Math.abs(fs * (rangePcn / 100));
            found = true;
        }
    }

    let numericTolerance = null;

    if (found) {
        numericTolerance = total;
    } else {
        // 2. Fallback: Parse Standard Utility String
        const utilResult = getToleranceErrorSummary(activeTolerance, nominalObj);
        if (utilResult && utilResult !== "Not Calculated" && utilResult !== "± -" && !utilResult.includes("NaN")) {
            const match = utilResult.match(/±\s*([\d.]+)/);
            if (match && match[1]) {
                numericTolerance = parseFloat(match[1]);
            }
        }
    }

    // Format Results
    if (numericTolerance !== null) {
        const low = nominalVal - numericTolerance;
        const high = nominalVal + numericTolerance;
        return {
            numericTolerance,
            limits: { low: low.toPrecision(6), high: high.toPrecision(6) },
            display: `± ${Number(numericTolerance.toPrecision(4))} ${nominalObj?.unit || ""}`
        };
    }

    return { numericTolerance: null, limits: { low: "-", high: "-" }, display: "No Range / Spec" };
};


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
    'Operators': [{ symbol: '+', title: 'Add' }, { symbol: '-', title: 'Subtract' }, { symbol: '*', title: 'Multiply' }, { symbol: '/', title: 'Divide' }, { symbol: '^', title: 'Power' }, { symbol: '()', title: 'Parentheses' }, { symbol: '%', title: 'Percent' }],
    'Functions': [{ symbol: 'sqrt()', title: 'Square Root' }, { symbol: 'abs()', title: 'Absolute Value' }, { symbol: 'log()', title: 'Log (base 10)' }, { symbol: 'ln()', title: 'Natural Log' }, { symbol: 'exp()', title: 'Exponential' }],
    'Trigonometry': [{ symbol: 'sin()', title: 'Sine' }, { symbol: 'cos()', title: 'Cosine' }, { symbol: 'tan()', title: 'Tangent' }],
    'Greek': [{ symbol: 'Δ', title: 'Delta' }, { symbol: 'θ', title: 'Theta' }, { symbol: 'λ', title: 'Lambda' }, { symbol: 'π', title: 'Pi' }, { symbol: 'Ω', title: 'Omega' }]
};

const customUnitSelectStyles = {
    control: (provided) => ({ ...provided, minHeight: '28px', height: '28px', width: '100px', fontSize: '0.8rem', border: 'none', backgroundColor: 'transparent', boxShadow: 'none', cursor: 'pointer', textAlign: 'right' }),
    valueContainer: (provided) => ({ ...provided, height: '28px', padding: '0 4px', justifyContent: 'flex-end' }),
    input: (provided) => ({ ...provided, margin: 0, padding: 0, color: 'var(--text-color)' }),
    singleValue: (provided) => ({ ...provided, color: 'var(--text-color-muted)', fontWeight: 600 }),
    indicatorsContainer: (provided) => ({ ...provided, height: '28px', }),
    dropdownIndicator: (provided) => ({ ...provided, padding: '2px', color: 'var(--text-color-muted)' }),
    indicatorSeparator: () => ({ display: 'none' }),
    menu: (provided) => ({ ...provided, backgroundColor: 'var(--content-background)', border: '1px solid var(--border-color)', zIndex: 9999, width: '180px', right: 0 }),
    groupHeading: (provided) => ({ ...provided, color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', padding: '8px 12px 4px' }),
    option: (provided, state) => ({ ...provided, backgroundColor: state.isSelected ? 'var(--primary-color)' : state.isFocused ? 'var(--hover-background)' : 'transparent', color: state.isSelected ? '#fff' : 'var(--text-color)', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left', paddingLeft: '20px' })
};

const EditableCell = ({ value, onSave, type = "text", suffix = "", style = {}, placeholder = "", className = "" }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);
    useEffect(() => { setCurrentValue(value); }, [value]);
    const handleBlur = () => { setIsEditing(false); const cleanVal = typeof currentValue === 'string' ? currentValue.trim() : currentValue; if (cleanVal != value) { onSave(cleanVal); } };
    const handleKeyDown = (e) => { if (e.key === 'Enter') { handleBlur(); } };
    if (isEditing) { return (<input autoFocus type={type} value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} onBlur={handleBlur} onKeyDown={handleKeyDown} placeholder={placeholder} className={className} style={{ width: '100%', padding: '4px', boxSizing: 'border-box', ...style }} />) }
    return (<div onClick={() => setIsEditing(true)} style={{ cursor: 'text', minHeight: '20px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '2px', color: !value && placeholder ? 'var(--text-color-muted)' : 'inherit', ...style }} className={`editable-cell-display ${className}`} title="Click to edit" > {value || placeholder} {suffix} </div>)
};

// ---  Inline Quick Add Row Component ---
const QuickAddRow = ({
    selectedUuts,
    localRangeIndices,
    resolveRangeHelper,
    onSave,
    showAreaColumn,
    sessionData,
    // NEW PROPS
    viewMode,
    rangeData,
    contextId // usually the UUT ID in range view
}) => {
    // Local state for the inputs
    const [val, setVal] = useState("");
    const [unit, setUnit] = useState("");
    const [section, setSection] = useState("");

    // Determine effective selection based on View Mode
    const effectiveSelectedUuts = useMemo(() => {
        if (viewMode === 'range' && contextId) {
            const uut = sessionData.uuts.find(u => u.id === contextId);
            return uut ? [uut] : [];
        }
        return selectedUuts;
    }, [viewMode, contextId, selectedUuts, sessionData.uuts]);

    const isDisabled = effectiveSelectedUuts.length === 0;

    // Auto-detect unit from selected UUT when selection changes
    useEffect(() => {
        if (effectiveSelectedUuts.length > 0) {
            const primaryUut = effectiveSelectedUuts[0];

            // If in Range View, use the specific range passed down
            if (viewMode === 'range' && rangeData?.unit) {
                if (!unit) setTimeout(() => setUnit(rangeData.unit), 0);
            }
            // Otherwise resolve normally
            else {
                const { activeRange } = resolveRangeHelper(primaryUut, localRangeIndices, null, null);
                if (activeRange?.unit && !unit) {
                    setTimeout(() => setUnit(activeRange.unit), 0);
                }
            }
        }
    }, [effectiveSelectedUuts, localRangeIndices, resolveRangeHelper, unit, viewMode, rangeData]);

    // Real-time Preview Calculation
    const previewMetrics = useMemo(() => {
        if (!val) return { display: "-", limits: { low: "-", high: "-" } };

        let activeTolerance = {};

        // If in Range View, FORCE the specific range
        if (viewMode === 'range' && rangeData) {
            activeTolerance = rangeData;
        }
        // Otherwise use selection logic
        else if (effectiveSelectedUuts.length > 0) {
            const primaryUut = effectiveSelectedUuts[0];
            const nominalObj = { value: val, unit: unit };
            const { activeRange } = resolveRangeHelper(primaryUut, localRangeIndices, null, nominalObj);
            activeTolerance = activeRange || {};
        }

        // Calculate limits
        return calculateToleranceMetrics(activeTolerance, { value: val, unit: unit });
    }, [val, unit, effectiveSelectedUuts, localRangeIndices, resolveRangeHelper, viewMode, rangeData]);

    const handleSave = () => {
        if (!val || !unit) return;

        // Determine Measurement Area ID (Robust Lookup)
        let areaId = null;
        if (effectiveSelectedUuts.length > 0) {
            const primaryUut = effectiveSelectedUuts[0];
            if (primaryUut.measurementAreaId) {
                areaId = primaryUut.measurementAreaId;
            } else if (primaryUut.measurementArea && sessionData?.measurementAreas) {
                const matchedArea = sessionData.measurementAreas.find(a => a.name === primaryUut.measurementArea);
                if (matchedArea) areaId = matchedArea.id;
            }
        }

        // Construct payload
        const newPoint = {
            section: section,
            measurementType: "direct",
            testPointInfo: {
                parameter: { name: "Measurement", value: val, unit: unit }
            },
            associatedUutIds: effectiveSelectedUuts.map(u => u.id),
            measurementAreaId: areaId
        };

        // CRITICAL FIX: If in Range View, inject the specific tolerance
        if (viewMode === 'range' && rangeData) {
            newPoint.uutTolerance = rangeData;
        }

        onSave(newPoint);
        setVal("");
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSave();
    };

    return (
        <tr style={{
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--background-secondary)',
            transition: 'background-color 0.2s ease'
        }}>
            {/* ... (Render logic remains exactly the same) ... */}
            <td className="cell-section" style={{ padding: '4px 8px' }}>
                <input
                    type="text"
                    placeholder="Section"
                    value={section}
                    onChange={e => setSection(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isDisabled}
                    className="quick-add-input organic-input"
                    style={{ /* styles... */ width: '100%', background: 'transparent', border: 'none', padding: '6px 0', fontSize: '0.9rem', color: 'var(--text-color)', outline: 'none', borderBottom: '1px solid transparent', transition: 'border-color 0.2s' }}
                    onFocus={(e) => e.target.style.borderBottom = '1px solid var(--primary-color)'}
                    onBlur={(e) => e.target.style.borderBottom = '1px solid transparent'}
                />
            </td>
            <td className="cell-value" style={{ padding: '4px 8px' }}>
                <input
                    type="text"
                    placeholder={isDisabled ? "Select UUT..." : "Value..."}
                    value={val}
                    onChange={e => setVal(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isDisabled}
                    className="quick-add-input organic-input"
                    // ...
                    style={{ /* styles... */ width: '100%', background: 'transparent', border: 'none', padding: '6px 0', fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary-color)', outline: 'none', borderBottom: '1px solid transparent', transition: 'border-color 0.2s' }}
                    onFocus={(e) => e.target.style.borderBottom = '1px solid var(--primary-color)'}
                    onBlur={(e) => e.target.style.borderBottom = '1px solid transparent'}
                />
            </td>
            <td className="cell-unit" style={{ padding: '4px 8px' }}>
                <input
                    type="text"
                    placeholder="Unit"
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isDisabled}
                    className="quick-add-input organic-input"
                    style={{ /* styles... */ width: '100%', background: 'transparent', border: 'none', padding: '6px 0', fontSize: '0.9rem', color: 'var(--text-color-muted)', outline: 'none', borderBottom: '1px solid transparent', transition: 'border-color 0.2s' }}
                    onFocus={(e) => e.target.style.borderBottom = '1px solid var(--primary-color)'}
                    onBlur={(e) => e.target.style.borderBottom = '1px solid transparent'}
                />
            </td>
            {/* Live Preview Columns */}
            <td className="cell-tolerance" style={{ padding: '4px 8px', verticalAlign: 'middle', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-color-muted)' }}>
                {previewMetrics.display}
            </td>
            <td className="cell-limit" style={{ padding: '4px 8px', verticalAlign: 'middle', fontSize: '0.85rem', color: 'var(--text-color-muted)', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>
                        {previewMetrics.limits.low !== '-' ? (
                            <>
                                <span style={{ opacity: 0.7 }}>{previewMetrics.limits.low}</span>
                                <span style={{ margin: '0 4px', fontSize: '0.75rem' }}>→</span>
                                <span style={{ opacity: 0.7 }}>{previewMetrics.limits.high}</span>
                            </>
                        ) : '-'}
                    </span>
                    {!showAreaColumn && !isDisabled && val && (
                        <button
                            onClick={handleSave}
                            className="btn-icon-only"
                            style={{ color: 'var(--primary-color)', background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: '8px' }}
                        >
                            <FontAwesomeIcon icon={faArrowRight} />
                        </button>
                    )}
                </div>
            </td>
            {showAreaColumn && (
                <td className="cell-area">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span></span>
                        {!isDisabled && val && (
                            <button
                                onClick={handleSave}
                                className="btn-icon-only"
                                style={{ color: 'var(--primary-color)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                            >
                                <FontAwesomeIcon icon={faArrowRight} />
                            </button>
                        )}
                    </div>
                </td>
            )}
        </tr>
    );
};

// --- UPDATED: SUMMARY DASHBOARD ---
const SummaryDashboard = ({
    viewMode,
    contextId,
    sessionData,
    onDefineTestPoint,
    onDeleteTestPoint,
    rangeData,
    uutId,
    onSaveTestPoint,
    onEditSession,
    selectedPointIds,
    setSelectedPointIds,
    onSelectUut,
    onSelectTestPoint,
    // NEW PROPS PASSED DOWN FROM APP/ANALYSIS
    onDeleteUut,
    onDeleteTmdeDefinition,
    onEditUut,
    onAddTmde,
    onEditTmde
}) => {

    // --- SELECTION STATE ---
    const [selectedUutIds, setSelectedUutIds] = useState([]);
    const [selectedTmdeIds, setSelectedTmdeIds] = useState([]);

    const [localRangeIndices, setLocalRangeIndices] = useState({});
    const [tmdeRangeIndices, setTmdeRangeIndices] = useState({});

    // Sorting State
    const [sortConfigs, setSortConfigs] = useState({});

    // Filter Data based on Hierarchy
    const { filteredUuts, filteredPoints, filteredTmdes, title, subtitle, showAreaColumn } = useMemo(() => {
        let uuts = sessionData.uuts || [];
        let points = sessionData.testPoints || [];
        let displayTitle = "Session Overview";
        let displaySubtitle = "All Measurement Areas";

        const isSessionView = viewMode === 'session';

        if (viewMode === 'area') {
            const area = sessionData.measurementAreas?.find(a => a.id === contextId);
            displayTitle = area?.name || "Measurement Area";
            displaySubtitle = "Area Summary";
            uuts = uuts.filter(u => {
                const idMatch = u.measurementAreaId === contextId;
                const nameMatch = area && u.measurementArea && u.measurementArea === area.name;
                return idMatch || nameMatch;
            });
            points = points.filter(tp => tp.measurementAreaId === contextId);
        }
        else if (viewMode === 'uut') {
            const uut = uuts.find(u => u.id === contextId);
            displayTitle = uut?.description || "UUT Detail";
            displaySubtitle = `${uut?.manufacturer || ''} ${uut?.model || ''}`;
            uuts = uut ? [uut] : [];
            points = points.filter(tp => tp.associatedUutIds && tp.associatedUutIds.includes(contextId));
        }
        else if (viewMode === 'range') {
            const uut = uuts.find(u => u.id === uutId);
            uuts = uut ? [uut] : [];
            points = points.filter(tp => {
                if (!tp.associatedUutIds || !tp.associatedUutIds.includes(uutId)) return false;
                const ptTol = tp.uutTolerance;
                if (!ptTol) return false;
                if (rangeData._id !== undefined && ptTol._id !== undefined) {
                    if (rangeData._id === ptTol._id) return true;
                }
                const minMatch = ptTol.min == rangeData.min;
                const maxMatch = ptTol.max == rangeData.max;
                const unitMatch = (ptTol.unit || "") === (rangeData.unit || "");
                const funcMatch = rangeData.functionName ? ptTol.functionName === rangeData.functionName : true;
                return minMatch && maxMatch && unitMatch && funcMatch;
            });
            displayTitle = rangeData.label || "Range Detail";
            displaySubtitle = `${uut?.description || 'UUT'} (${uut?.model || ''})`;
        }

        return {
            filteredUuts: uuts,
            filteredPoints: points,
            filteredTmdes: sessionData.tmdes || [], // Always show all TMDEs
            title: displayTitle,
            subtitle: displaySubtitle,
            showAreaColumn: isSessionView
        };
    }, [viewMode, contextId, sessionData, rangeData, uutId]);

    // --- HANDLERS ---

    // Selection Handlers (Wrapped)
    const handleUutClick = (e, id) => handleRowSelection(e, id, selectedUutIds, setSelectedUutIds);
    const handleTmdeClick = (e, id) => handleRowSelection(e, id, selectedTmdeIds, setSelectedTmdeIds);
    // Point selection uses prop setter
    const handlePointClick = (e, id) => handleRowSelection(e, id, selectedPointIds, setSelectedPointIds);

    const handleSort = (groupId, key) => {
        setSortConfigs(prev => {
            const currentConfig = prev[groupId] || { key: null, direction: 'ascending' };
            const newDirection = currentConfig.key === key && currentConfig.direction === 'ascending' ? 'descending' : 'ascending';
            return { ...prev, [groupId]: { key, direction: newDirection } };
        });
    };

    const handleAddPoint = () => {
        if (onDefineTestPoint) {
            if (viewMode === 'range') {
                onDefineTestPoint([uutId], rangeData);
            } else {
                onDefineTestPoint(selectedUutIds);
            }
        }
    };

    const handleBatchDelete = useCallback(() => {
        if (selectedPointIds.length === 0) return;
        if (onDeleteTestPoint) {
            onDeleteTestPoint(selectedPointIds, false);
            setSelectedPointIds([]);
        }
    }, [selectedPointIds, onDeleteTestPoint, setSelectedPointIds]);

    // NEW: Batch Delete for UUTs
    const handleDeleteSelectedUuts = () => {
        if (onDeleteUut && selectedUutIds.length > 0) {
            // Confirm/Loop deletion logic is handled by parent or simple loop here
            selectedUutIds.forEach(id => onDeleteUut(id));
            setSelectedUutIds([]);
        }
    };

    // NEW: Batch Delete for TMDEs
    const handleDeleteSelectedTmdes = () => {
        if (onDeleteTmdeDefinition && selectedTmdeIds.length > 0) {
            selectedTmdeIds.forEach(id => onDeleteTmdeDefinition(id));
            setSelectedTmdeIds([]);
        }
    };

    // Keyboard Listener for Delete
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace')) {
                // Determine context based on what is selected
                if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                    if (selectedPointIds.length > 0) {
                        e.preventDefault();
                        handleBatchDelete();
                    } else if (selectedUutIds.length > 0) {
                        e.preventDefault();
                        handleDeleteSelectedUuts();
                    } else if (selectedTmdeIds.length > 0) {
                        e.preventDefault();
                        handleDeleteSelectedTmdes();
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedPointIds, selectedUutIds, selectedTmdeIds, onDeleteTestPoint, handleDeleteSelectedUuts, handleDeleteSelectedTmdes]);

    // Wrapper for the helper to pass to QuickAddRow
    const resolveRangeWrapper = (uut, indices, savedTol, nominal) => {
        return resolveUutRangeHelper(uut, indices, savedTol, nominal);
    };

    const cardStyle = { backgroundColor: 'var(--content-background)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
    const headerStyle = { padding: '12px 16px', backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };

    return (
        <div className="configuration-panel" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

            {/* Header */}
            <div style={{ paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem' }}>
                    {viewMode === 'range' && <FontAwesomeIcon icon={faRulerCombined} style={{ marginRight: '10px', color: 'var(--primary-color)' }} />}
                    {title}
                </h2>
                <div style={{ color: 'var(--text-color-muted)', fontSize: '0.9rem', marginTop: '4px' }}>{subtitle}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>

                    {/* UUT TABLE */}
                    <div style={cardStyle}>
                        <div style={headerStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FontAwesomeIcon icon={faMicroscope} />
                                <span>Units Under Test ({filteredUuts.length})</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {/* DELETE BUTTON */}
                                {selectedUutIds.length > 0 && (
                                    <button
                                        className="btn-icon-only delete"
                                        style={{ color: 'var(--status-bad)', width: '24px', height: '24px', borderRadius: '4px', opacity: 1, border: '1px solid rgba(255,82,82,0.3)', marginRight: '8px' }}
                                        onClick={handleDeleteSelectedUuts}
                                        title={`Delete ${selectedUutIds.length} Selected UUTs`}
                                    >
                                        <FontAwesomeIcon icon={faTrashAlt} size="xs" />
                                    </button>
                                )}
                                {/* ADD BUTTON */}
                                <button
                                    className="btn-icon-only"
                                    style={{ backgroundColor: 'var(--primary-color)', color: '#fff', width: '24px', height: '24px', borderRadius: '4px' }}
                                    onClick={() => onEditUut && onEditUut(null)} // Trigger Add
                                    title="Add New UUT"
                                >
                                    <FontAwesomeIcon icon={faPlus} size="xs" />
                                </button>
                            </div>
                        </div>
                        <div className="panel-table-container" style={{ overflowX: 'auto', borderRadius: '8px', border: 'none' }}>
                            <table className="instrument-summary-table compact-table" style={{ margin: 0, border: 'none', boxShadow: 'none', width: '100%', minWidth: '100%', tableLayout: 'fixed' }}>
                                <colgroup>
                                    <col style={{ width: showAreaColumn ? '34%' : '42%' }} />
                                    <col style={{ width: showAreaColumn ? '26%' : '30%' }} />
                                    <col style={{ width: showAreaColumn ? '25%' : '28%' }} />
                                    {showAreaColumn && <col style={{ width: '15%' }} />}
                                </colgroup>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                    <tr>
                                        <th>Description</th>
                                        <th>Range</th>
                                        <th>Specification</th>
                                        {showAreaColumn && <th>Area</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUuts.length === 0 ? (
                                        <tr><td colSpan={showAreaColumn ? 4 : 3} style={{ padding: '20px', textAlign: 'center', fontStyle: 'italic', color: 'var(--text-color-muted)' }}>No UUTs found in this context.</td></tr>
                                    ) : (
                                        filteredUuts.map(uut => {
                                            let resolution = resolveUutRangeHelper(uut, localRangeIndices, null, null);

                                            if (viewMode === 'range' && rangeData) {
                                                const matchIndex = resolution.ranges.findIndex(r => {
                                                    if (rangeData._id !== undefined && r._index !== undefined) return r._index === rangeData._id;
                                                    const minMatch = r.min == rangeData.min;
                                                    const maxMatch = r.max == rangeData.max;
                                                    const unitMatch = (r.unit || "") === (rangeData.unit || "");
                                                    return minMatch && maxMatch && unitMatch;
                                                });
                                                if (matchIndex !== -1) {
                                                    resolution = { ranges: [resolution.ranges[matchIndex]], activeIndex: 0, activeRange: resolution.ranges[matchIndex] };
                                                }
                                            }

                                            const { ranges, activeIndex, activeRange } = resolution;
                                            const specSummary = getToleranceSummary(activeRange);

                                            // CHECK SELECTION
                                            const isSelected = selectedUutIds.includes(uut.id);

                                            const area = sessionData.measurementAreas?.find(a => a.id === uut.measurementAreaId || a.name === uut.measurementArea);
                                            const areaName = area ? area.name : (uut.measurementArea || '-');
                                            const areaColor = area?.color || 'var(--text-color-muted)';

                                            return (
                                                <tr
                                                    key={uut.id}
                                                    className={isSelected ? "selected-row" : ""}
                                                    // CLICK HANDLERS
                                                    onClick={(e) => handleUutClick(e, uut.id)}
                                                    onDoubleClick={() => onSelectUut && onSelectUut(uut.id, uut.measurementAreaId, uut)}
                                                    style={{
                                                        backgroundColor: isSelected ? 'rgba(var(--primary-rgb), 0.15)' : undefined,
                                                        borderLeft: isSelected ? '4px solid var(--primary-color)' : '4px solid transparent',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.1s ease'
                                                    }}
                                                >
                                                    <td className="cell-description" style={{ fontWeight: 600, color: 'var(--text-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0 }} title={uut.description}>
                                                        {uut.description}
                                                    </td>
                                                    <td className="cell-value" onClick={e => e.stopPropagation()}>
                                                        <select
                                                            className="session-selector"
                                                            style={{ width: '100%', padding: '4px 8px', fontSize: '0.85rem' }}
                                                            value={activeIndex}
                                                            onChange={(e) => setLocalRangeIndices(prev => ({ ...prev, [uut.id]: parseInt(e.target.value) }))}
                                                        >
                                                            {ranges.map((range, idx) => {
                                                                const rangeLabel = (typeof range.range === 'string' ? range.range : null) || (range.min !== undefined ? `${range.min} to ${range.max}` : "Full Range");
                                                                return <option key={idx} value={idx}>{`${rangeLabel} ${range.unit || ''}`}</option>
                                                            })}
                                                        </select>
                                                    </td>
                                                    <td className="cell-tolerance" title={specSummary} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0 }}>
                                                        {specSummary}
                                                    </td>
                                                    {showAreaColumn && (
                                                        <td className="cell-area" title={areaName} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0 }}>
                                                            <span style={{ color: areaColor }}>{areaName}</span>
                                                        </td>
                                                    )}
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>

                {/* MEASUREMENT POINTS TABLE */}
                <div style={cardStyle}>
                    <div style={headerStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FontAwesomeIcon icon={faCube} />
                            <span>Measurement Points ({filteredPoints.length})</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {selectedPointIds.length > 0 && (
                                <button
                                    className="btn-icon-only delete"
                                    style={{ color: 'var(--status-bad)', width: '24px', height: '24px', borderRadius: '4px', opacity: 1, border: '1px solid rgba(255,82,82,0.3)', marginRight: '8px' }}
                                    onClick={handleBatchDelete}
                                    title={`Delete ${selectedPointIds.length} Selected Points`}
                                >
                                    <FontAwesomeIcon icon={faTrashAlt} size="xs" />
                                </button>
                            )}
                            <button
                                className="btn-icon-only"
                                style={{ backgroundColor: 'var(--primary-color)', color: '#fff', width: '24px', height: '24px', borderRadius: '4px' }}
                                onClick={handleAddPoint}
                                title="Add Measurement Point"
                            >
                                <FontAwesomeIcon icon={faPlus} size="xs" />
                            </button>
                        </div>
                    </div>
                    <div className="panel-table-container" tabIndex="0">
                        <table className="instrument-summary-table compact-table" style={{ margin: 0, border: 'none', boxShadow: 'none' }}>
                            <tbody>
                                <tr style={{ backgroundColor: 'rgba(var(--primary-rgb), 0.05)', borderBottom: '1px solid var(--border-color)' }}>
                                    <td colSpan={5} style={{ padding: '6px 12px', fontWeight: 600, color: 'var(--primary-color)', fontSize: '0.8rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                        <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
                                        Add New Measurement Point
                                    </td>
                                </tr>
                                <QuickAddRow
                                    selectedUuts={sessionData.uuts.filter(u => selectedUutIds.includes(u.id))}
                                    localRangeIndices={localRangeIndices}
                                    resolveRangeHelper={resolveRangeWrapper}
                                    onSave={onSaveTestPoint}
                                    showAreaColumn={false}
                                    sessionData={sessionData}
                                    viewMode={viewMode}
                                    rangeData={rangeData}
                                    contextId={uutId}
                                />
                                {filteredPoints.length > 0 && (() => {
                                    // ... [Grouping Logic - Same as before] ...
                                    const groupedPoints = {};
                                    const unassignedPoints = [];
                                    filteredPoints.forEach(tp => {
                                        const uutId = tp.associatedUutIds?.[0];
                                        if (uutId) {
                                            if (!groupedPoints[uutId]) groupedPoints[uutId] = [];
                                            groupedPoints[uutId].push(tp);
                                        } else unassignedPoints.push(tp);
                                    });
                                    // ...
                                    const uutOrder = filteredUuts.map(u => u.id).filter(id => groupedPoints[id]);
                                    Object.keys(groupedPoints).forEach(id => { if (!uutOrder.includes(id)) uutOrder.push(id); });

                                    return (
                                        <>
                                            {uutOrder.map(uutId => {
                                                const groupPoints = groupedPoints[uutId];
                                                const uut = sessionData.uuts?.find(u => u.id === uutId);
                                                return (
                                                    <React.Fragment key={uutId}>
                                                        <tr style={{ backgroundColor: 'var(--component-header-bg)', borderTop: '2px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                                                            <td colSpan={5} style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-color)', fontSize: '0.9rem' }}>
                                                                <FontAwesomeIcon icon={faMicroscope} style={{ marginRight: '6px', color: 'var(--primary-color)', opacity: 0.7 }} />
                                                                {uut?.description || "Unknown UUT"}
                                                            </td>
                                                        </tr>
                                                        {/* Headers omitted for brevity */}
                                                        {groupPoints.map(tp => {
                                                            const param = tp.testPointInfo?.parameter || { value: '', unit: '' };
                                                            const isSelected = selectedPointIds.includes(tp.id);
                                                            let activeTolerance = tp.uutTolerance || {};
                                                            // ... calc logic ...
                                                            const { limits, display } = calculateToleranceMetrics(activeTolerance, param);

                                                            return (
                                                                <tr
                                                                    key={tp.id}
                                                                    className={isSelected ? "selected-row" : ""}
                                                                    onClick={(e) => handlePointClick(e, tp.id)} // UPDATED
                                                                    style={{
                                                                        backgroundColor: isSelected ? 'rgba(var(--primary-rgb), 0.15)' : undefined,
                                                                        borderLeft: isSelected ? '4px solid var(--primary-color)' : '4px solid transparent',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    <td className="cell-section">{tp.section || '-'}</td>
                                                                    <td className="cell-value">{param.value}</td>
                                                                    <td className="cell-unit">{param.unit}</td>
                                                                    <td className="cell-tolerance">{display}</td>
                                                                    <td className="cell-limit">{limits.low} → {limits.high}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </React.Fragment>
                                                )
                                            })}
                                        </>
                                    );
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* FULL WIDTH TMDE TABLE */}
            <div style={cardStyle}>
                <div style={headerStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FontAwesomeIcon icon={faTools} />
                        <span>Test Equipment (TMDE) ({filteredTmdes.length})</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* DELETE BUTTON */}
                        {selectedTmdeIds.length > 0 && (
                            <button
                                className="btn-icon-only delete"
                                style={{ color: 'var(--status-bad)', width: '24px', height: '24px', borderRadius: '4px', opacity: 1, border: '1px solid rgba(255,82,82,0.3)', marginRight: '8px' }}
                                onClick={handleDeleteSelectedTmdes}
                                title={`Delete ${selectedTmdeIds.length} Selected TMDEs`}
                            >
                                <FontAwesomeIcon icon={faTrashAlt} size="xs" />
                            </button>
                        )}
                        {/* ADD BUTTON */}
                        <button
                            className="btn-icon-only"
                            style={{ backgroundColor: 'var(--primary-color)', color: '#fff', width: '24px', height: '24px', borderRadius: '4px' }}
                            onClick={onAddTmde}
                            title="Add New TMDE"
                        >
                            <FontAwesomeIcon icon={faPlus} size="xs" />
                        </button>
                    </div>
                </div>
                <div className="panel-table-container" style={{ overflowX: 'auto', borderRadius: '8px', border: 'none' }}>
                    <table className="instrument-summary-table compact-table" style={{ margin: 0, border: 'none', boxShadow: 'none', width: '100%', minWidth: '100%', tableLayout: 'fixed' }}>
                        <colgroup>
                            <col style={{ width: '42%' }} />
                            <col style={{ width: '30%' }} />
                            <col style={{ width: '28%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Range</th>
                                <th>Specification</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTmdes.length === 0 ? (
                                <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', fontStyle: 'italic', color: 'var(--text-color-muted)' }}>No TMDEs found in session.</td></tr>
                            ) : (
                                filteredTmdes.map((tmde, idx) => {
                                    const resolution = resolveUutRangeHelper(tmde, tmdeRangeIndices, null, null);
                                    const { ranges, activeIndex, activeRange } = resolution;
                                    const specSummary = getToleranceSummary(activeRange);

                                    // CHECK SELECTION
                                    const isSelected = selectedTmdeIds.includes(tmde.id);

                                    return (
                                        <tr
                                            key={tmde.id || idx}
                                            className={isSelected ? "selected-row" : ""}
                                            // CLICK HANDLERS
                                            onClick={(e) => handleTmdeClick(e, tmde.id)}
                                            onDoubleClick={() => onEditTmde && onEditTmde(tmde)}
                                            style={{
                                                backgroundColor: isSelected ? 'rgba(var(--primary-rgb), 0.15)' : undefined,
                                                borderLeft: isSelected ? '4px solid var(--primary-color)' : '4px solid transparent',
                                                cursor: 'pointer',
                                                transition: 'all 0.1s ease'
                                            }}
                                        >
                                            <td className="cell-description" style={{ fontWeight: 600, padding: '8px 12px' }} title={tmde.name}>
                                                <div style={{ color: 'var(--text-color)' }}>{tmde.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-color-muted)', marginTop: '2px' }}>
                                                    {tmde.instrument && <span>{tmde.instrument.manufacturer} {tmde.instrument.model}</span>}
                                                </div>
                                            </td>
                                            <td className="cell-value" onClick={e => e.stopPropagation()}>
                                                <select
                                                    className="session-selector"
                                                    style={{ width: '100%', padding: '4px 8px', fontSize: '0.85rem' }}
                                                    value={activeIndex}
                                                    onChange={(e) => setTmdeRangeIndices(prev => ({ ...prev, [tmde.id]: parseInt(e.target.value) }))}
                                                >
                                                    {ranges.map((range, rIdx) => {
                                                        const rangeLabel = (typeof range.range === 'string' ? range.range : null) || (range.min !== undefined ? `${range.min} to ${range.max}` : "Full Range");
                                                        return <option key={rIdx} value={rIdx}>{`${rangeLabel} ${range.unit || ''}`}</option>
                                                    })}
                                                </select>
                                            </td>
                                            <td className="cell-tolerance" title={specSummary}>{specSummary}</td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '20px', backgroundColor: 'rgba(var(--primary-rgb), 0.05)', borderRadius: '8px', border: '1px dashed var(--primary-color)', textAlign: 'center' }}>
                <p style={{ margin: 0, color: 'var(--text-color)' }}>
                    <strong><FontAwesomeIcon icon={faArrowRight} /> Next Step:</strong> Select a specific Measurement Point from the sidebar to begin Detailed Uncertainty or Risk Analysis.
                </p>
            </div>
        </div>
    );
};


function DetailedView({
    testPointData,
    sessionData,
    calcResults,
    calculationError,
    uutNominal,
    uutToleranceData: propUutToleranceData,
    tmdeTolerancesData,
    onAddManualComponent,
    onEditManualComponent,
    onRemoveComponent,
    onInlineUutUpdate,
    onInlineTmdeUpdate,
    onBudgetRowContextMenu,
    onDefineTestPoint,
    onShowDerivedBreakdown,
    onShowRiskBreakdown,
    showContribution,
    setShowContribution,
    onOpenRepeatability,
    onUpdateTestPoint,
    riskResults,
    setNotification,
    onToggleUut,
    onDeleteTestPoint,
    currentUutSelection = [],
    activeRangeIndices = {},
    onRangeSelectionChange,

    // NEW PROPS FOR ACTIONS
    onAddTmde,
    onEditUut,
    onEditTmde,
    onDeleteUut,
    onDeleteTmdeDefinition
}) {

    const [isSymbolMenuOpen, setIsSymbolMenuOpen] = useState(false);
    const [tmdeRangeIndices, setTmdeRangeIndices] = useState({});

    // --- NEW: Local Selection State ---
    const [selectedUutIds, setSelectedUutIds] = useState([]);
    const [selectedTmdeIds, setSelectedTmdeIds] = useState([]);

    const equationInputRef = useRef(null);
    const symbolMenuRef = useRef(null);
    const symbolButtonRef = useRef(null);

    // --- NEW: Row Selection Handlers ---
    const handleRowSelectionLocal = (e, id, currentSelected, setSelected) => {
        if (e.ctrlKey || e.metaKey) {
            setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
        } else {
            setSelected([id]);
        }
    };

    const handleUutClick = (e, id) => handleRowSelectionLocal(e, id, selectedUutIds, setSelectedUutIds);
    const handleTmdeClick = (e, id) => handleRowSelectionLocal(e, id, selectedTmdeIds, setSelectedTmdeIds);

    const handleDeleteSelectedUuts = () => {
        if (onDeleteUut && selectedUutIds.length > 0) {
            selectedUutIds.forEach(id => onDeleteUut(id));
            setSelectedUutIds([]);
        }
    };

    const handleDeleteSelectedTmdes = () => {
        if (onDeleteTmdeDefinition && selectedTmdeIds.length > 0) {
            selectedTmdeIds.forEach(id => onDeleteTmdeDefinition(id));
            setSelectedTmdeIds([]);
        }
    };

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

    const uutToleranceData = useMemo(() => {
        const isUnassigned = !testPointData.associatedUutIds || testPointData.associatedUutIds.length === 0;
        if (isUnassigned) return {};
        return propUutToleranceData || {};
    }, [propUutToleranceData, testPointData.associatedUutIds]);

    // --- RESOLUTION HELPER WITH DEBUG LOGS ---
    const resolveUutRange = useCallback((uut) => {
        const resolution = resolveUutRangeHelper(uut, activeRangeIndices, uutToleranceData, uutNominal);
        return resolution;
    }, [activeRangeIndices, uutToleranceData, uutNominal]);

    const groupedUnitOptions = useMemo(() => {
        const allSupportedUnits = Object.keys(unitSystem.units);
        const options = [];
        const usedUnits = new Set();

        Object.entries(unitCategories).forEach(([category, units]) => {
            const validUnits = units.filter(u => allSupportedUnits.includes(u));
            if (validUnits.length > 0) {
                options.push({
                    label: category,
                    options: validUnits.map(u => {
                        usedUnits.add(u);
                        return { value: u, label: u };
                    })
                });
            }
        });

        const leftovers = allSupportedUnits
            .filter(u => !usedUnits.has(u))
            .sort()
            .map(u => ({ value: u, label: u }));

        if (leftovers.length > 0) {
            options.push({ label: "Other", options: leftovers });
        }

        return options;
    }, []);

    const activeMeasurementAreaId = testPointData.measurementAreaId;

    // We read directly from sessionData to ensure we catch mutations/updates from the modal
    const relevantUuts = sessionData.uuts || [];

    const associatedUutIds = testPointData.associatedUutIds || [];
    const isDerived = testPointData.measurementType === "derived";
    const isUnassigned = associatedUutIds.length === 0;

    const availableVariables = useMemo(() => {
        if (!isDerived) return [];
        if (testPointData.variableMappings && Object.values(testPointData.variableMappings).length > 0) {
            const vars = Object.values(testPointData.variableMappings)
                .map(v => v ? v.trim() : "")
                .filter(v => v !== "");
            return [...new Set(vars)];
        }
        return [];
    }, [testPointData, isDerived]);

    // --- HANDLERS ---
    const handleUutCheckboxChange = (uutId) => {
        onToggleUut(uutId);
    };

    const handleRangeChange = (uutId, newIndex, ranges) => {
        if (onRangeSelectionChange) {
            onRangeSelectionChange(prev => ({ ...prev, [uutId]: newIndex }));
        }
    };

    const handleActionAdd = () => {
        if (!currentUutSelection || currentUutSelection.length === 0) {
            onDefineTestPoint([], null);
            return;
        }

        const primaryUutId = currentUutSelection[0];
        const primaryUut = relevantUuts.find(u => u.id === primaryUutId);
        let resolvedTolerance = null;

        if (primaryUut) {
            const { activeRange } = resolveUutRange(primaryUut);
            resolvedTolerance = activeRange;
        }

        onDefineTestPoint(currentUutSelection, resolvedTolerance);
    };

    const handleActionRemove = () => {
        if (!testPointData.id) {
            if (onDeleteTestPoint) onDeleteTestPoint(null);
            return;
        }

        setNotification({
            title: "Delete Measurement Point",
            message: "Are you sure you want to delete this measurement point?",
            confirmText: "Delete",
            isIconConfirm: true,
            onConfirm: () => {
                if (onDeleteTestPoint) onDeleteTestPoint(testPointData.id);
            }
        });
    };

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
                node.traverse(function (node) {
                    if (node.isSymbolNode && !math[node.name] && !['e', 'pi', 'i'].includes(node.name.toLowerCase())) {
                        varsSet.add(node.name);
                    }
                });
                variables = Array.from(varsSet).sort();
            }
        } catch { /* ignore */ }

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
        const cleanedName = newName ? newName.trim() : "";
        const newMappings = { ...testPointData.variableMappings, [symbol]: cleanedName };
        if (onUpdateTestPoint) {
            onUpdateTestPoint({ variableMappings: newMappings });
        }
    };

    const handleAssignTmdeToVariable = (symbol, tmdeIdStr) => {
        const varName = testPointData.variableMappings?.[symbol] || "";
        if (!varName) return;

        if (!tmdeIdStr) {
            const currentAssigned = tmdeTolerancesData.find(t => t.variableType === varName);
            if (currentAssigned && onInlineTmdeUpdate) {
                onInlineTmdeUpdate(currentAssigned.id, 'variableType', "");
            }
            return;
        }

        const targetTmde = sessionData.tmdes?.find(t => t.id == tmdeIdStr) || tmdeTolerancesData.find(t => t.id == tmdeIdStr);
        if (!targetTmde) return;

        const realTmdeId = targetTmde.id;
        const previousHolder = tmdeTolerancesData.find(t => t.variableType === varName);

        if (previousHolder && previousHolder.id === realTmdeId) return;

        if (previousHolder && onInlineTmdeUpdate) {
            onInlineTmdeUpdate(previousHolder.id, 'variableType', "");
        }

        const isActive = tmdeTolerancesData.some(t => t.id === realTmdeId);
        if (!isActive) {
            const newTolerance = { ...targetTmde, variableType: varName, quantity: 1 };
            const newTolerances = [...tmdeTolerancesData, newTolerance];
            onUpdateTestPoint({ tmdeTolerances: newTolerances });
        } else if (onInlineTmdeUpdate) {
            onInlineTmdeUpdate(realTmdeId, 'variableType', varName);
        }
    };

    const handleToggleTmdeUsage = (tmdeId, isChecked) => {
        if (isChecked) {
            const sourceTmde = sessionData.tmdes.find(t => t.id === tmdeId);
            if (sourceTmde) {
                const resolution = resolveUutRangeHelper(sourceTmde, tmdeRangeIndices, null, null);
                const activeRange = resolution.activeRange || {};
                const { id: rangeId, ...rangeSpecs } = activeRange;

                const newInstance = {
                    ...sourceTmde,
                    ...rangeSpecs,
                    id: sourceTmde.id,
                    sourceId: sourceTmde.id,
                    quantity: 1
                };

                const newTolerances = [...tmdeTolerancesData, newInstance];
                onUpdateTestPoint({ tmdeTolerances: newTolerances });
            }
        } else {
            const newTolerances = tmdeTolerancesData.filter(t =>
                t.id !== tmdeId && t.sourceId !== tmdeId
            );
            onUpdateTestPoint({ tmdeTolerances: newTolerances });
        }
    };

    const handleTmdeRangeChange = (tmde, newIndex, ranges) => {
        setTmdeRangeIndices(prev => ({ ...prev, [tmde.id]: newIndex }));

        const activeInstance = tmdeTolerancesData.find(t => t.id === tmde.id);
        if (activeInstance && onUpdateTestPoint) {
            const selectedRange = ranges[newIndex] || {};
            const { id: rangeId, ...rangeSpecs } = selectedRange;

            const updatedInstance = {
                ...activeInstance,
                ...rangeSpecs,
                id: activeInstance.id
            };

            const updatedTolerances = tmdeTolerancesData.map(t =>
                t.id === tmde.id ? updatedInstance : t
            );
            onUpdateTestPoint({ tmdeTolerances: updatedTolerances });
        }
    };


    const equationDisplayData = useMemo(() => {
        if (!isDerived) return null;

        const currentMappings = testPointData.variableMappings || {};
        const vars = Object.keys(currentMappings).sort().map((symbol) => {
            const name = currentMappings[symbol];
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

    const mainGridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', width: '100%', alignItems: 'start', marginBottom: '30px' };
    const verticalColumnStyle = { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' };
    const cardStyle = { backgroundColor: 'var(--content-background)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', width: '100%' };
    const sectionTitleStyle = { margin: '0 0 10px 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-color)', textTransform: 'uppercase', letterSpacing: '0.5px' };

    const hasMeasurementPoint = isDerived || (uutNominal && (uutNominal.value !== undefined && uutNominal.value !== "" && uutNominal.value !== null));
    const hasUnassignedVariables = isDerived && equationDisplayData?.variables.some(v => !v.isAssigned);

    const isBackendMappingError = calculationError && (
        calculationError.includes("Variable mappings are missing") ||
        calculationError.includes("Input data missing") ||
        calculationError.includes("Internal error")
    );

    const calculatedNominal = calcResults?.calculatedNominalValue;
    const targetNominal = parseFloat(uutNominal?.value);

    const getCalculatedStatus = () => {
        if (isNaN(calculatedNominal) || isNaN(targetNominal)) return 'neutral';
        const diff = Math.abs(calculatedNominal - targetNominal);
        const tolerance = Math.max(Math.abs(targetNominal * 0.0001), 1e-9);
        return diff <= tolerance ? 'match' : 'mismatch';
    };

    const calcStatus = getCalculatedStatus();

    const calcStatusStyle = {
        match: { borderColor: 'var(--status-good)', backgroundColor: 'rgba(76, 175, 80, 0.1)', color: 'var(--status-good)', icon: faCheckCircle },
        mismatch: { borderColor: 'var(--status-bad)', backgroundColor: 'rgba(255, 82, 82, 0.1)', color: 'var(--status-bad)', icon: faTimesCircle },
        neutral: { borderColor: 'var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-color-muted)', icon: null }
    }[calcStatus];

    const primaryUutId = testPointData.associatedUutIds?.[0];
    const primaryUut = relevantUuts.find(u => u.id === primaryUutId);

    const activeResolvedTolerance = useMemo(() => {
        if (!primaryUut) return uutToleranceData;
        const { activeRange } = resolveUutRange(primaryUut);
        return (activeRange && Object.keys(activeRange).length > 0) ? activeRange : uutToleranceData;
    }, [primaryUut, resolveUutRange, uutToleranceData]);

    // Auto-Save Effect
    useEffect(() => {
        if (activeResolvedTolerance && uutToleranceData) {
            const isDifferent =
                activeResolvedTolerance.range !== uutToleranceData.range ||
                activeResolvedTolerance.min != uutToleranceData.min ||
                activeResolvedTolerance.max != uutToleranceData.max ||
                activeResolvedTolerance.unit !== uutToleranceData.unit;

            if (isDifferent && onUpdateTestPoint) {
                onUpdateTestPoint({ uutTolerance: activeResolvedTolerance });
            }
        }
    }, [activeResolvedTolerance, uutToleranceData, onUpdateTestPoint]);

    const calculatedToleranceDisplay = useMemo(() => {
        const result = calculateToleranceMetrics(activeResolvedTolerance, uutNominal);
        return result.display;
    }, [activeResolvedTolerance, uutNominal]);

    const calculatedLimits = useMemo(() => {
        const result = calculateToleranceMetrics(activeResolvedTolerance, uutNominal);
        return result.limits;
    }, [activeResolvedTolerance, uutNominal]);


    return (
        <div className="configuration-panel">

            <div style={mainGridStyle}>

                {/* --- LEFT COLUMN: UUT & TMDEs --- */}
                <div style={verticalColumnStyle}>

                    {/* 1. UUT INFORMATION */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h3 style={{ ...sectionTitleStyle, margin: 0 }}>Unit Under Test</h3>

                            {/* NEW: UUT Header Actions */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {selectedUutIds.length > 0 && (
                                    <button
                                        className="btn-icon-only delete"
                                        style={{ color: 'var(--status-bad)', width: '22px', height: '22px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                                        onClick={handleDeleteSelectedUuts}
                                        title={`Delete ${selectedUutIds.length} Selected UUTs`}
                                    >
                                        <FontAwesomeIcon icon={faTrashAlt} />
                                    </button>
                                )}
                                <span
                                    onClick={() => onEditUut && onEditUut(null)}
                                    className="action-icon"
                                    title="Add UUT"
                                    style={{ cursor: "pointer", color: "var(--primary-color)", fontSize: '0.9rem', fontWeight: 600 }}
                                >
                                    <FontAwesomeIcon icon={faPlus} /> Add
                                </span>
                            </div>
                        </div>

                        <div style={cardStyle}>
                            <div className="instrument-table-container" style={{ margin: 0, border: 'none', boxShadow: 'none', borderRadius: '8px', overflowX: 'auto', flex: 1, maxHeight: '300px' }}>
                                <table className="instrument-summary-table" style={{ width: '100%', minWidth: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                                    <colgroup>
                                        <col style={{ width: '40%' }} />
                                        <col style={{ width: '30%' }} />
                                        <col style={{ width: '30%' }} />
                                    </colgroup>
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                        <tr>
                                            <th>Description</th>
                                            <th>Range</th>
                                            <th>Specification</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {relevantUuts.length === 0 ? (
                                            <tr>
                                                <td colSpan="3" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-color-muted)', fontStyle: 'italic' }}>
                                                    No associated UUTs found.
                                                </td>
                                            </tr>
                                        ) : (
                                            relevantUuts.map((uut) => {
                                                const { ranges, activeIndex, activeRange } = resolveUutRange(uut);
                                                const isLinked = testPointData.associatedUutIds && testPointData.associatedUutIds.includes(uut.id);
                                                const specRows = getSpecRows(activeRange);
                                                const rowSpan = specRows.length > 0 ? specRows.length : 1;
                                                const isSelected = selectedUutIds.includes(uut.id);

                                                return (
                                                    <React.Fragment key={uut.id}>
                                                        <tr
                                                            style={{
                                                                backgroundColor: isSelected ? 'rgba(var(--primary-rgb), 0.15)' : undefined,
                                                                borderLeft: isLinked ? '4px solid var(--primary-color)' : (isSelected ? '4px solid var(--primary-color)' : '4px solid transparent'),
                                                                cursor: 'pointer',
                                                                transition: 'all 0.1s ease'
                                                            }}
                                                            // CLICK HANDLERS
                                                            onClick={(e) => handleUutClick(e, uut.id)}
                                                            onDoubleClick={() => onEditUut && onEditUut(uut)}
                                                            title="Click to select, Double-click to edit UUT details"
                                                        >
                                                            <td
                                                                rowSpan={rowSpan}
                                                                className="no-hover-cell"
                                                                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0, verticalAlign: 'top' }}
                                                            >
                                                                <div style={{ fontWeight: 600, color: isLinked ? 'var(--primary-color)' : 'var(--text-color)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {uut.description}
                                                                </div>
                                                            </td>

                                                            <td rowSpan={rowSpan} style={{ verticalAlign: 'top' }} onClick={e => e.stopPropagation()}>
                                                                <select
                                                                    className="session-selector"
                                                                    style={{
                                                                        width: '100%',
                                                                        padding: '4px 8px',
                                                                        fontSize: '0.85rem'
                                                                    }}
                                                                    value={activeIndex}
                                                                    onChange={(e) => handleRangeChange(uut.id, parseInt(e.target.value), ranges)}
                                                                >
                                                                    {ranges.map((range, idx) => {
                                                                        let rangeText = (typeof range.range === 'string' ? range.range : null);
                                                                        if (!rangeText) {
                                                                            if (range.min !== undefined && range.max !== undefined) {
                                                                                rangeText = `${range.min} to ${range.max}`;
                                                                            } else {
                                                                                rangeText = "Full Range";
                                                                            }
                                                                        }
                                                                        const label = `${rangeText} ${range.unit || ''}`;
                                                                        return <option key={idx} value={idx}>{label}</option>
                                                                    })}
                                                                </select>
                                                            </td>

                                                            <td className="no-hover-cell" style={{ verticalAlign: 'top' }} title={specRows[0]}>
                                                                <span style={{ fontSize: '0.85rem' }}>
                                                                    {specRows[0]}
                                                                </span>
                                                            </td>
                                                        </tr>

                                                        {specRows.slice(1).map((specComp, idx) => (
                                                            <tr
                                                                key={`${uut.id}-spec-${idx}`}
                                                                style={{
                                                                    backgroundColor: isSelected ? 'rgba(var(--primary-rgb), 0.15)' : undefined,
                                                                    borderLeft: isLinked || isSelected ? '4px solid var(--primary-color)' : '4px solid transparent',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                <td className="no-hover-cell" style={{ verticalAlign: 'top', borderTop: 'none' }} title={specComp}>
                                                                    <span style={{ fontSize: '0.85rem' }}>
                                                                        {specComp}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </React.Fragment>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                </div>

                {/* --- RIGHT COLUMN --- */}
                <div style={verticalColumnStyle}>
                    {/* 3. MEASUREMENT POINT TABLE (Original) */}
                    <div>
                        <h3 style={sectionTitleStyle}>Measurement Point</h3>
                        <div style={cardStyle}>
                            <div className="instrument-table-container" style={{ margin: 0, border: 'none', boxShadow: 'none', borderRadius: '8px', flex: 1, overflowX: 'auto' }}>
                                <table className="instrument-summary-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                                    <colgroup>
                                        <col style={{ width: '15%' }} />
                                        <col style={{ width: '15%' }} />
                                        <col style={{ width: '10%' }} />
                                        <col style={{ width: '20%' }} />
                                        <col style={{ width: '15%' }} />
                                        <col style={{ width: '15%' }} />
                                        <col style={{ width: '10%' }} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th style={{ paddingLeft: '20px' }}>Section</th>
                                            <th>Point</th>
                                            <th>Unit</th>
                                            <th>Tolerance</th>
                                            <th>Low Limit</th>
                                            <th>High Limit</th>
                                            <th style={{ textAlign: 'center', paddingRight: '20px' }}>
                                                {!hasMeasurementPoint && (
                                                    <span
                                                        onClick={handleActionAdd}
                                                        className="action-icon"
                                                        title="Add Measurement Point"
                                                        style={{
                                                            cursor: "pointer",
                                                            color: "var(--primary-color)",
                                                            float: 'right'
                                                        }}
                                                    >
                                                        <FontAwesomeIcon icon={faPlus} /> Add
                                                    </span>
                                                )}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {hasMeasurementPoint ? (
                                            <tr>
                                                <td style={{ paddingLeft: '20px' }}>
                                                    <div style={{ fontWeight: 600, color: 'var(--text-color)' }}>
                                                        <EditableCell
                                                            value={testPointData.section}
                                                            onSave={(val) => onUpdateTestPoint && onUpdateTestPoint({ section: val })}
                                                            placeholder="General"
                                                        />
                                                    </div>
                                                </td>

                                                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--primary-color)' }}>
                                                        <EditableCell
                                                            value={uutNominal?.value}
                                                            onSave={(val) => onInlineUutUpdate && onInlineUutUpdate('nominal', val)}
                                                            type="number"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </td>

                                                <td>
                                                    <div style={{ fontWeight: 600, paddingLeft: '4px' }}>
                                                        {uutNominal?.unit}
                                                    </div>
                                                </td>

                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        {isUnassigned && (!activeResolvedTolerance || Object.keys(activeResolvedTolerance).length === 0) ? (
                                                            <span style={{ fontWeight: 400, color: 'var(--text-color-muted)', fontStyle: 'italic' }}>
                                                                No UUT / Spec
                                                            </span>
                                                        ) : (
                                                            <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-color)' }}>
                                                                {calculatedToleranceDisplay}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td>
                                                    <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-color)' }}>
                                                        {calculatedLimits.low}
                                                    </span>
                                                </td>

                                                <td>
                                                    <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-color)' }}>
                                                        {calculatedLimits.high}
                                                    </span>
                                                </td>

                                                <td className="action-cell" style={{ paddingRight: '20px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                        <span
                                                            className="action-icon"
                                                            onClick={handleActionRemove}
                                                            title="Delete or Unassign"
                                                            style={{
                                                                cursor: "pointer",
                                                                color: "var(--status-bad)",
                                                                fontSize: '0.9rem'
                                                            }}
                                                        >
                                                            <FontAwesomeIcon icon={faTrashAlt} />
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            <tr>
                                                <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-color-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                                                    No active point. Select a UUT range on the left and define a point.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* --- MIDDLE ROW: EQUATION --- */}
            <div style={{ marginBottom: '30px' }}>
                {isDerived && equationDisplayData && (
                    <div>
                        <h3 style={sectionTitleStyle}>Measurement Equation</h3>
                        <div style={{
                            backgroundColor: 'var(--content-background)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '15px'
                        }}>
                            <div className="input-with-symbol-button">
                                <input
                                    ref={equationInputRef}
                                    type="text"
                                    value={equationDisplayData.equation}
                                    onChange={(e) => handleEquationChange(e.target.value)}
                                    placeholder="e.g. V / R or W * L"
                                    style={{ fontFamily: 'monospace' }}
                                />
                                <button
                                    type="button"
                                    className="symbol-toggle-button"
                                    title="Show Symbols"
                                    ref={symbolButtonRef}
                                    onClick={() => setIsSymbolMenuOpen(!isSymbolMenuOpen)}
                                >
                                    f(x)
                                </button>

                                {isSymbolMenuOpen && (
                                    <div
                                        className="symbol-popout"
                                        ref={symbolMenuRef}
                                        style={{ maxHeight: '300px', overflowY: 'auto' }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '5px', borderBottom: '1px solid var(--border-color)' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Math Symbols</span>
                                            <span onClick={() => setIsSymbolMenuOpen(false)} style={{ cursor: 'pointer' }}><FontAwesomeIcon icon={faTimes} /></span>
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

                            {calcStatus !== 'neutral' && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '10px 14px',
                                    borderRadius: '6px',
                                    border: `1px solid ${calcStatusStyle.borderColor}`,
                                    backgroundColor: calcStatusStyle.backgroundColor,
                                    fontSize: '0.9rem',
                                    fontWeight: 500,
                                    color: calcStatusStyle.color
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <FontAwesomeIcon icon={calcStatusStyle.icon} />
                                        <span>
                                            Calculated: <strong>{calculatedNominal?.toPrecision(6)} {uutNominal?.unit}</strong>
                                        </span>
                                    </div>
                                    <div style={{ color: 'var(--text-color-muted)', fontSize: '0.85rem' }}>
                                        (Target: {targetNominal?.toPrecision(6)} {uutNominal?.unit})
                                    </div>
                                </div>
                            )}

                            <div className="var-map-grid" style={{ flex: 1 }}>
                                {equationDisplayData.variables.map((v) => (
                                    <div key={v.symbol} className={`var-card-modern ${v.isAssigned ? 'assigned' : 'unassigned'}`}>
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

                                        <div className="var-card-body">
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-color-muted)', marginBottom: '5px' }}>
                                                    ASSIGNED SOURCE
                                                </label>
                                                <select
                                                    className="var-source-select"
                                                    value={v.tmdeId || ""}
                                                    onChange={(e) => handleAssignTmdeToVariable(v.symbol, e.target.value)}
                                                    disabled={!v.name}
                                                >
                                                    <option value="">-- No Source (Manual Entry) --</option>
                                                    {sessionData.tmdes?.map(tmde => (
                                                        <option key={tmde.id} value={tmde.id}>
                                                            {tmde.name || "Unnamed TMDE"}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-color-muted)', marginBottom: '5px' }}>
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
                                                                width: "100px"
                                                            }}
                                                        />
                                                        <div style={{ width: '85px', marginLeft: '5px', borderBottom: '1px dashed var(--border-color)' }}>
                                                            <Select
                                                                options={groupedUnitOptions}
                                                                value={
                                                                    groupedUnitOptions
                                                                        .flatMap(g => g.options)
                                                                        .find(opt => opt.value === v.unit) || (v.unit ? { value: v.unit, label: v.unit } : null)
                                                                }
                                                                onChange={(opt) => onInlineTmdeUpdate && onInlineTmdeUpdate(v.tmdeId, 'unit', opt.value)}
                                                                styles={customUnitSelectStyles}
                                                                placeholder="Unit"
                                                                menuPortalTarget={document.body}
                                                                isSearchable={true}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="var-value-display" style={{ backgroundColor: 'var(--input-background)' }}>
                                                        <span style={{ color: 'var(--text-color-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                                                            <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: 'var(--status-warning)', marginRight: '6px' }} />
                                                            Map source above
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- BOTTOM ROW: TMDEs (Full Width - UPDATED) --- */}
            <div style={{ marginBottom: '30px' }}>
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h3 style={{ ...sectionTitleStyle, margin: 0 }}>Measurement Standards (TMDE)</h3>

                        {/* NEW: TMDE Header Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {selectedTmdeIds.length > 0 && (
                                <button
                                    className="btn-icon-only delete"
                                    style={{ color: 'var(--status-bad)', width: '22px', height: '22px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                                    onClick={handleDeleteSelectedTmdes}
                                    title={`Delete ${selectedTmdeIds.length} Selected TMDEs`}
                                >
                                    <FontAwesomeIcon icon={faTrashAlt} />
                                </button>
                            )}
                            <span
                                onClick={onAddTmde}
                                className="action-icon"
                                title="Add TMDE"
                                style={{
                                    cursor: "pointer",
                                    color: "var(--primary-color)",
                                    fontSize: '0.9rem',
                                    fontWeight: 600
                                }}
                            >
                                <FontAwesomeIcon icon={faPlus} /> Add
                            </span>
                        </div>
                    </div>

                    <div style={cardStyle}>
                        <div className="panel-table-container" style={{ margin: 0, border: 'none', boxShadow: 'none', borderRadius: '8px', flex: 1 }}>
                            <table className="instrument-summary-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                                <colgroup>
                                    <col style={{ width: '50px' }} />
                                    <col style={{ width: isDerived ? '30%' : '35%' }} />
                                    {isDerived && <col style={{ width: '100px' }} />}
                                    <col style={{ width: isDerived ? '25%' : '30%' }} />
                                    <col style={{ width: isDerived ? '25%' : '30%' }} />
                                    {isDerived && <col style={{ width: '15%' }} />}
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'center' }}>Use</th>
                                        <th>Description</th>
                                        {isDerived && <th>Input Var</th>}
                                        <th>Range</th>
                                        <th>Specification</th>
                                        {isDerived && <th>Meas. Point</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(!sessionData.tmdes || sessionData.tmdes.length === 0) ? (
                                        <tr><td colSpan={isDerived ? "6" : "5"} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-color-muted)', fontStyle: 'italic' }}>No TMDEs defined in Session.</td></tr>
                                    ) : (
                                        sessionData.tmdes.map((masterTmde) => {
                                            // Check selection state
                                            const isSelectedRow = selectedTmdeIds.includes(masterTmde.id);

                                            const activeInstances = tmdeTolerancesData.filter(t => t.id === masterTmde.id || (t.sourceId && t.sourceId === masterTmde.id));
                                            const rowsToRender = activeInstances.length > 0 ? activeInstances : [masterTmde];

                                            return rowsToRender.map((tmdeInstance, idx) => {
                                                const isChecked = activeInstances.includes(tmdeInstance);
                                                const referencePoint = tmdeInstance.measurementPoint || { value: '', unit: '' };

                                                const displayValue = isChecked ? referencePoint.value : '';
                                                const displayUnit = isChecked ? referencePoint.unit : (masterTmde.measurementPoint?.unit || '');

                                                const savedTolerance = isChecked ? tmdeInstance : null;
                                                const resolution = resolveUutRangeHelper(masterTmde, tmdeRangeIndices, savedTolerance, null);
                                                const { ranges, activeIndex, activeRange } = resolution;

                                                const effectiveTolerance = activeRange;
                                                const specRows = getSpecRows(effectiveTolerance);
                                                const rowSpan = specRows.length > 0 ? specRows.length : 1;

                                                const safeDescription = masterTmde.description || masterTmde.name || (masterTmde.instrument ? `${masterTmde.instrument.manufacturer} ${masterTmde.instrument.model}` : "Unknown TMDE");

                                                return (
                                                    <React.Fragment key={`${masterTmde.id}-${idx}`}>
                                                        <tr
                                                            className="tmde-row"
                                                            style={{
                                                                // Apply Selection Highlight
                                                                backgroundColor: isSelectedRow ? 'rgba(var(--primary-rgb), 0.15)' : 'transparent',
                                                                borderLeft: isSelectedRow ? '4px solid var(--primary-color)' : '4px solid transparent',
                                                                opacity: isChecked ? 1 : (isSelectedRow ? 1 : 0.7),
                                                                cursor: 'pointer'
                                                            }}
                                                            // Click Handlers
                                                            onClick={(e) => handleTmdeClick(e, masterTmde.id)}
                                                            onDoubleClick={() => onEditTmde && onEditTmde(masterTmde)}
                                                            title="Click to select, Double-click to edit TMDE details"
                                                        >
                                                            <td rowSpan={rowSpan} style={{ textAlign: 'center', verticalAlign: 'top' }} onClick={e => e.stopPropagation()}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={(e) => handleToggleTmdeUsage(masterTmde.id, e.target.checked)}
                                                                    style={{ cursor: 'pointer' }}
                                                                />
                                                            </td>

                                                            <td rowSpan={rowSpan} className="cell-description" style={{ verticalAlign: 'top' }}>
                                                                <div style={{ fontWeight: 600, color: 'var(--text-color)' }}>
                                                                    {safeDescription}
                                                                </div>
                                                            </td>

                                                            {isDerived && (
                                                                <td rowSpan={rowSpan} style={{ verticalAlign: 'top' }} onClick={e => e.stopPropagation()}>
                                                                    {isChecked ? (
                                                                        <select
                                                                            value={availableVariables.includes(tmdeInstance.variableType) ? tmdeInstance.variableType : ""}
                                                                            onChange={(e) => onInlineTmdeUpdate && onInlineTmdeUpdate(tmdeInstance.id, 'variableType', e.target.value)}
                                                                            className="mini-select"
                                                                        >
                                                                            <option value="" disabled>--</option>
                                                                            {availableVariables.map(v => (
                                                                                <option key={v} value={v}>{v}</option>
                                                                            ))}
                                                                        </select>
                                                                    ) : "-"}
                                                                </td>
                                                            )}

                                                            <td rowSpan={rowSpan} className="cell-value" style={{ verticalAlign: 'top' }} onClick={e => e.stopPropagation()}>
                                                                <select
                                                                    className="session-selector"
                                                                    style={{ width: '100%', padding: '4px 8px', fontSize: '0.85rem' }}
                                                                    value={activeIndex}
                                                                    onChange={(e) => handleTmdeRangeChange(masterTmde, parseInt(e.target.value), ranges)}
                                                                >
                                                                    {ranges.map((range, rIdx) => {
                                                                        let rangeText = (typeof range.range === 'string' ? range.range : null);
                                                                        if (!rangeText) {
                                                                            if (range.min !== undefined && range.max !== undefined) rangeText = `${range.min} to ${range.max}`;
                                                                            else rangeText = "Full Range";
                                                                        }
                                                                        const label = `${rangeText} ${range.unit || ''}`;
                                                                        return <option key={rIdx} value={rIdx}>{label}</option>
                                                                    })}
                                                                </select>
                                                            </td>

                                                            <td className="no-hover-cell" style={{ verticalAlign: 'top' }} title={specRows[0]}>
                                                                <span style={{ fontSize: '0.85rem' }}>
                                                                    {specRows[0]}
                                                                </span>
                                                            </td>

                                                            {isDerived && (
                                                                <td rowSpan={rowSpan} style={{ verticalAlign: 'top' }} onClick={e => e.stopPropagation()}>
                                                                    {isChecked ? (
                                                                        <EditableCell
                                                                            value={displayValue}
                                                                            suffix={displayUnit}
                                                                            onSave={(val) => onInlineTmdeUpdate && onInlineTmdeUpdate(tmdeInstance.id, 'nominal', val)}
                                                                            type="number"
                                                                        />
                                                                    ) : "-"}
                                                                </td>
                                                            )}
                                                        </tr>

                                                        {specRows.slice(1).map((specComp, sIdx) => (
                                                            <tr
                                                                key={`${masterTmde.id}-${idx}-spec-${sIdx}`}
                                                                className="tmde-row"
                                                                style={{
                                                                    backgroundColor: isSelectedRow ? 'rgba(var(--primary-rgb), 0.15)' : 'transparent',
                                                                    borderLeft: isSelectedRow ? '4px solid var(--primary-color)' : '4px solid transparent',
                                                                    opacity: isChecked ? 1 : 0.7
                                                                }}
                                                            >
                                                                <td className="no-hover-cell" style={{ verticalAlign: 'top', borderTop: 'none' }} title={specComp}>
                                                                    <span style={{ fontSize: '0.85rem' }}>
                                                                        {specComp}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </React.Fragment>
                                                );
                                            })
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {hasMeasurementPoint ? (
                hasUnassignedVariables || isBackendMappingError ? (
                    <div className="placeholder-content" style={{ padding: '20px', color: 'var(--text-color-muted)' }}>
                        {hasUnassignedVariables
                            ? "Map all equation variables to a TMDE above to calculate budget."
                            : "Complete the equation configuration to calculate budget."}
                    </div>
                ) : calculationError ? (
                    <div className="form-section-warning">
                        <p>Calculation Error: {calculationError}</p>
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
                )
            ) : (
                <div className="placeholder-content" style={{ marginTop: '30px', borderTop: '1px solid var(--border-color)', paddingTop: '30px' }}>
                    <h3>Ready to Measure</h3>
                    <p>Select a UUT Specification Range (top left) and define a Measurement Point (top right) to begin analysis.</p>
                </div>
            )}
        </div>
    );
}

const UncertaintyPanel = (props) => {
    const { testPointData, sessionData, onDefineTestPoint, onDeleteTestPoint, onSaveTestPoint } = props;
    const viewMode = testPointData.viewMode || 'point';

    if (viewMode !== 'point') {
        return (
            <SummaryDashboard
                viewMode={viewMode}
                contextId={testPointData.id}
                rangeData={testPointData.rangeData}
                uutId={testPointData.uutId}
                sessionData={sessionData}
                onDefineTestPoint={onDefineTestPoint}
                onDeleteTestPoint={onDeleteTestPoint}
                onSaveTestPoint={onSaveTestPoint}
                onEditSession={props.handleOpenSessionEditor}
                selectedPointIds={props.selectedTablePointIds || []}
                setSelectedPointIds={props.setSelectedTablePointIds || (() => { })}

                // Navigation Handlers
                onSelectUut={props.onSelectUut}
                onSelectTestPoint={props.onSelectTestPoint}
            />
        );
    }

    return <DetailedView {...props}
        onAddTmde={props.onAddTmde}
        onEditUut={props.onEditUut}
        onEditTmde={props.onEditTmde}
        onDeleteUut={props.onDeleteUut}
        onDeleteTmdeDefinition={props.onDeleteTmdeDefinition}
    />;
};

export default UncertaintyPanel;