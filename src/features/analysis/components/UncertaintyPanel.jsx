import React, { useState, useEffect, useMemo, useRef } from "react";
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

const customUnitSelectStyles = {
    control: (provided) => ({
        ...provided,
        minHeight: '28px',
        height: '28px',
        width: '100px',
        fontSize: '0.8rem',
        border: 'none',
        backgroundColor: 'transparent',
        boxShadow: 'none',
        cursor: 'pointer',
        textAlign: 'right'
    }),
    valueContainer: (provided) => ({
        ...provided,
        height: '28px',
        padding: '0 4px',
        justifyContent: 'flex-end'
    }),
    input: (provided) => ({
        ...provided,
        margin: 0,
        padding: 0,
        color: 'var(--text-color)'
    }),
    singleValue: (provided) => ({
        ...provided,
        color: 'var(--text-color-muted)',
        fontWeight: 600
    }),
    indicatorsContainer: (provided) => ({
        ...provided,
        height: '28px',
    }),
    dropdownIndicator: (provided) => ({
        ...provided,
        padding: '2px',
        color: 'var(--text-color-muted)'
    }),
    indicatorSeparator: () => ({ display: 'none' }),
    menu: (provided) => ({
        ...provided,
        backgroundColor: 'var(--content-background)',
        border: '1px solid var(--border-color)',
        zIndex: 9999,
        width: '180px',
        right: 0
    }),
    groupHeading: (provided) => ({
        ...provided,
        color: 'var(--primary-color)',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        padding: '8px 12px 4px'
    }),
    option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isSelected
            ? 'var(--primary-color)'
            : state.isFocused
                ? 'var(--hover-background)'
                : 'transparent',
        color: state.isSelected ? '#fff' : 'var(--text-color)',
        fontSize: '0.8rem',
        cursor: 'pointer',
        textAlign: 'left',
        paddingLeft: '20px'
    })
};

