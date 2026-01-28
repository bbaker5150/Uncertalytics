/* eslint-disable no-unused-vars */
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
    faRulerCombined
} from "@fortawesome/free-solid-svg-icons";

// Sub-components
import UncertaintyBudgetTable from "./UncertaintyBudgetTable";
import PercentageBarGraph from "./ContributionPlot";
import AnalysisHeader from "./AnalysisHeader";

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
    'Operators': [ { symbol: '+', title: 'Add' }, { symbol: '-', title: 'Subtract' }, { symbol: '*', title: 'Multiply' }, { symbol: '/', title: 'Divide' }, { symbol: '^', title: 'Power' }, { symbol: '()', title: 'Parentheses' }, { symbol: '%', title: 'Percent' } ],
    'Functions': [ { symbol: 'sqrt()', title: 'Square Root' }, { symbol: 'abs()', title: 'Absolute Value' }, { symbol: 'log()', title: 'Log (base 10)' }, { symbol: 'ln()', title: 'Natural Log' }, { symbol: 'exp()', title: 'Exponential' } ],
    'Trigonometry': [ { symbol: 'sin()', title: 'Sine' }, { symbol: 'cos()', title: 'Cosine' }, { symbol: 'tan()', title: 'Tangent' } ],
    'Greek': [ { symbol: 'Δ', title: 'Delta' }, { symbol: 'θ', title: 'Theta' }, { symbol: 'λ', title: 'Lambda' }, { symbol: 'π', title: 'Pi' }, { symbol: 'Ω', title: 'Omega' } ]
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
    if (isEditing) { return ( <input autoFocus type={type} value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} onBlur={handleBlur} onKeyDown={handleKeyDown} placeholder={placeholder} className={className} style={{ width: '100%', padding: '4px', boxSizing: 'border-box', ...style }} /> ) }
    return ( <div onClick={() => setIsEditing(true)} style={{ cursor: 'text', minHeight: '20px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '2px', color: !value && placeholder ? 'var(--text-color-muted)' : 'inherit', ...style }} className={`editable-cell-display ${className}`} title="Click to edit" > {value || placeholder} {suffix} </div> )
};

// --- NEW: Inline Quick Add Row Component ---
const QuickAddRow = ({ selectedUuts, localRangeIndices, resolveRangeHelper, onSave, showAreaColumn, sessionData }) => {
    // Local state for the inputs
    const [val, setVal] = useState("");
    const [unit, setUnit] = useState("");
    const [section, setSection] = useState("");
    const isDisabled = selectedUuts.length === 0;
    
    // Auto-detect unit from selected UUT when selection changes
    useEffect(() => {
        if (selectedUuts.length > 0) {
            const primaryUut = selectedUuts[0];
            const { activeRange } = resolveRangeHelper(primaryUut, localRangeIndices, null, null);
            if (activeRange?.unit && !unit) {
                setTimeout(() => setUnit(activeRange.unit), 0);
            }
        }
    }, [selectedUuts, localRangeIndices, resolveRangeHelper, unit]); 

    // Real-time Preview Calculation
    const previewMetrics = useMemo(() => {
        if (!val) return { display: "-", limits: { low: "-", high: "-" } };

        let activeTolerance = {};
        
        // If UUTs selected, use the first one's active range logic
        if (selectedUuts.length > 0) {
            const primaryUut = selectedUuts[0];
            const nominalObj = { value: val, unit: unit };
            
            // We pass the nominalObj to the helper so it can find the best fitting range if in auto-mode
            const { activeRange } = resolveRangeHelper(primaryUut, localRangeIndices, null, nominalObj);
            activeTolerance = activeRange || {};
        }

        // Calculate limits
        return calculateToleranceMetrics(activeTolerance, { value: val, unit: unit });
    }, [val, unit, selectedUuts, localRangeIndices, resolveRangeHelper]);

    const handleSave = () => {
        if (!val || !unit) return;

        // Determine Measurement Area ID (Robust Lookup)
        let areaId = null;
        if (selectedUuts.length > 0) {
            const primaryUut = selectedUuts[0];
            
            // 1. Direct ID if available
            if (primaryUut.measurementAreaId) {
                areaId = primaryUut.measurementAreaId;
            } 
            // 2. Lookup by Name via sessionData
            else if (primaryUut.measurementArea && sessionData?.measurementAreas) {
                const matchedArea = sessionData.measurementAreas.find(a => a.name === primaryUut.measurementArea);
                if (matchedArea) {
                    areaId = matchedArea.id;
                }
            }
        }

        // Construct payload compatible with onSaveTestPoint
        const newPoint = {
            section: section,
            measurementType: "direct",
            testPointInfo: {
                parameter: { name: "Measurement", value: val, unit: unit }
            },
            associatedUutIds: selectedUuts.map(u => u.id),
            measurementAreaId: areaId
        };

        onSave(newPoint);
        setVal(""); // Reset value for next point
        // Note: We deliberately do NOT reset unit, to facilitate rapid entry of points in the same unit
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
            {/* Section Input */}
            <td className="cell-section" style={{ padding: '4px 8px' }}>
                <input 
                    type="text" 
                    placeholder="Section"
                    value={section}
                    onChange={e => setSection(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isDisabled}
                    className="quick-add-input organic-input"
                    style={{ 
                        width: '100%', 
                        background: 'transparent',
                        border: 'none',
                        padding: '6px 0',
                        fontSize: '0.9rem',
                        color: 'var(--text-color)',
                        outline: 'none',
                        borderBottom: '1px solid transparent',
                        transition: 'border-color 0.2s'
                    }}
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
                    title={isDisabled ? "Select a UUT from the list on the left to enable quick add" : "Enter value and press Enter"}
                    style={{ 
                        width: '100%', 
                        background: 'transparent',
                        border: 'none',
                        padding: '6px 0',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: 'var(--primary-color)',
                        outline: 'none',
                        borderBottom: '1px solid transparent',
                        transition: 'border-color 0.2s'
                    }}
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
                    style={{ 
                        width: '100%', 
                        background: 'transparent',
                        border: 'none',
                        padding: '6px 0',
                        fontSize: '0.9rem',
                        color: 'var(--text-color-muted)',
                        outline: 'none',
                        borderBottom: '1px solid transparent',
                        transition: 'border-color 0.2s'
                    }}
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
                    
                    {/* Action Button (If Area Hidden) */}
                    {!showAreaColumn && !isDisabled && val && (
                        <button 
                            onClick={handleSave}
                            className="btn-icon-only"
                            style={{
                                color: 'var(--primary-color)', 
                                background: 'transparent', 
                                border: 'none', 
                                cursor: 'pointer',
                                marginLeft: '8px'
                            }}
                            title="Save Point (Enter)"
                        >
                            <FontAwesomeIcon icon={faArrowRight} />
                        </button>
                    )}
                </div>
            </td>
            
            {showAreaColumn && (
                <td className="cell-area">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                         <span>{/* Area implies automatic or selected */}</span>
                         {/* Action Button (If Area Shown) */}
                        {!isDisabled && val && (
                            <button 
                                onClick={handleSave}
                                className="btn-icon-only"
                                style={{
                                    color: 'var(--primary-color)', 
                                    background: 'transparent', 
                                    border: 'none', 
                                    cursor: 'pointer'
                                }}
                                title="Save Point (Enter)"
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
const SummaryDashboard = ({ viewMode, contextId, sessionData, onDefineTestPoint, onDeleteTestPoint, rangeData, uutId, onSaveTestPoint, onEditSession }) => {
    
    // Local Selection State for UUTs in the table
    const [selectedUutIds, setSelectedUutIds] = useState([]);
    const [localRangeIndices, setLocalRangeIndices] = useState({});
    
    // Batch Deletion Selection State
    // Batch Deletion Selection State
    const [selectedPointIds, setSelectedPointIds] = useState([]);
    
    // Sorting State
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });

    // Filter Data based on Hierarchy
    const { filteredUuts, filteredPoints, title, subtitle, showAreaColumn } = useMemo(() => {
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
            // --- NEW: Range View Logic ---
            const uut = uuts.find(u => u.id === uutId);
            
            // 1. Filter UUTs: Only the parent UUT
            uuts = uut ? [uut] : [];
            
            // 2. Filter Points: Matches UUT AND Matches Range Characteristics
            points = points.filter(tp => {
                // Must belong to the UUT
                if (!tp.associatedUutIds || !tp.associatedUutIds.includes(uutId)) return false;
                
                // Must match the Range
                const ptTol = tp.uutTolerance;
                if (!ptTol) return false;

                // Match based on key properties (Min/Max/Unit/Function/Index)
                // If range objects have distinct IDs or indices, use them. Otherwise compare props.
                const minMatch = ptTol.min == rangeData.min;
                const maxMatch = ptTol.max == rangeData.max;
                const unitMatch = (ptTol.unit || "") === (rangeData.unit || "");
                const funcMatch = rangeData.functionName ? ptTol.functionName === rangeData.functionName : true;
                
                return minMatch && maxMatch && unitMatch && funcMatch;
            });

            // 3. Set Titles
            displayTitle = rangeData.label || "Range Detail";
            displaySubtitle = `${uut?.description || 'UUT'} (${uut?.model || ''})`;
        }
        else if (isSessionView) {
            displayTitle = sessionData.name || "Session Overview";
            displaySubtitle = `Last Modified: ${new Date().toLocaleDateString()}`; 
        }

        // SORTING LOGIC
        if (sortConfig.key) {
             points.sort((a, b) => {
                let aVal = '', bVal = '';

                if (sortConfig.key === 'section') {
                    aVal = (a.section || '').toLowerCase();
                    bVal = (b.section || '').toLowerCase();
                } else if (sortConfig.key === 'point') {
                    // Try numeric sort
                    const aNum = parseFloat(a.testPointInfo?.parameter?.value);
                    const bNum = parseFloat(b.testPointInfo?.parameter?.value);
                    if (!isNaN(aNum) && !isNaN(bNum)) {
                        aVal = aNum;
                        bVal = bNum;
                    } else {
                        aVal = (a.testPointInfo?.parameter?.value || '').toString().toLowerCase();
                        bVal = (b.testPointInfo?.parameter?.value || '').toString().toLowerCase();
                    }
                } else if (sortConfig.key === 'area') {
                     // Resolve Area Name
                     const areaA = sessionData.measurementAreas?.find(ar => ar.id === a.measurementAreaId);
                     const areaB = sessionData.measurementAreas?.find(ar => ar.id === b.measurementAreaId);
                     aVal = (areaA?.name || '').toLowerCase();
                     bVal = (areaB?.name || '').toLowerCase();
                }

                if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
             });
        }

        return { 
            filteredUuts: uuts, 
            filteredPoints: points, 
            title: displayTitle, 
            subtitle: displaySubtitle,
            showAreaColumn: isSessionView // Boolean flag
        };
    }, [viewMode, contextId, sessionData, rangeData, uutId, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending'
        }));
    };

    // Pre-select UUT if in single UUT or Range view
    useEffect(() => {
        if (viewMode === 'uut' || viewMode === 'range') {
            const targetId = viewMode === 'range' ? uutId : contextId;
            if (targetId && !selectedUutIds.includes(targetId)) {
                setTimeout(() => setSelectedUutIds([targetId]), 0);
            }
        }
    }, [viewMode, contextId, uutId, selectedUutIds]);

    const handleUutSelect = (id) => {
        setSelectedUutIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleAddPoint = () => {
        if (onDefineTestPoint) {
            // If in Range View, auto-pass UUT and Range
            if (viewMode === 'range') {
                onDefineTestPoint([uutId], rangeData);
            } else {
                onDefineTestPoint(selectedUutIds);
            }
        }
    };
    
    // --- BATCH DELETE HANDLERS ---
    const handleBatchDelete = useCallback(() => {
        if (selectedPointIds.length === 0) return;
        if (onDeleteTestPoint) {
            onDeleteTestPoint(selectedPointIds, false); 
            setSelectedPointIds([]);
        }
    }, [selectedPointIds, onDeleteTestPoint]);

    // NEW: Handle Row Selection via Click and Modifiers (Ctrl/Meta)
    const handleRowClick = (e, id) => {
        if (e.ctrlKey || e.metaKey) {
            // Toggle selection if modifier key is held
            setSelectedPointIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
        } else {
            // Single select if simply clicked
            setSelectedPointIds([id]);
        }
    };

    // NEW: Keyboard Listener for Delete
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPointIds.length > 0) {
                // Prevent backspace from navigating back if not in an input
                if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                     e.preventDefault();
                     handleBatchDelete();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedPointIds, onDeleteTestPoint, handleBatchDelete]);

    // Wrapper for the helper to pass to QuickAddRow
    const resolveRangeWrapper = (uut, indices, savedTol, nominal) => {
        return resolveUutRangeHelper(uut, indices, savedTol, nominal);
    };

    const cardStyle = { backgroundColor: 'var(--content-background)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
    const headerStyle = { padding: '12px 16px', backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };

    return (
        <div className="configuration-panel" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            {/* Session Header (Only in Session View) */}
            {viewMode === 'session' && (
                <AnalysisHeader 
                    sessionData={sessionData} 
                    onEditSession={onEditSession} 
                />
            )}

            {/* Header */}
            <div style={{ paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem' }}>
                    {viewMode === 'range' && <FontAwesomeIcon icon={faRulerCombined} style={{marginRight: '10px', color:'var(--primary-color)'}} />}
                    {title}
                </h2>
                <div style={{ color: 'var(--text-color-muted)', fontSize: '0.9rem', marginTop: '4px' }}>{subtitle}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                
                {/* UUT TABLE */}
                <div style={cardStyle}>
                    <div style={headerStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FontAwesomeIcon icon={faMicroscope} />
                            <span>Units Under Test ({filteredUuts.length})</span>
                        </div>
                        {selectedUutIds.length > 0 && (
                             <span style={{fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 600}}>{selectedUutIds.length} Selected</span>
                        )}
                    </div>
                    <div className="panel-table-container" style={{ overflowX: 'auto', borderRadius: '8px', border: 'none' }}>
                        <table className="instrument-summary-table compact-table" style={{ margin: 0, border: 'none', boxShadow: 'none', width: '100%', minWidth: '100%', tableLayout: 'fixed' }}>
                            <colgroup>
                                <col style={{ width: '4%' }} />
                                <col style={{ width: showAreaColumn ? '30%' : '38%' }} />
                                <col style={{ width: showAreaColumn ? '26%' : '30%' }} />
                                <col style={{ width: showAreaColumn ? '25%' : '28%' }} />
                                {showAreaColumn && <col style={{ width: '15%' }} />}
                            </colgroup>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                <tr>
                                    <th className="cell-compact" style={{ textAlign: 'center' }}>
                                        <div style={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                           {/* Header Checkbox could go here */}
                                        </div>
                                    </th>
                                    <th>Description</th>
                                    <th>Range</th>
                                    <th>Specification</th>
                                    {showAreaColumn && <th>Area</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUuts.length === 0 ? (
                                    <tr><td colSpan={showAreaColumn ? 5 : 4} style={{ padding: '20px', textAlign: 'center', fontStyle: 'italic', color: 'var(--text-color-muted)' }}>No UUTs found in this context.</td></tr>
                                ) : (
                                    filteredUuts.map(uut => {
                                        let resolution = resolveUutRangeHelper(uut, localRangeIndices, null, null);
                                        
                                        // override if in Range View mode
                                        if (viewMode === 'range' && rangeData) {
                                            const matchIndex = resolution.ranges.findIndex(r => {
                                                if (rangeData._id !== undefined && r._index !== undefined) {
                                                    // This might be fragile if indices drift, but usually consistent
                                                    return r._index === rangeData._id; 
                                                }
                                                // Fallback to properties match
                                                const minMatch = r.min == rangeData.min;
                                                const maxMatch = r.max == rangeData.max;
                                                const unitMatch = (r.unit || "") === (rangeData.unit || "");
                                                const funcMatch = rangeData.functionName ? r.functionName === rangeData.functionName : true;
                                                return minMatch && maxMatch && unitMatch && funcMatch;
                                            });

                                            if (matchIndex !== -1) {
                                                const matched = resolution.ranges[matchIndex];
                                                resolution = { ranges: [matched], activeIndex: 0, activeRange: matched };
                                            }
                                        }

                                        // override if a Single Measurement Point is Selected
                                        if (selectedPointIds.length === 1) {
                                            const activePoint = filteredPoints.find(p => p.id === selectedPointIds[0]);
                                            
                                            // Ensure point is linked to this UUT and has a valid saved tolerance
                                            if (activePoint && 
                                                activePoint.associatedUutIds && 
                                                activePoint.associatedUutIds.includes(uut.id) &&
                                                activePoint.uutTolerance && 
                                                Object.keys(activePoint.uutTolerance).length > 0) 
                                            {
                                                const targetTol = activePoint.uutTolerance;
                                                
                                                // Find matching range in the UUT's definition
                                                const matchIndex = resolution.ranges.findIndex(r => {
                                                    // 1. Precise Match (ID/Index)
                                                    if (targetTol._index !== undefined && r._index !== undefined && targetTol._index === r._index) return true;
                                                    if (targetTol.id && r.id && targetTol.id === r.id) return true;

                                                    // 2. Prop Match
                                                    const minMatch = r.min == targetTol.min;
                                                    const maxMatch = r.max == targetTol.max;
                                                    const unitMatch = (r.unit || "") === (targetTol.unit || "");
                                                    const funcMatch = targetTol.functionName ? r.functionName === targetTol.functionName : true;
                                                    return minMatch && maxMatch && unitMatch && funcMatch;
                                                });

                                                if (matchIndex !== -1) {
                                                    // Set active index to this range, so dropdown updates to show it
                                                    resolution.activeIndex = matchIndex;
                                                    resolution.activeRange = resolution.ranges[matchIndex];
                                                }
                                            }
                                        }

                                        const { ranges, activeIndex, activeRange } = resolution;
                                        const specSummary = getToleranceSummary(activeRange);
                                        const hasMultipleRanges = ranges.length > 1;
                                        const isChecked = selectedUutIds.includes(uut.id);

                                        // Lookup Area Name & Color
                                        // Robust Lookup: Match ID OR Name
                                        const area = sessionData.measurementAreas?.find(a => a.id === uut.measurementAreaId || a.name === uut.measurementArea);
                                        const areaName = area ? area.name : (uut.measurementArea || '-');
                                        const areaColor = area?.color || 'var(--text-color-muted)';

                                        return (
                                            <tr key={uut.id} className={isChecked ? "selected-row" : ""} style={{ backgroundColor: isChecked ? 'rgba(var(--primary-rgb), 0.05)' : 'transparent' }}>
                                                <td className="cell-compact" style={{ textAlign: 'center' }}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isChecked} 
                                                        onChange={() => handleUutSelect(uut.id)}
                                                        style={{ cursor: 'pointer', width: '16px', height: '16px' }} 
                                                    />
                                                </td>
                                                <td className="cell-description" style={{ 
                                                    fontWeight: 600, 
                                                    color: isChecked ? 'var(--primary-color)' : 'var(--text-color)',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    maxWidth: 0
                                                }} title={uut.description}>
                                                    {uut.description}
                                                </td>
                                                <td className="cell-value">
                                                    {hasMultipleRanges ? (
                                                        <select
                                                            className="session-selector"
                                                            style={{ 
                                                                width: '100%', 
                                                                padding: '4px 8px',
                                                                fontSize: '0.85rem'
                                                            }}
                                                            value={activeIndex}
                                                            onChange={(e) => setLocalRangeIndices(prev => ({...prev, [uut.id]: parseInt(e.target.value)}))}
                                                        >
                                                            {ranges.map((range, idx) => {
                                                                const rangeLabel = (typeof range.range === 'string' ? range.range : null) || 
                                                                                   (range.min !== undefined && range.max !== undefined ? `${range.min} to ${range.max}` : "Full Range");
                                                                const unitLabel = typeof range.unit === 'string' ? range.unit : '';
                                                                return <option key={idx} value={idx}>{`${rangeLabel} ${unitLabel}`}</option>
                                                            })}
                                                        </select>
                                                    ) : (
                                                       <span style={{ fontSize: '0.85rem', color: 'var(--text-color-muted)' }}>
                                                            {(() => {
                                                                const r = ranges[0];
                                                                if (!r) return "Default";
                                                                const rangeLabel = (r.min !== undefined && r.max !== undefined ? `${r.min} to ${r.max}` : null) 
                                                                                || (typeof r.range === 'string' ? r.range : "Full Range");
                                                                const unitLabel = typeof r.unit === 'string' ? r.unit : '';
                                                                return `${rangeLabel} ${unitLabel}`;
                                                            })()}
                                                       </span>
                                                    )}
                                                </td>
                                                <td className="cell-tolerance" style={{
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    maxWidth: 0
                                                }} title={specSummary}>
                                                    {specSummary}
                                                </td>
                                                {showAreaColumn && (
                                                    <td className="cell-area" style={{
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        maxWidth: 0
                                                    }} title={areaName}>
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

                {/* MEASUREMENT POINTS TABLE (UPDATED: NO CHECKBOXES, CTRL CLICK SELECT) */}
                <div style={cardStyle}>
                    <div style={headerStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FontAwesomeIcon icon={faCube} />
                            <span>Measurement Points ({filteredPoints.length})</span>
                        </div>
                        
                        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                            {selectedPointIds.length > 0 && (
                                <button 
                                    className="btn-icon-only delete" 
                                    style={{
                                        color: 'var(--status-bad)', 
                                        width: '24px', 
                                        height: '24px', 
                                        borderRadius: '4px', 
                                        opacity: 1, 
                                        border: '1px solid rgba(255,82,82,0.3)',
                                        marginRight: '8px'
                                    }}
                                    onClick={handleBatchDelete}
                                    title={`Delete ${selectedPointIds.length} Selected Points`}
                                >
                                    <FontAwesomeIcon icon={faTrashAlt} size="xs" />
                                </button>
                            )}
                            <button 
                                className="btn-icon-only" 
                                style={{backgroundColor: 'var(--primary-color)', color: '#fff', width: '24px', height: '24px', borderRadius: '4px'}}
                                onClick={handleAddPoint}
                                title={viewMode === 'range' ? "Add Point to this Range" : "Add Measurement Point (uses selected UUTs)"}
                            >
                                <FontAwesomeIcon icon={faPlus} size="xs" />
                            </button>
                        </div>
                    </div>
                    <div className="panel-table-container" tabIndex="0">
                        <table className="instrument-summary-table compact-table" style={{ margin: 0, border: 'none', boxShadow: 'none' }}>
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('section')} style={{ cursor: 'pointer' }}>
                                        Section {sortConfig.key === 'section' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                                    </th>
                                    <th onClick={() => handleSort('point')} style={{ cursor: 'pointer' }}>
                                        Point {sortConfig.key === 'point' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                                    </th>
                                    <th>Unit</th>
                                    <th>Tolerance</th>
                                    <th>Limits</th>
                                    {showAreaColumn && (
                                        <th onClick={() => handleSort('area')} style={{ cursor: 'pointer' }}>
                                            Area {sortConfig.key === 'area' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {/* --- NEW: QUICK ADD ROW --- */}
                                <QuickAddRow 
                                    selectedUuts={sessionData.uuts.filter(u => selectedUutIds.includes(u.id))}
                                    localRangeIndices={localRangeIndices}
                                    resolveRangeHelper={resolveRangeWrapper}
                                    onSave={onSaveTestPoint}
                                    showAreaColumn={showAreaColumn}
                                    sessionData={sessionData} // <--- PASSING SESSION DATA FOR AREA LOOKUP
                                />

                                {filteredPoints.length === 0 ? (
                                    /* No message here anymore, just empty rows below QuickAddRow */
                                    null
                                ) : (
                                    filteredPoints.map(tp => {
                                        const param = tp.testPointInfo?.parameter || { value: '', unit: '' };
                                        const isSelected = selectedPointIds.includes(tp.id);
                                        
                                        // 1. Determine Tolerance
                                        let activeTolerance = tp.uutTolerance;
                                        if ((!activeTolerance || Object.keys(activeTolerance).length === 0) && tp.associatedUutIds?.length > 0) {
                                            const uut = sessionData.uuts?.find(u => u.id === tp.associatedUutIds[0]);
                                            if (uut) {
                                                const { activeRange } = resolveUutRangeHelper(uut, null, null, param);
                                                activeTolerance = activeRange;
                                            }
                                        }

                                        // 2. Metrics
                                        const { limits, display } = calculateToleranceMetrics(activeTolerance, param);

                                        // 3. Area & Color
                                        const area = sessionData.measurementAreas?.find(a => a.id === tp.measurementAreaId);
                                        const areaName = area ? area.name : '-';
                                        const areaColor = area?.color || 'var(--text-color-muted)';

                                        return (
                                            <tr 
                                                key={tp.id} 
                                                className={isSelected ? "selected-row" : ""}
                                                onClick={(e) => handleRowClick(e, tp.id)}
                                                style={{ 
                                                    backgroundColor: isSelected ? 'rgba(var(--primary-rgb), 0.15)' : 'transparent',
                                                    borderLeft: isSelected ? '4px solid var(--primary-color)' : '4px solid transparent',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.1s ease'
                                                }}
                                            >
                                                <td className="cell-section" title={tp.section || '-'}>{tp.section || '-'}</td>
                                                <td className="cell-value" title={String(param.value)}>{param.value}</td>
                                                <td className="cell-unit" title={param.unit}>{param.unit}</td>
                                                <td className="cell-tolerance" title={display}>{display}</td>
                                                <td className="cell-limit" title={`${limits.low} to ${limits.high}`}>
                                                    <span style={{ opacity: 0.7 }}>{limits.low}</span>
                                                    <span style={{ margin: '0 4px', color: 'var(--text-color-muted)', fontSize: '0.75rem' }}>→</span>
                                                    <span style={{ opacity: 0.7 }}>{limits.high}</span>
                                                </td>
                                                {showAreaColumn && (
                                                    <td className="cell-area" style={{ color: areaColor }} title={areaName}>{areaName}</td>
                                                )}
                                            </tr>
                                        )
                                    })
                                )}
                                {filteredPoints.length === 0 && (
                                     <tr><td colSpan={showAreaColumn ? 6 : 5} style={{ padding: '20px', textAlign: 'center', fontStyle: 'italic', color: 'var(--text-color-muted)' }}>No Measurement Points found. Use the input row above to add one.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            {/* Guidance Footer */}
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
}) {

    // --- DETAILED VIEW LOGIC ---

    

    const [isSymbolMenuOpen, setIsSymbolMenuOpen] = useState(false);

    const equationInputRef = useRef(null);

    const symbolMenuRef = useRef(null);

    const symbolButtonRef = useRef(null);


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


    // Use Shared Helper, but inject parent state (activeRangeIndices)
    const resolveUutRange = useCallback((uut) => {
        return resolveUutRangeHelper(uut, activeRangeIndices, uutToleranceData, uutNominal);
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
    const activeArea = sessionData.measurementAreas?.find(a => a.id === activeMeasurementAreaId);

    // --- REFINED RELEVANT UUTS LOGIC (UPDATED: FILTER TO SINGLE UUT IF POINT EXISTS) ---

    const relevantUuts = useMemo(() => {
        if (!sessionData.uuts) return [];

        // 1. Specific Point View: Show ONLY linked UUT(s)
        if (testPointData.id && testPointData.associatedUutIds?.length > 0) {
             return sessionData.uuts.filter(u => testPointData.associatedUutIds.includes(u.id));
        }

        // 2. New Point / Unassigned: Show all UUTs in the active Area
        return sessionData.uuts.filter(u => {
            const idMatch = u.measurementAreaId === activeMeasurementAreaId;
            const nameMatch = activeArea && u.measurementArea === activeArea.name;
            return idMatch || nameMatch;
        });
    }, [sessionData.uuts, activeMeasurementAreaId, activeArea, testPointData]);

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

        const isLinkedToPoint = testPointData.associatedUutIds && testPointData.associatedUutIds.includes(uutId);

        if (isLinkedToPoint && onUpdateTestPoint) {
            const selectedRange = ranges[newIndex];
            onUpdateTestPoint({ uutTolerance: selectedRange });
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

        // SIMPLIFIED DELETE LOGIC: Direct delete, no UUT selection required
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
                const newInstance = { ...sourceTmde, quantity: 1 };
                const newTolerances = [...tmdeTolerancesData, newInstance];
                onUpdateTestPoint({ tmdeTolerances: newTolerances });
            }
        } else {
            const newTolerances = tmdeTolerancesData.filter(t => t.id !== tmdeId);
            onUpdateTestPoint({ tmdeTolerances: newTolerances });
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

    // --- Active Tolerance Calculation ---
    const primaryUutId = testPointData.associatedUutIds?.[0];
    const primaryUut = relevantUuts.find(u => u.id === primaryUutId);


    const activeResolvedTolerance = useMemo(() => {
        if (!primaryUut) return uutToleranceData;

        // Pass 1: Resolve Active Range
        const { activeRange } = resolveUutRange(primaryUut);

        return (activeRange && Object.keys(activeRange).length > 0) ? activeRange : uutToleranceData;
    }, [primaryUut, resolveUutRange, uutToleranceData]); // Re-run when resolveUutRange changes

    // --- FIX 2: Auto-Save Active Range ---

    useEffect(() => {
        if (activeResolvedTolerance && uutToleranceData) {
            // Check if the auto-resolved tolerance differs from what is saved
            const isDifferent = 
                activeResolvedTolerance.range !== uutToleranceData.range ||
                activeResolvedTolerance.min != uutToleranceData.min ||
                activeResolvedTolerance.max != uutToleranceData.max ||
                activeResolvedTolerance.unit !== uutToleranceData.unit;

            if (isDifferent && onUpdateTestPoint) {
                // Auto-save the new range so UI and Backend stay in sync
                onUpdateTestPoint({ uutTolerance: activeResolvedTolerance });
            }
        }
    }, [activeResolvedTolerance, uutToleranceData, onUpdateTestPoint]);


    // (unused numericTotalTolerance removed)

    // --- DISPLAY 1: Tolerance String ---

    const calculatedToleranceDisplay = useMemo(() => {
        const result = calculateToleranceMetrics(activeResolvedTolerance, uutNominal);
        return result.display;
    }, [activeResolvedTolerance, uutNominal]);

    // --- DISPLAY 2: Limits ---

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
                                                    {/* Better Empty State Message */}
                                                    No associated UUTs found.
                                                </td>
                                            </tr>
                                        ) : (
                                            relevantUuts.map((uut) => {
                                                const { ranges, activeIndex, activeRange } = resolveUutRange(uut);
                                                const specSummary = getToleranceSummary(activeRange);
                                                const hasMultipleRanges = ranges.length > 1;

                                                const isLinked = testPointData.associatedUutIds && testPointData.associatedUutIds.includes(uut.id);

                                                return (
                                                    <tr key={uut.id} style={{
                                                        backgroundColor: 'transparent',
                                                        borderLeft: isLinked ? '4px solid var(--primary-color)' : '4px solid transparent'
                                                    }}>
                                                        {/* Removed Checkbox Column */}
                                                        <td className="no-hover-cell" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0 }} title={uut.description}>
                                                            <div style={{ fontWeight: 600, color: isLinked ? 'var(--primary-color)' : 'var(--text-color)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {uut.description}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {hasMultipleRanges ? (
                                                                <select
                                                                    className="session-selector" 
                                                                    style={{ 
                                                                        width: '100%',
                                                                        padding: '4px 8px',
                                                                        fontSize: '0.85rem'
                                                                    }}
                                                                    value={activeIndex}
                                                                    onChange={(e) => handleRangeChange(uut.id, parseInt(e.target.value, 10), ranges)}
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
                                                            ) : (
                                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-color-muted)' }}>
                                                                    {(() => {
                                                                        const r = ranges[0];
                                                                        if (!r) return "-";
                                                                        let rangeText = (typeof r.range === 'string' ? r.range : null);
                                                                        if (!rangeText) {
                                                                            if (r.min !== undefined && r.max !== undefined) {
                                                                                rangeText = `${r.min} to ${r.max}`;
                                                                            } else {
                                                                                rangeText = "Full Range";
                                                                            }
                                                                        }
                                                                        return `${rangeText} ${r.unit || ''}`;
                                                                    })()}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="no-hover-cell" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0 }} title={specSummary}>
                                                            <span style={{ fontSize: '0.85rem' }}>
                                                                {specSummary}
                                                            </span>
                                                        </td>
                                                    </tr>
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
                    {/* 3. MEASUREMENT POINT TABLE */}
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
                                                {/* 1. Section */}
                                                <td style={{ paddingLeft: '20px' }}>
                                                    <div style={{ fontWeight: 600, color: 'var(--text-color)' }}>
                                                        <EditableCell
                                                            value={testPointData.section}
                                                            onSave={(val) => onUpdateTestPoint && onUpdateTestPoint({ section: val })}
                                                            placeholder="General"
                                                        />
                                                    </div>
                                                </td>

                                                {/* 2. Point */}
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

                                                {/* 2. Unit - MOVED */}
                                                <td>
                                                    <div style={{ fontWeight: 600, paddingLeft: '4px' }}>
                                                        {uutNominal?.unit}
                                                    </div>
                                                </td>

                                                {/* 3. Tolerance */}
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

                                                {/* 4. Low Limit */}
                                                <td>
                                                    <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-color)' }}>
                                                        {calculatedLimits.low}
                                                    </span>
                                                </td>

                                                {/* 5. High Limit */}
                                                <td>
                                                    <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-color)' }}>
                                                        {calculatedLimits.high}
                                                    </span>
                                                </td>

                                                {/* 6. Actions */}
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

            {/* --- MIDDLE ROW: EQUATION (Full Width) --- */}
            <div style={{ marginBottom: '30px' }}>
{/* Equation Editor */}
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

            {/* --- BOTTOM ROW: TMDEs (Full Width) --- */}
            <div style={{ marginBottom: '30px' }}>
{/* 2. TMDE LIST */}
                    <div>
                        <h3 style={sectionTitleStyle}>Measurement Standards (TMDE)</h3>
                        <div style={cardStyle}>
                            <div className="panel-table-container" style={{ margin: 0, border: 'none', boxShadow: 'none', borderRadius: '8px', flex: 1 }}>
                                <table className="instrument-summary-table compact-table" style={{ width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'center' }}>Use</th>
                                            <th style={{ paddingLeft: '10px' }}>Description</th>
                                            {isDerived && <th>Input Var</th>}
                                            <th>Meas. Point</th>
                                            <th>Tolerance</th>
                                            <th>Std. Unc (k=1)</th>
                                            <th>Limits</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(!sessionData.tmdes || sessionData.tmdes.length === 0) ? (
                                            <tr>
                                                <td colSpan={isDerived ? "7" : "6"} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-color-muted)', fontStyle: 'italic' }}>
                                                    No TMDEs defined in Session.
                                                </td>
                                            </tr>
                                        ) : (
                                            sessionData.tmdes.map((masterTmde) => {
                                                const activeInstances = tmdeTolerancesData.filter(t => t.id === masterTmde.id || (t.sourceId && t.sourceId === masterTmde.id));
                                                const rowsToRender = activeInstances.length > 0 ? activeInstances : [masterTmde];

                                                return rowsToRender.map((tmdeInstance, idx) => {
                                                    const isChecked = activeInstances.includes(tmdeInstance);
                                                    const referencePoint = tmdeInstance.measurementPoint || { value: '', unit: '' };
                                                    const isError = !referencePoint.value || !referencePoint.unit;

                                                    const displayValue = isChecked ? referencePoint.value : '';
                                                    const displayUnit = isChecked ? referencePoint.unit : (masterTmde.measurementPoint?.unit || '');

                                                    let stdUncDisplay = "-";
                                                    if (isChecked && !isError) {
                                                        const { standardUncertainty: uPpm } = calculateUncertaintyFromToleranceObject(tmdeInstance, referencePoint);
                                                        const uAbs = convertPpmToUnit(uPpm, referencePoint.unit, referencePoint);
                                                        stdUncDisplay = typeof uAbs === "number" ? `${uAbs.toPrecision(3)}` : uAbs;
                                                    }

                                                    return (
                                                        <tr key={`${masterTmde.id}-${idx}`} className="tmde-row" style={{ opacity: isChecked ? 1 : 0.7 }}>
                                                            <td style={{ textAlign: 'center' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={(e) => handleToggleTmdeUsage(masterTmde.id, e.target.checked)}
                                                                    style={{ cursor: 'pointer' }}
                                                                />
                                                            </td>
                                                            <td className="cell-description" style={{ paddingLeft: '10px' }}>
                                                                <div style={{ fontWeight: 600, color: 'var(--text-color)' }}>
                                                                    {masterTmde.name || masterTmde.description}
                                                                </div>
                                                            </td>
                                                            {isDerived && (
                                                                <td>
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
                                                            <td>
                                                                {isChecked ? (
                                                                    <EditableCell
                                                                        value={displayValue}
                                                                        suffix={displayUnit}
                                                                        onSave={(val) => onInlineTmdeUpdate && onInlineTmdeUpdate(tmdeInstance.id, 'nominal', val)}
                                                                        type="number"
                                                                    />
                                                                ) : "-"}
                                                            </td>
                                                            <td>{getToleranceSummary(masterTmde)}</td>
                                                            <td>
                                                                {stdUncDisplay} <span style={{ fontSize: '0.8rem', color: 'var(--text-color-muted)' }}>{(!isError && isChecked) ? referencePoint.unit : ''}</span>
                                                            </td>
                                                            <td>
                                                                {(isChecked && !isError) ? (
                                                                    <div className="limits-cell">
                                                                        <span className="limit-val">{getAbsoluteLimits(tmdeInstance, referencePoint).low}</span>
                                                                        <span className="limit-sep">to</span>
                                                                        <span className="limit-val">{getAbsoluteLimits(tmdeInstance, referencePoint).high}</span>
                                                                    </div>
                                                                ) : "-"}
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

            {/* --- UNCERTAINTY BUDGET & GRAPH --- */}
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
};



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
            />
        );
    }

    return <DetailedView {...props} />;
};

export default UncertaintyPanel;