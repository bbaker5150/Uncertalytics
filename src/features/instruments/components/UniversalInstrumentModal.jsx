import React, { useState, useMemo, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import Select from "react-select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faTimes,
  faPlus,
  faTrashAlt,
  faEdit,
  faLayerGroup,
  faArrowLeft,
  faSearch,
  faChevronDown,
  faChevronUp,
  faCalculator,
  faCube,
  faBookOpen,
  faMicroscope,
  faTools,
  faFingerprint,
  faHashtag,
  faIndustry,
  faTag
} from "@fortawesome/free-solid-svg-icons";
import { v4 as uuidv4 } from "uuid";
import { unitSystem, unitCategories } from "../../../utils/uncertaintyMath";
import ToleranceForm from "../../../components/common/ToleranceForm";
import { useFloatingWindow } from "../../../hooks/useFloatingWindow";

import "./UniversalInstrumentModal.css";

// --- React Select Styles ---
const portalStyle = {
  menuPortal: (base) => ({ ...base, zIndex: 99999 }),
  menu: (base) => ({ ...base, zIndex: 99999, backgroundColor: 'var(--input-background)', color: 'var(--text-color)' }),
  control: (base) => ({
    ...base,
    backgroundColor: 'var(--input-background)',
    borderColor: 'var(--border-color)',
    color: 'var(--text-color)',
    minHeight: '32px', // Compact for table
    height: '32px',
    borderRadius: '4px',
    fontSize: '0.85rem'
  }),
  valueContainer: (base) => ({ ...base, padding: '0 8px', height: '30px' }),
  indicatorsContainer: (base) => ({ ...base, height: '30px' }),
  singleValue: (base) => ({ ...base, color: 'var(--text-color)' }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? 'var(--primary-color)' : 'transparent',
    color: state.isFocused ? '#fff' : 'var(--text-color)',
    fontSize: '0.85rem'
  })
};

// --- Helpers ---
const getCategorizedUnitOptions = (allUnits, referenceUnit) => {
  const options = [];
  const usedUnits = new Set();
  
  if (referenceUnit && allUnits.includes(referenceUnit)) {
    let refCategory = "Suggested";
    for (const [cat, units] of Object.entries(unitCategories)) {
      if (units.includes(referenceUnit)) {
        refCategory = cat;
        break;
      }
    }
    const categoryUnits = unitCategories[refCategory] || [referenceUnit];
    const prioritizedOptions = categoryUnits
      .filter((u) => allUnits.includes(u))
      .map((u) => { usedUnits.add(u); return { value: u, label: u }; });
    options.push({ label: refCategory, options: prioritizedOptions });
  }

  Object.entries(unitCategories).forEach(([label, units]) => {
    if (options.some((opt) => opt.label === label)) return;
    const groupOptions = units
      .filter((u) => allUnits.includes(u) && !usedUnits.has(u))
      .map((u) => { usedUnits.add(u); return { value: u, label: u }; });
    if (groupOptions.length > 0) options.push({ label, options: groupOptions });
  });

  const leftovers = allUnits
    .filter((u) => !usedUnits.has(u) && !["%", "ppm", "dB", "ppb"].includes(u))
    .map((u) => ({ value: u, label: u }));
  if (leftovers.length > 0) options.push({ label: "Other", options: leftovers });

  return options;
};

const formatToleranceSummary = (tolerances) => {
    if (!tolerances) return <span className="tolerance-badge">N/A</span>;
    const parts = [];
    const fmt = (c) => c.symmetric ? `±${c.high}` : `+${c.high}/-${c.low}`;
    if (tolerances.reading?.high) parts.push(`${fmt(tolerances.reading)}% Rdg`);
    if (tolerances.range?.high) parts.push(`${fmt(tolerances.range)}% ${tolerances.range.value ? 'FS' : 'Rng'}`);
    if (tolerances.floor?.high) parts.push(`${fmt(tolerances.floor)} ${tolerances.floor.unit || ''}`);
    return parts.length > 0 ? <span className="tolerance-badge">{parts.join(" + ")}</span> : <span className="tolerance-badge">Custom Spec</span>;
};