const EditableCell = ({ value, onSave, type = "text", suffix = "", style = {}, placeholder = "", className = "" }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);

    useEffect(() => { setCurrentValue(value); }, [value]);

    const handleBlur = () => {
        setIsEditing(false);
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
    uutToleranceData: propUutToleranceData,
    tmdeTolerancesData,
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
    onDefineTestPoint,
    onShowDerivedBreakdown,
    onShowRiskBreakdown,
    showContribution,
    setShowContribution,
    onOpenRepeatability,
    onUpdateTestPoint,
    riskResults,
    setNotification,
    selectedTmdeIds = [],
    onToggleTmdeSelection,
    onToggleAllTmdes,
    onToggleUut,
    onDeleteTestPoint,
    currentUutSelection = [],
    activeRangeIndices = {},
    onRangeSelectionChange,
}) => {

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


    // --- FIX 1: Smart Auto-Ranging Logic ---
    const resolveUutRange = (uut) => {
        // 1. Normalize Ranges
        let ranges = [];
        if (Array.isArray(uut.ranges) && uut.ranges.length > 0) {
            ranges = uut.ranges.map(r => ({ ...r, ...(r.tolerances || r.tolerance || {}) }));
        } else if (Array.isArray(uut.instrument?.functions) && uut.instrument.functions.length > 0) {
            ranges = uut.instrument.functions.flatMap(fn =>
                (fn.ranges || []).map(r => ({
                    ...r,
                    ...(r.tolerances || {}),
                    functionName: fn.name,
                    unit: fn.unit || r.unit
                }))
            );
        } else if (Array.isArray(uut.instrument?.ranges) && uut.instrument.ranges.length > 0) {
            ranges = uut.instrument.ranges.map(r => ({ ...r, ...(r.tolerances || {}) }));
        } else {
            const baseTolerance = uut.tolerance || uut.instrument?.tolerance || {};
            ranges = [{ id: 'default', range: 'Default', ...baseTolerance }];
        }

        ranges = ranges.map((r, i) => ({ ...r, _index: i }));

        // 2. Determine Active Index
        let activeIndex = -1;
        const hasSavedIds = testPointData.associatedUutIds && testPointData.associatedUutIds.includes(uut.id);
        const savedTolerance = uutToleranceData;

        // Helper: does range R match the current value?
        const doesRangeFit = (r) => {
            const val = parseFloat(uutNominal?.value);
            if (isNaN(val)) return false; // If no value typed, we can't fit-check
            
            const min = parseFloat(r.min);
            const max = parseFloat(r.max);
            
            // Loose Unit Check
            const unitMatch = !r.unit || !uutNominal?.unit || r.unit.toLowerCase() === uutNominal.unit.toLowerCase();
            if (!unitMatch) return false;

            if (!isNaN(min) && !isNaN(max)) {
                return val >= min && val <= max;
            }
            return false; 
        };

        // A. Priority: Manual Selection / Saved Selection
        let candidateIndex = -1;
        if (activeRangeIndices[uut.id] !== undefined) {
            candidateIndex = activeRangeIndices[uut.id];
        } else if (hasSavedIds && savedTolerance) {
             // Find saved index by comparison
             candidateIndex = ranges.findIndex(r => {
                if (savedTolerance.range && r.range) {
                    if (savedTolerance.range !== r.range) return false;
                    return savedTolerance.functionName ? savedTolerance.functionName === r.functionName : true;
                }
                const minMatch = r.min == savedTolerance.min;
                const maxMatch = r.max == savedTolerance.max;
                const unitMatch = (r.unit || "") === (savedTolerance.unit || "");
                return minMatch && maxMatch && unitMatch;
            });
        }

        // B. Validate Candidate: If we have a candidate, does it actually fit the value?
        // If the user has typed a value, and the candidate range DOES NOT fit, discard candidate.
        // This ensures "0.7V" breaks out of a "0-0.5V" selection.
        const userHasValue = !isNaN(parseFloat(uutNominal?.value));
        if (candidateIndex !== -1 && userHasValue) {
            if (!doesRangeFit(ranges[candidateIndex])) {
                candidateIndex = -1; // Discard invalid selection to force auto-search
            }
        }

        // C. Auto-Search: If no valid candidate, find one that fits.
        if (candidateIndex === -1 && userHasValue) {
            candidateIndex = ranges.findIndex(r => doesRangeFit(r));
        }

        // D. Fallback: If still nothing, default to 0
        if (candidateIndex === -1) candidateIndex = 0;

        activeIndex = candidateIndex;

        return { ranges, activeIndex, activeRange: ranges[activeIndex] || {} };
    };

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

    const relevantUuts = useMemo(() => {
        if (!sessionData.uuts) return [];
        return sessionData.uuts.filter(u => {
            const idMatch = u.measurementAreaId === activeMeasurementAreaId;
            const nameMatch = activeArea && u.measurementArea === activeArea.name;
            return idMatch || nameMatch;
        });
    }, [sessionData.uuts, activeMeasurementAreaId, activeArea]);

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

        if (currentUutSelection.length === 0) {
            setNotification({
                title: "No UUTs Selected",
                message: "Please select at least one UUT to remove the measurement point from.",
                isIconConfirm: false
            });
            return;
        }

        const uutsToRemove = currentUutSelection;
        const remainingUuts = associatedUutIds.filter(id =>
            !uutsToRemove.some(remId => String(remId) === String(id))
        );
        const isRemovingFromAll = remainingUuts.length === 0;

        setNotification({
            title: isRemovingFromAll ? "Delete Measurement Point" : "Unassign Measurement Point",
            message: isRemovingFromAll
                ? "This will permanently delete the measurement point from all UUTs."
                : `This will remove the measurement point from ${uutsToRemove.length} UUT(s).`,
            confirmText: isRemovingFromAll ? "Delete" : "Unassign",
            isIconConfirm: isRemovingFromAll,
            onConfirm: () => {
                if (isRemovingFromAll) {
                    onDeleteTestPoint(testPointData.id);
                } else {
                    onUpdateTestPoint({ associatedUutIds: remainingUuts });
                }
                uutsToRemove.forEach(id => onToggleUut(id));
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
                node.traverse(function (node, path, parent) {
                    if (node.isSymbolNode && !math[node.name] && !['e', 'pi', 'i'].includes(node.name.toLowerCase())) {
                        varsSet.add(node.name);
                    }
                });
                variables = Array.from(varsSet).sort();
            }
        } catch (e) { }

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

    const mainGridStyle = { display: 'flex', flexWrap: 'wrap', gap: '20px', width: '100%', alignItems: 'flex-start', marginBottom: '30px' };
    const verticalColumnStyle = { flex: '1 1 600px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' };
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
    }, [primaryUut, activeRangeIndices, uutToleranceData, uutNominal]); // Re-run when uutNominal changes

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


    const numericTotalTolerance = useMemo(() => {
        if (!activeResolvedTolerance || Object.keys(activeResolvedTolerance).length === 0) return null;

        const nominalVal = parseFloat(uutNominal?.value);
        if (isNaN(nominalVal)) return null;

        // --- BUG FIX 1 REVISITED: Check if Point is within Range ---
        const rMin = parseFloat(activeResolvedTolerance.min);
        const rMax = parseFloat(activeResolvedTolerance.max);
        
        // Strict check: If limits exist and value is outside, invalid.
        if (!isNaN(rMin) && nominalVal < rMin) return null;
        if (!isNaN(rMax) && nominalVal > rMax) return null;
        // ------------------------------------------------

        // 1. Try Meticulous Manual Calculation (Complex Objects)
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
        const readingComp = activeResolvedTolerance.reading || activeResolvedTolerance.tolerances?.reading;
        if (readingComp) {
            const readingPcn = getComponentValue(readingComp);
            if (readingPcn !== 0) {
                total += Math.abs(nominalVal * (readingPcn / 100));
                found = true;
            }
        }

        // Floor
        const floorComp = activeResolvedTolerance.floor || activeResolvedTolerance.tolerances?.floor;
        if (floorComp) {
            const floorVal = getComponentValue(floorComp);
            if (floorVal !== 0) {
                total += Math.abs(floorVal);
                found = true;
            }
        }

        // Generic
        if (!found && (activeResolvedTolerance.tolerance || activeResolvedTolerance.value)) {
            const tolVal = getComponentValue(activeResolvedTolerance);
            if (tolVal !== 0) {
                total += Math.abs(tolVal);
                found = true;
            }
        }

        if (found) return total;

        // 2. Fallback: Parse Standard Utility String
        const utilResult = getToleranceErrorSummary(activeResolvedTolerance, uutNominal);
        if (utilResult && utilResult !== "Not Calculated" && utilResult !== "± -" && !utilResult.includes("NaN")) {
            const match = utilResult.match(/±\s*([\d\.]+)/);
            if (match && match[1]) {
                return parseFloat(match[1]);
            }
        }

        return null;
    }, [activeResolvedTolerance, uutNominal]);

    // --- DISPLAY 1: Tolerance String ---
    const calculatedToleranceDisplay = useMemo(() => {
        if (numericTotalTolerance !== null) {
            return `± ${Number(numericTotalTolerance.toPrecision(4))} ${uutNominal?.unit || ""}`;
        }
        // --- BUG FIX 3: Update Label ---
        return "No Range / Spec";
    }, [numericTotalTolerance, uutNominal]);

    // --- DISPLAY 2: Limits ---
    const calculatedLimits = useMemo(() => {
        const nominalVal = parseFloat(uutNominal?.value);

        if (numericTotalTolerance !== null && !isNaN(nominalVal)) {
            // Calculate limits
            const low = nominalVal - numericTotalTolerance;
            const high = nominalVal + numericTotalTolerance;

            return {
                low: low.toPrecision(6),
                high: high.toPrecision(6)
            };
        }

        return { low: "-", high: "-" };
    }, [numericTotalTolerance, uutNominal]);


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
                                <table className="instrument-summary-table" style={{ width: '100%' }}>
                                    <colgroup>
                                        <col style={{ width: '10%' }} />
                                        <col style={{ width: '40%' }} />
                                        <col style={{ width: '25%' }} />
                                        <col style={{ width: '25%' }} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'center' }}>Select</th>
                                            <th>Description</th>
                                            <th>Range</th>
                                            <th>Specification</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {relevantUuts.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-color-muted)', fontStyle: 'italic' }}>
                                                    No UUTs assigned to this Measurement Area.
                                                    <br />
                                                    <small>Add UUTs in the "Instruments" tab of Edit Session.</small>
                                                </td>
                                            </tr>
                                        ) : (
                                            relevantUuts.map((uut) => {
                                                const { ranges, activeIndex, activeRange } = resolveUutRange(uut);
                                                const specSummary = getToleranceSummary(activeRange);
                                                const hasMultipleRanges = ranges.length > 1;

                                                const isChecked = currentUutSelection.includes(uut.id);

                                                const isActiveContext = testPointData.id
                                                    ? (testPointData.activeUutId
                                                        ? uut.id === testPointData.activeUutId
                                                        : (testPointData.associatedUutIds && testPointData.associatedUutIds.includes(uut.id)))
                                                    : false;

                                                return (
                                                    <tr key={uut.id} style={{
                                                        backgroundColor: isActiveContext ? 'rgba(var(--primary-rgb), 0.15)' : (isChecked ? 'rgba(var(--primary-rgb), 0.05)' : 'transparent'),
                                                        borderLeft: isActiveContext ? '4px solid var(--primary-color)' : '4px solid transparent',
                                                        transition: 'all 0.2s ease'
                                                    }}>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => handleUutCheckboxChange(uut.id)}
                                                                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <div style={{ fontWeight: isActiveContext ? 700 : (isChecked ? 600 : 400), color: isChecked ? 'var(--primary-color)' : 'var(--text-color)' }}>
                                                                {uut.description}
                                                                {isActiveContext && (
                                                                    <span style={{
                                                                        marginLeft: '8px',
                                                                        fontSize: '0.65rem',
                                                                        backgroundColor: 'var(--primary-color)',
                                                                        color: '#fff',
                                                                        padding: '2px 6px',
                                                                        borderRadius: '4px',
                                                                        verticalAlign: 'middle',
                                                                        textTransform: 'uppercase',
                                                                        letterSpacing: '0.5px'
                                                                    }}>
                                                                        Active
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {hasMultipleRanges ? (
                                                                <select
                                                                    className="mini-select"
                                                                    style={{ width: '100%' }}
                                                                    value={activeIndex}
                                                                    onChange={(e) => handleRangeChange(uut.id, parseInt(e.target.value, 10), ranges)}
                                                                >
                                                                    {ranges.map((range, idx) => {
                                                                        let rangeText = range.range;
                                                                        if (!rangeText) {
                                                                            if (range.min !== undefined && range.max !== undefined) {
                                                                                rangeText = `${range.min} to ${range.max}`;
                                                                            } else {
                                                                                rangeText = "Full Range";
                                                                            }
                                                                        }
                                                                        // --- FIX 4: Remove Function Name from Labels ---
                                                                        const label = `${rangeText} ${range.unit || ''}`;

                                                                        return <option key={idx} value={idx}>{label}</option>
                                                                    })}
                                                                </select>
                                                            ) : (
                                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-color-muted)' }}>
                                                                    {(() => {
                                                                        const r = ranges[0];
                                                                        if (!r) return "-";
                                                                        let rangeText = r.range;
                                                                        if (!rangeText) {
                                                                            if (r.min !== undefined && r.max !== undefined) {
                                                                                rangeText = `${r.min} to ${r.max}`;
                                                                            } else {
                                                                                rangeText = "Full Range";
                                                                            }
                                                                        }
                                                                        // --- FIX 4: Remove Function Name ---
                                                                        return `${rangeText} ${r.unit || ''}`;
                                                                    })()}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td>
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

                    {/* 2. TMDE LIST */}
                    <div>
                        <h3 style={sectionTitleStyle}>Measurement Standards (TMDE)</h3>
                        <div style={cardStyle}>
                            <div className="instrument-table-container" style={{ margin: 0, border: 'none', boxShadow: 'none', borderRadius: '8px', overflowX: 'auto', flex: 1, maxHeight: '400px' }}>
                                <table className="instrument-summary-table" style={{ width: '100%' }}>
                                    <colgroup>
                                        <col style={{ width: '5%' }} />
                                        <col style={{ width: '25%' }} />
                                        {isDerived && <col style={{ width: '10%' }} />}
                                        <col style={{ width: '15%' }} />
                                        <col style={{ width: '15%' }} />
                                        <col style={{ width: '15%' }} />
                                        <col style={{ width: '10%' }} />
                                    </colgroup>
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
                                                            <td style={{ paddingLeft: '10px' }}>
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

                {/* --- RIGHT COLUMN --- */}
                <div style={verticalColumnStyle}>
                    {/* 3. MEASUREMENT POINT TABLE */}
                    <div>
                        <h3 style={sectionTitleStyle}>Measurement Point</h3>
                        <div style={cardStyle}>
                            <div className="instrument-table-container" style={{ margin: 0, border: 'none', boxShadow: 'none', borderRadius: '8px', flex: 1, overflowX: 'auto' }}>
                                <table className="instrument-summary-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                                    <colgroup>
                                        <col style={{ width: '20%' }} /> {/* Point */}
                                        <col style={{ width: '20%' }} /> {/* Tolerance */}
                                        <col style={{ width: '20%' }} /> {/* Low Limit */}
                                        <col style={{ width: '20%' }} /> {/* High Limit */}
                                        <col style={{ width: '10%' }} /> {/* Unit */}
                                        <col style={{ width: '10%' }} /> {/* Actions */}
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th style={{ paddingLeft: '20px' }}>Point</th>
                                            <th>Tolerance</th>
                                            {/* UPDATED: Removed inline 'color: muted' to match other headers */}
                                            <th>Low Limit</th>
                                            <th>High Limit</th>
                                            <th>Unit</th>
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
                                                {/* 1. Point */}
                                                <td style={{ paddingLeft: '20px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--primary-color)' }}>
                                                        <EditableCell
                                                            value={uutNominal?.value}
                                                            onSave={(val) => onInlineUutUpdate && onInlineUutUpdate('nominal', val)}
                                                            type="number"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </td>

                                                {/* 2. Tolerance */}
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

                                                {/* 3. Low Limit (UPDATED STYLE) */}
                                                <td>
                                                    {/* Matches Tolerance Column style exactly (Removed hardcoded Consolas/Size) */}
                                                    <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-color)' }}>
                                                        {calculatedLimits.low}
                                                    </span>
                                                </td>

                                                {/* 4. High Limit (UPDATED STYLE) */}
                                                <td>
                                                    <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-color)' }}>
                                                        {calculatedLimits.high}
                                                    </span>
                                                </td>

                                                {/* 5. Unit */}
                                                <td>
                                                    <div style={{ fontWeight: 600, paddingLeft: '4px' }}>
                                                        {/* --- BUG FIX 2: Static Display --- */}
                                                        {uutNominal?.unit}
                                                    </div>
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

export default UncertaintyPanel;