const UniversalInstrumentModal = ({ 
    isOpen, 
    onClose, 
    onSave, 
    mode = 'library', // 'uut', 'tmde', 'library'
    initialData = null, 
    instruments = [] 
}) => {
    // --- State ---
    const [viewMode, setViewMode] = useState("edit"); 
    const [effectiveMode, setEffectiveMode] = useState(mode); // Internal tracking of mode (allows switching from Library -> UUT)

    const [searchTerm, setSearchTerm] = useState("");
    const [expandedDetail, setExpandedDetail] = useState(null);

    // Context-Specific Data (Meta)
    const [metaData, setMetaData] = useState({
        name: "", 
        measurementArea: "", 
        quantity: 1, 
        assetId: "" 
    });

    // Instrument Definition State
    const [instrumentDef, setInstrumentDef] = useState({
        id: uuidv4(),
        manufacturer: "",
        model: "",
        description: "", 
        functions: []
    });

    const [activeFunctionId, setActiveFunctionId] = useState(null);
    const [editingRange, setEditingRange] = useState(null);

    // Floating Window
    const { position, handleMouseDown } = useFloatingWindow({
        isOpen,
        defaultWidth: 1100,
        defaultHeight: 850
    });

    // --- Initialization ---
    useEffect(() => {
        if (isOpen) {
            setSearchTerm("");
            setExpandedDetail(null);
            setEditingRange(null);

            // 1. Determine Initial View Mode
            if (mode === 'library') {
                setViewMode("list");
            } else {
                setViewMode("edit");
            }

            // 2. Reset Effective Mode
            setEffectiveMode(mode);

            if (initialData) {
                // EDIT EXISTING
                setViewMode("edit");
                const loadedInst = initialData.instrument || (initialData.functions ? initialData : null) || {
                    id: uuidv4(), manufacturer: "", model: "", description: "", functions: []
                };
                setInstrumentDef(JSON.parse(JSON.stringify(loadedInst)));
                if (loadedInst.functions?.length > 0) setActiveFunctionId(loadedInst.functions[0].id);
                else setActiveFunctionId(null);

                if (mode === 'uut') {
                    setMetaData({
                        name: initialData.description || "",
                        measurementArea: initialData.measurementArea || "",
                        quantity: 1, assetId: ""
                    });
                } else if (mode === 'tmde') {
                    setMetaData({
                        name: initialData.name || "",
                        quantity: initialData.quantity || 1,
                        assetId: initialData.assetId || "",
                        measurementArea: ""
                    });
                }
            } else {
                // ADD NEW (Reset Data)
                setMetaData({ name: "", measurementArea: "", quantity: 1, assetId: "" });
                setInstrumentDef({ id: uuidv4(), manufacturer: "", model: "", description: "", functions: [] });
                setActiveFunctionId(null);
            }
        }
    }, [isOpen, initialData, mode]);

    // --- Computed ---
    const filteredInstruments = useMemo(() => {
        if (!searchTerm) return instruments;
        const lower = searchTerm.toLowerCase();
        return instruments.filter(i =>
            (i.manufacturer || "").toLowerCase().includes(lower) ||
            (i.model || "").toLowerCase().includes(lower) ||
            (i.description || "").toLowerCase().includes(lower)
        );
    }, [instruments, searchTerm]);

    const activeFunction = useMemo(() => 
        instrumentDef.functions.find(f => f.id === activeFunctionId), 
    [instrumentDef.functions, activeFunctionId]);

    const allUnitsRaw = useMemo(() => Object.keys(unitSystem.units), []);
    const categorizedUnitOptions = useMemo(() => {
        return getCategorizedUnitOptions(allUnitsRaw, activeFunction?.unit);
    }, [allUnitsRaw, activeFunction?.unit]);

    const modalTitle = useMemo(() => {
        if (effectiveMode === 'uut') return initialData ? "Edit UUT" : "Add New UUT";
        if (effectiveMode === 'tmde') return initialData ? "Edit TMDE" : "Add New TMDE";
        return "Instrument Manager";
    }, [effectiveMode, initialData]);

    const modeIcon = effectiveMode === 'uut' ? faMicroscope : (effectiveMode === 'tmde' ? faTools : faBookOpen);

    // --- Handlers ---
    
    // Selecting for EDITING (Library mode only)
    // Selecting for EDITING (Library mode only) or IMPORTING (if in UUT/TMDE mode)
    const handleEditLibraryItem = (inst) => {
        const newDef = JSON.parse(JSON.stringify(inst));
        
        // If we are importing into a UUT/TMDE definition (not managing the library itself)
        if (effectiveMode !== 'library') {
            newDef.id = uuidv4(); // Create a fresh instance ID
            
            // Auto-fill Name from Instrument details
            const autoName = `${inst.manufacturer || ''} ${inst.model || ''}`.trim();
            if (autoName) {
                setMetaData(prev => ({ ...prev, name: autoName }));
            }
        }
        
        setInstrumentDef(newDef);
        if (newDef.functions?.length > 0) setActiveFunctionId(newDef.functions[0].id);
        setViewMode("edit");
    };

    // Selecting to SPAWN UUT or TMDE (From Builder)
    const handleUseAs = (inst, targetMode) => {
        const newDef = JSON.parse(JSON.stringify(inst));
        newDef.id = uuidv4(); // Unique ID for the new instance
        setInstrumentDef(newDef);
        
        // Auto-fill meta
        const autoName = `${inst.manufacturer} ${inst.model}`;
        setMetaData(prev => ({ 
            ...prev, 
            name: autoName,
            quantity: 1, 
            assetId: "", 
            measurementArea: "" 
        }));

        setEffectiveMode(targetMode); // Switch to the specific builder mode
        if (newDef.functions?.length > 0) setActiveFunctionId(newDef.functions[0].id);
        setViewMode("edit");
    };

    const handleCreateNew = () => {
        setInstrumentDef({ id: uuidv4(), manufacturer: "", model: "", description: "", functions: [] });
        setActiveFunctionId(null);
        setViewMode("edit");
        // Keep effectiveMode as is (e.g. if we were in Library mode, we are adding to library)
    };

    const handleMetaChange = (field, value) => {
        setMetaData(prev => ({ ...prev, [field]: value }));
    };

    // --- Builder Handlers ---
    const handleAddFunction = () => {
        const newFunc = { id: uuidv4(), name: "New Function", unit: "V", ranges: [] };
        setInstrumentDef(prev => ({ ...prev, functions: [...prev.functions, newFunc] }));
        setActiveFunctionId(newFunc.id);
    };

    const updateActiveFunction = (key, value) => {
        setInstrumentDef(prev => ({
            ...prev,
            functions: prev.functions.map(f => f.id === activeFunctionId ? { ...f, [key]: value } : f)
        }));
    };

    const handleDeleteFunction = (id) => {
        setInstrumentDef(prev => ({ ...prev, functions: prev.functions.filter(f => f.id !== id) }));
        if (activeFunctionId === id) setActiveFunctionId(null);
    };

    const handleAddRange = () => {
        if (!activeFunction) return;
        const newRange = { id: uuidv4(), min: 0, max: 0, resolution: 0.0001, tolerances: {} };
        const updatedRanges = [...activeFunction.ranges, newRange]; 
        setInstrumentDef(prev => ({
            ...prev,
            functions: prev.functions.map(f => f.id === activeFunctionId ? { ...f, ranges: updatedRanges } : f)
        }));
    };

    const updateRangeBounds = (rangeId, field, value) => {
        setInstrumentDef(prev => ({
            ...prev,
            functions: prev.functions.map(f => {
                if (f.id !== activeFunctionId) return f;
                return { ...f, ranges: f.ranges.map(r => r.id === rangeId ? { ...r, [field]: value } : r) };
            })
        }));
    };

    const handleDeleteRange = (rangeId) => {
        setInstrumentDef(prev => ({
            ...prev,
            functions: prev.functions.map(f => {
                if (f.id !== activeFunctionId) return f;
                return { ...f, ranges: f.ranges.filter(r => r.id !== rangeId) };
            })
        }));
    };

    const handleToleranceUpdate = useCallback((updater) => {
        setEditingRange(prev => {
            if (!prev) return null;
            const newVal = typeof updater === 'function' ? updater(prev.tolerances) : updater;
            return { ...prev, tolerances: newVal };
        });
    }, []);

    const saveRangeSpecs = () => {
        if (!editingRange) return;
        setInstrumentDef(prev => ({
            ...prev,
            functions: prev.functions.map(f => {
                if (f.id !== activeFunctionId) return f;
                return { ...f, ranges: f.ranges.map(r => r.id === editingRange.id ? { ...r, tolerances: editingRange.tolerances } : r) };
            })
        }));
        setEditingRange(null);
    };

    const handleSave = () => {
        let finalData = {};

        if (effectiveMode === 'uut') {
            finalData = {
                id: initialData?.id || uuidv4(),
                description: metaData.name,
                measurementArea: metaData.measurementArea,
                instrument: instrumentDef,
                type: 'uut'
            };
        } else if (effectiveMode === 'tmde') {
            finalData = {
                id: initialData?.id || uuidv4(),
                name: metaData.name,
                quantity: metaData.quantity,
                assetId: metaData.assetId,
                instrument: instrumentDef,
                isInstrumentBased: true,
                type: 'tmde'
            };
        } else {
            // Library mode
            finalData = { ...instrumentDef, type: 'library' };
        }
        onSave(finalData);
        onClose();
    };

    const toggleFunctionDetails = (e, instId, funcId) => {
        e.stopPropagation();
        if (expandedDetail && expandedDetail.instId === instId && expandedDetail.funcId === funcId) {
            setExpandedDetail(null);
        } else {
            setExpandedDetail({ instId, funcId });
        }
    };

    // --- Options for Dropdown ---
    const actionOptions = [
        { label: 'Use as UUT', value: 'uut', icon: faMicroscope },
        { label: 'Use as TMDE', value: 'tmde', icon: faTools },
    ];

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div
            className="modal-content floating-window-content instrument-builder-wrapper"
            style={{
                position: 'fixed',
                top: position.y,
                left: position.x,
                margin: 0,
                width: '1100px',
                maxWidth: '95vw',
                height: '85vh',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 2100,
                overflow: 'hidden'
            }}
        >
            {/* --- Header --- */}
            <div
                className="modal-header"
                onMouseDown={handleMouseDown}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {viewMode === 'list' && (
                        <button className="icon-action-btn" onClick={() => setViewMode("edit")} title="Back to Editor">
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </button>
                    )}
                    <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FontAwesomeIcon icon={modeIcon} style={{ color: 'var(--primary-color)' }} />
                        {viewMode === 'list' ? "Select Instrument from Library" : modalTitle}
                    </h3>
                </div>
                <button onClick={onClose} className="modal-close-button">&times;</button>
            </div>

            {/* --- Body --- */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                
                {/* --- VIEW: LIST --- */}
                {viewMode === "list" && (
                    <div className="list-view-container">
                         <div className="search-toolbar">
                            <div className="search-input-wrapper">
                                <FontAwesomeIcon icon={faSearch} className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search library..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <button className="button secondary" onClick={handleCreateNew}>
                                <FontAwesomeIcon icon={faPlus} style={{ marginRight: '5px' }} /> Manual
                            </button>
                        </div>

                        <div className="list-content">
                            <table className="library-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '20%' }}>Manufacturer</th>
                                        <th style={{ width: '20%' }}>Model</th>
                                        <th style={{ width: '30%' }}>Description</th>
                                        <th style={{ width: '15%' }}>Functions</th>
                                        <th style={{ width: '15%', textAlign: 'center' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredInstruments.map(inst => {
                                        const isExpanded = expandedDetail?.instId === inst.id;
                                        return (
                                            <React.Fragment key={inst.id}>
                                                <tr onClick={() => handleEditLibraryItem(inst)} className="hover-row">
                                                    <td style={{ fontWeight: '600' }}>{inst.manufacturer}</td>
                                                    <td style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>{inst.model}</td>
                                                    <td style={{ color: 'var(--text-color-muted)' }}>{inst.description}</td>
                                                    <td onClick={e => e.stopPropagation()}>
                                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                                                            {inst.functions.map(f => (
                                                                <button
                                                                    key={f.id}
                                                                    onClick={(e) => toggleFunctionDetails(e, inst.id, f.id)}
                                                                    className={`status-pill ${isExpanded && expandedDetail.funcId === f.id ? "active" : ""}`}
                                                                >
                                                                    {f.name} <FontAwesomeIcon icon={isExpanded && expandedDetail.funcId === f.id ? faChevronUp : faChevronDown} size="xs" />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                                        {/* Dynamic Select Dropdown */}
                                                        {mode === 'library' ? (
                                                            <div style={{ width: '150px', margin: '0 auto' }}>
                                                                <Select 
                                                                    placeholder="Use as..."
                                                                    options={actionOptions}
                                                                    styles={portalStyle}
                                                                    menuPortalTarget={document.body}
                                                                    menuPlacement="auto"
                                                                    onChange={(opt) => handleUseAs(inst, opt.value)}
                                                                    formatOptionLabel={opt => (
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            <FontAwesomeIcon icon={opt.icon} style={{ fontSize: '0.8rem', opacity: 0.7 }} />
                                                                            <span>{opt.label}</span>
                                                                        </div>
                                                                    )}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <button 
                                                                className="button small primary" 
                                                                onClick={(e) => { e.stopPropagation(); handleEditLibraryItem(inst); }}
                                                            >
                                                                Select
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="detail-row">
                                                        <td colSpan="5">
                                                            <div className="detail-pane">
                                                                {(() => {
                                                                    const func = inst.functions.find(f => f.id === expandedDetail.funcId);
                                                                    if (!func) return null;
                                                                    return (
                                                                        <table className="specs-table">
                                                                            <thead><tr><th>Min</th><th>Max</th><th>Res</th><th>Spec</th></tr></thead>
                                                                            <tbody>
                                                                                {func.ranges.map((r, i) => (
                                                                                    <tr key={i}><td>{r.min}</td><td>{r.max}</td><td>{r.resolution}</td><td>{formatToleranceSummary(r.tolerances)}</td></tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    )
                                                                })()}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- VIEW: EDIT (BUILDER) --- */}
                {viewMode === "edit" && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                        
                        {/* Slide Over for Tolerances */}
                        {editingRange && (
                            <div className="tolerance-slide-over">
                                <div className="slide-over-header">
                                    <div className="slide-over-title">
                                        <h3><FontAwesomeIcon icon={faCalculator} /> Edit Tolerances</h3>
                                        <div className="slide-over-subtitle">Range: {editingRange.min} - {editingRange.max} {activeFunction?.unit}</div>
                                    </div>
                                    <button onClick={() => setEditingRange(null)} className="modal-icon-button secondary"><FontAwesomeIcon icon={faTimes} /></button>
                                </div>
                                <div className="slide-over-body">
                                    <ToleranceForm 
                                        tolerance={editingRange.tolerances || {}} 
                                        setTolerance={handleToleranceUpdate} 
                                        isUUT={effectiveMode === 'uut'} 
                                        referencePoint={{ unit: activeFunction?.unit }} 
                                    />
                                </div>
                                <div className="slide-over-footer">
                                    <button className="button primary" onClick={saveRangeSpecs}><FontAwesomeIcon icon={faCheck} style={{ marginRight: '8px' }} /> Save Specs</button>
                                </div>
                            </div>
                        )}

                        {/* Top: Identity Card */}
                        <div className="identity-container">
                            <div className="identity-header">
                                <span>Identification</span>
                                <button className="library-lookup-btn" onClick={() => setViewMode('list')} title="Import from Library">
                                    <FontAwesomeIcon icon={faBookOpen} /> <span>Library Lookup</span>
                                </button>
                            </div>
                            
                            {/* UUT SPECIFIC FIELDS */}
                            {effectiveMode === 'uut' && (
                                <div className="identity-grid">
                                    <div className="floating-input-group full-width">
                                        <input 
                                            type="text" 
                                            value={metaData.name} 
                                            onChange={e => handleMetaChange('name', e.target.value)} 
                                            placeholder=" " 
                                        />
                                        <label>UUT Description / Name (Required)</label>
                                        <FontAwesomeIcon icon={faFingerprint} className="input-icon" />
                                    </div>
                                    <div className="floating-input-group">
                                        <input 
                                            type="text" 
                                            value={metaData.measurementArea} 
                                            onChange={e => handleMetaChange('measurementArea', e.target.value)} 
                                            placeholder=" " 
                                        />
                                        <label>Measurement Area</label>
                                        <FontAwesomeIcon icon={faLayerGroup} className="input-icon" />
                                    </div>
                                    <div className="floating-input-group">
                                        <input 
                                            type="text" 
                                            value={instrumentDef.manufacturer} 
                                            onChange={e => setInstrumentDef({ ...instrumentDef, manufacturer: e.target.value })} 
                                            placeholder=" " 
                                        />
                                        <label>Manufacturer</label>
                                        <FontAwesomeIcon icon={faIndustry} className="input-icon" />
                                    </div>
                                    <div className="floating-input-group">
                                        <input 
                                            type="text" 
                                            value={instrumentDef.model} 
                                            onChange={e => setInstrumentDef({ ...instrumentDef, model: e.target.value })} 
                                            placeholder=" " 
                                        />
                                        <label>Model</label>
                                        <FontAwesomeIcon icon={faTag} className="input-icon" />
                                    </div>
                                </div>
                            )}

                            {/* TMDE SPECIFIC FIELDS */}
                            {effectiveMode === 'tmde' && (
                                <div className="identity-grid">
                                    <div className="floating-input-group full-width">
                                        <input 
                                            type="text" 
                                            value={metaData.name} 
                                            onChange={e => handleMetaChange('name', e.target.value)} 
                                            placeholder=" " 
                                        />
                                        <label>TMDE Name / Description (Required)</label>
                                        <FontAwesomeIcon icon={faTools} className="input-icon" />
                                    </div>
                                    <div className="floating-input-group">
                                        <input 
                                            type="text" 
                                            value={metaData.assetId} 
                                            onChange={e => handleMetaChange('assetId', e.target.value)} 
                                            placeholder=" " 
                                        />
                                        <label>Asset ID (Optional)</label>
                                        <FontAwesomeIcon icon={faHashtag} className="input-icon" />
                                    </div>
                                    <div className="floating-input-group">
                                        <input 
                                            type="text" 
                                            value={instrumentDef.manufacturer} 
                                            onChange={e => setInstrumentDef({ ...instrumentDef, manufacturer: e.target.value })} 
                                            placeholder=" " 
                                        />
                                        <label>Manufacturer</label>
                                        <FontAwesomeIcon icon={faIndustry} className="input-icon" />
                                    </div>
                                    <div className="floating-input-group">
                                        <input 
                                            type="text" 
                                            value={instrumentDef.model} 
                                            onChange={e => setInstrumentDef({ ...instrumentDef, model: e.target.value })} 
                                            placeholder=" " 
                                        />
                                        <label>Model</label>
                                        <FontAwesomeIcon icon={faTag} className="input-icon" />
                                    </div>
                                    <div className="floating-input-group small-width">
                                        <input 
                                            type="number" 
                                            min="1"
                                            value={metaData.quantity} 
                                            onChange={e => handleMetaChange('quantity', parseInt(e.target.value))} 
                                            placeholder=" " 
                                        />
                                        <label>Qty</label>
                                    </div>
                                </div>
                            )}

                            {/* LIBRARY MODE (PURE INSTRUMENT) */}
                            {effectiveMode === 'library' && (
                                <div className="identity-grid">
                                    <div className="floating-input-group">
                                        <input type="text" value={instrumentDef.manufacturer} onChange={e => setInstrumentDef({ ...instrumentDef, manufacturer: e.target.value })} placeholder=" " />
                                        <label>Manufacturer</label>
                                        <FontAwesomeIcon icon={faIndustry} className="input-icon" />
                                    </div>
                                    <div className="floating-input-group">
                                        <input type="text" value={instrumentDef.model} onChange={e => setInstrumentDef({ ...instrumentDef, model: e.target.value })} placeholder=" " />
                                        <label>Model</label>
                                        <FontAwesomeIcon icon={faTag} className="input-icon" />
                                    </div>
                                    <div className="floating-input-group full-width">
                                        <input type="text" value={instrumentDef.description} onChange={e => setInstrumentDef({ ...instrumentDef, description: e.target.value })} placeholder=" " />
                                        <label>Description</label>
                                        <FontAwesomeIcon icon={faFingerprint} className="input-icon" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Editor Body */}
                        <div className="instrument-editor-body">
                            {/* Sidebar */}
                            <div className="function-nav-rail">
                                <div className="rail-header">
                                    <h5><FontAwesomeIcon icon={faCube} /> Functions</h5>
                                    <button className="icon-action-btn" onClick={handleAddFunction} title="Add Function"><FontAwesomeIcon icon={faPlus} /></button>
                                </div>
                                <div className="rail-list">
                                    {instrumentDef.functions.map(f => (
                                        <div key={f.id} className={`rail-item ${activeFunctionId === f.id ? 'active' : ''}`} onClick={() => setActiveFunctionId(f.id)}>
                                            <span>{f.name}</span>
                                            <button className="btn-icon-only danger small" onClick={(e) => { e.stopPropagation(); handleDeleteFunction(f.id); }}><FontAwesomeIcon icon={faTrashAlt} size="xs" /></button>
                                        </div>
                                    ))}
                                    {instrumentDef.functions.length === 0 && <div className="empty-rail">No functions defined.</div>}
                                </div>
                            </div>

                            {/* Workspace */}
                            <div className="function-workspace">
                                {activeFunction ? (
                                    <>
                                        <div className="workspace-header">
                                            <div className="workspace-input-group" style={{flex: 1}}>
                                                <label>Function Name</label>
                                                <input type="text" value={activeFunction.name} onChange={e => updateActiveFunction('name', e.target.value)} />
                                            </div>
                                            
                                            <div className="workspace-input-group" style={{width: '180px'}}>
                                                <label>Base Unit</label>
                                                <Select
                                                    value={categorizedUnitOptions.flatMap(g => g.options ? g.options : g).find(opt => opt.value === activeFunction.unit) || null}
                                                    onChange={opt => updateActiveFunction('unit', opt.value)}
                                                    options={categorizedUnitOptions}
                                                    menuPortalTarget={document.body}
                                                    styles={portalStyle}
                                                    classNamePrefix="react-select"
                                                />
                                            </div>
                                        </div>

                                        <div className="ranges-panel">
                                            <div className="panel-toolbar">
                                                <h5><FontAwesomeIcon icon={faLayerGroup} /> Ranges</h5>
                                                <button className="button small" onClick={handleAddRange}><FontAwesomeIcon icon={faPlus} /> Add Range</button>
                                            </div>
                                            <div className="ranges-table-container">
                                                <table className="ranges-table">
                                                    <thead>
                                                        <tr><th style={{width:'20%'}}>Min</th><th style={{width:'20%'}}>Max</th><th style={{width:'20%'}}>Res</th><th style={{width:'30%'}}>Tolerance</th><th style={{width:'10%'}}>Actions</th></tr>
                                                    </thead>
                                                    <tbody>
                                                        {activeFunction.ranges.map(range => (
                                                            <tr key={range.id}>
                                                                <td><input type="number" step="any" value={range.min} onChange={e => updateRangeBounds(range.id, 'min', e.target.value)} /></td>
                                                                <td><input type="number" step="any" value={range.max} onChange={e => updateRangeBounds(range.id, 'max', e.target.value)} /></td>
                                                                <td><input type="number" step="any" value={range.resolution} onChange={e => updateRangeBounds(range.id, 'resolution', e.target.value)} /></td>
                                                                <td>
                                                                    <div className="tolerance-cell" onClick={() => setEditingRange({ ...range })}>
                                                                        {formatToleranceSummary(range.tolerances)}
                                                                        <FontAwesomeIcon icon={faEdit} />
                                                                    </div>
                                                                </td>
                                                                <td><button className="btn-icon-only danger" onClick={() => handleDeleteRange(range.id)}><FontAwesomeIcon icon={faTrashAlt} /></button></td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-color-muted)' }}>
                                        <FontAwesomeIcon icon={faCube} size="3x" style={{ marginBottom: '15px', opacity: 0.3 }} />
                                        <p>Select or create a function to begin editing specs.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="editor-actions">
                            <button className="button primary large" onClick={handleSave}>
                                <FontAwesomeIcon icon={faCheck} style={{ marginRight: '8px' }} /> Save Configuration
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default UniversalInstrumentModal;