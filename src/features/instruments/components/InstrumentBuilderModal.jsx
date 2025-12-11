import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Select from "react-select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faCheck, faTimes, faPlus, faTrashAlt, faEdit, faRadio, 
  faLayerGroup, faArrowLeft, faSearch, faChevronDown, faChevronUp, faInfoCircle,
  faGripHorizontal
} from "@fortawesome/free-solid-svg-icons";
import { unitSystem } from "../../../utils/uncertaintyMath";
import ToleranceForm from "../../../components/common/ToleranceForm";

// --- Configuration for Unit Grouping ---
const unitCategories = {
  Voltage: ["V", "mV", "uV", "kV", "nV", "TV"],
  Current: ["A", "mA", "uA", "nA", "pA", "kA"],
  Resistance: ["Ohm", "kOhm", "MOhm", "mOhm", "GOhm", "TOhm"],
  Capacitance: ["F", "uF", "nF", "pF", "mF"],
  Inductance: ["H", "mH", "uH"],
  Frequency: ["Hz", "kHz", "MHz", "GHz", "THz"],
  Time: ["s", "ms", "us", "ns", "ps", "min", "hr", "day"],
  Temperature: ["Cel", "degF", "degC", "K"],
  Pressure: ["Pa", "kPa", "MPa", "psi", "bar", "mbar", "torr", "inHg"],
  Length: ["m", "cm", "mm", "um", "nm", "km", "in", "ft", "yd", "mi"],
  Mass: ["kg", "g", "mg", "ug", "lb", "oz"],
  Power: ["W", "mW", "kW", "MW", "dBm"],
};

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
      .map((u) => {
        usedUnits.add(u);
        return { value: u, label: u };
      });
    options.push({ label: refCategory, options: prioritizedOptions });
  }
  Object.entries(unitCategories).forEach(([label, units]) => {
    if (options.some((opt) => opt.label === label)) return;
    const groupOptions = units
      .filter((u) => allUnits.includes(u) && !usedUnits.has(u))
      .map((u) => {
        usedUnits.add(u);
        return { value: u, label: u };
      });
    if (groupOptions.length > 0) {
      options.push({ label, options: groupOptions });
    }
  });
  const leftovers = allUnits
    .filter((u) => !usedUnits.has(u) && !["%", "ppm", "dB", "ppb"].includes(u))
    .map((u) => ({ value: u, label: u }));
  if (leftovers.length > 0) {
    options.push({ label: "Other", options: leftovers });
  }
  return options;
};

// Styles for React Select
const portalStyle = {
  menuPortal: (base) => ({ ...base, zIndex: 99999 }),
  menu: (base) => ({ ...base, zIndex: 99999 }),
};

const InstrumentBuilderModal = ({ isOpen, onClose, onSave, onDelete, initialData = null, instruments = [] }) => {
  const [viewMode, setViewMode] = useState("list"); // 'list' or 'edit'
  const [searchTerm, setSearchTerm] = useState("");
  
  // Track expansion for list view details
  const [expandedDetail, setExpandedDetail] = useState(null);

  // --- Confirmation State ---
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);

  // --- Editor State ---
  const [instrument, setInstrument] = useState({
    id: Date.now(),
    manufacturer: "",
    model: "",
    description: "",
    functions: []
  });

  const [activeFunctionId, setActiveFunctionId] = useState(null);
  const [editingRange, setEditingRange] = useState(null);

  // --- Drag & Float State ---
  
  // FIX: Lazy Initialization to calculate center BEFORE first render
  const [position, setPosition] = useState(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    
    // Logic matches CSS (1000px width, 85vh height)
    const modalWidth = 1000;
    const modalHeightPercent = 0.85;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    const modalHeight = viewportHeight * modalHeightPercent;

    const x = (viewportWidth - Math.min(modalWidth, viewportWidth * 0.9)) / 2;
    const y = (viewportHeight - modalHeight) / 2;

    return { 
        x: Math.max(0, x), 
        y: Math.max(0, y) 
    };
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // --- Init ---
  React.useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setInstrument(initialData);
        setViewMode("edit");
        if (initialData.functions.length > 0) setActiveFunctionId(initialData.functions[0].id);
      } else {
        setViewMode("list");
        setSearchTerm("");
        setExpandedDetail(null);
        setDeleteConfirmation(null);
      }
      
      // Removed the useEffect centering logic since we now do it in useState initializer
    }
  }, [isOpen, initialData]);

  // --- Drag Handlers ---
  const handleMouseDown = (e) => {
    // Only allow dragging from header
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);


  // --- Library Filtering ---
  const filteredInstruments = useMemo(() => {
    if (!searchTerm) return instruments;
    const lower = searchTerm.toLowerCase();
    return instruments.filter(i => 
      (i.manufacturer||"").toLowerCase().includes(lower) || 
      (i.model||"").toLowerCase().includes(lower) || 
      (i.description||"").toLowerCase().includes(lower)
    );
  }, [instruments, searchTerm]);

  // --- Helpers ---
  const activeFunction = useMemo(() => 
    instrument.functions.find(f => f.id === activeFunctionId), 
  [instrument.functions, activeFunctionId]);

  const allUnitsRaw = useMemo(() => Object.keys(unitSystem.units), []);
  const categorizedUnitOptions = useMemo(() => {
    return getCategorizedUnitOptions(allUnitsRaw, activeFunction?.unit);
  }, [allUnitsRaw, activeFunction?.unit]);

  const toggleFunctionDetails = (e, instId, funcId) => {
    e.stopPropagation();
    if (expandedDetail && expandedDetail.instId === instId && expandedDetail.funcId === funcId) {
      setExpandedDetail(null);
    } else {
      setExpandedDetail({ instId, funcId });
    }
  };

  const renderToleranceString = (tolerances) => {
    if (!tolerances) return "N/A";
    const parts = [];
    const fmt = (c) => c.symmetric ? `±${c.high}` : `+${c.high}/-${c.low}`;
    
    if (tolerances.reading?.high) parts.push(`${fmt(tolerances.reading)}% Rdg`);
    if (tolerances.range?.high) parts.push(`${fmt(tolerances.range)}% ${tolerances.range.value ? 'FS' : 'Rng'}`);
    if (tolerances.floor?.high) parts.push(`${fmt(tolerances.floor)} ${tolerances.floor.unit || ''}`);
    if (tolerances.db?.high) parts.push(`dB: ${fmt(tolerances.db)}`);
    
    return parts.length > 0 ? parts.join(" + ") : "Custom Spec";
  };

  const formatToleranceSummary = (tolerances) => {
    return <span style={{fontSize:'0.85rem'}}>{renderToleranceString(tolerances)}</span>;
  };

  // --- Actions ---
  const handleCreateNew = () => {
    setInstrument({ id: Date.now(), manufacturer: "", model: "", description: "", functions: [] });
    setActiveFunctionId(null);
    setViewMode("edit");
  };

  const handleEditExisting = (e, inst) => {
    e.stopPropagation();
    setInstrument(JSON.parse(JSON.stringify(inst))); 
    if (inst.functions.length > 0) setActiveFunctionId(inst.functions[0].id);
    setViewMode("edit");
  };

  // --- Delete Logic ---
  const handleDeleteInstrument = (e, id) => {
    e.stopPropagation();
    setDeleteConfirmation({
        id,
        title: "Delete Instrument",
        message: "Are you sure you want to delete this instrument? This cannot be undone."
    });
  };

  const performDelete = () => {
      if (deleteConfirmation && onDelete) {
          onDelete(deleteConfirmation.id);
      }
      setDeleteConfirmation(null);
  };

  const handleSaveAndExit = () => {
      onSave(instrument);
      setViewMode("list");
  }

  // --- Internal Editor Handlers ---
  const handleAddFunction = () => {
    const newFunc = { id: Date.now(), name: "New Function", unit: "V", ranges: [] };
    setInstrument(prev => ({ ...prev, functions: [...prev.functions, newFunc] }));
    setActiveFunctionId(newFunc.id);
  };

  const updateActiveFunction = (key, value) => {
    setInstrument(prev => ({ ...prev, functions: prev.functions.map(f => f.id === activeFunctionId ? { ...f, [key]: value } : f) }));
  };

  const handleDeleteFunction = (id) => {
    setInstrument(prev => ({ ...prev, functions: prev.functions.filter(f => f.id !== id) }));
    if (activeFunctionId === id) setActiveFunctionId(null);
  };

  const handleAddRange = () => {
    if (!activeFunction) return;
    const newRange = { id: Date.now(), min: 0, max: 0, resolution: 0.0001, tolerances: {} };
    const updatedRanges = [...activeFunction.ranges, newRange].sort((a, b) => parseFloat(a.min) - parseFloat(b.min));
    setInstrument(prev => ({ ...prev, functions: prev.functions.map(f => f.id === activeFunctionId ? { ...f, ranges: updatedRanges } : f) }));
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
    setInstrument(prev => ({
      ...prev,
      functions: prev.functions.map(f => {
        if (f.id !== activeFunctionId) return f;
        return { ...f, ranges: f.ranges.map(r => r.id === editingRange.id ? { ...r, tolerances: editingRange.tolerances } : r) };
      })
    }));
    setEditingRange(null);
  };

  const updateRangeBounds = (rangeId, field, value) => {
    setInstrument(prev => ({
      ...prev,
      functions: prev.functions.map(f => {
        if (f.id !== activeFunctionId) return f;
        return { ...f, ranges: f.ranges.map(r => r.id === rangeId ? { ...r, [field]: value } : r) };
      })
    }));
  };

  const handleDeleteRange = (rangeId) => {
    setInstrument(prev => ({
      ...prev,
      functions: prev.functions.map(f => {
        if (f.id !== activeFunctionId) return f;
        return { ...f, ranges: f.ranges.filter(r => r.id !== rangeId) };
      })
    }));
  };

  if (!isOpen) return null;

  // --- RENDER START ---
  return (
    <>
      {/* 1. Global Overlay for critical confirmations only */}
      {deleteConfirmation && (
        <div className="modal-overlay" style={{ zIndex: 3000, backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="modal-content" style={{ maxWidth: "400px" }}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
               <h3 style={{margin:0}}>{deleteConfirmation.title}</h3>
               <button onClick={() => setDeleteConfirmation(null)} className="modal-close-button" style={{position:'static'}}>&times;</button>
            </div>
            <p>{deleteConfirmation.message}</p>
            <div className="modal-actions" style={{ justifyContent: "flex-end", gap: "10px" }}>
              <button className="button" style={{ backgroundColor: "var(--status-bad)" }} onClick={performDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Floating Window Container */}
      <div 
        ref={containerRef}
        className="modal-content floating-window-content"
        style={{
            position: 'fixed',
            top: position.y,
            left: position.x,
            margin: 0,
            width: '1000px',
            maxWidth: '90vw',
            height: '85vh',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 2000,
            overflow: 'hidden' /* Critical for resize */
        }}
      >
        {/* --- Header Area (Draggable) --- */}
        <div 
            style={{
                display:'flex', 
                justifyContent:'space-between', 
                alignItems:'center', 
                paddingBottom: '10px', 
                marginBottom: '10px', 
                borderBottom: '1px solid var(--border-color)',
                cursor: 'move',
                userSelect: 'none'
            }}
            onMouseDown={handleMouseDown}
        >
            <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                <FontAwesomeIcon icon={faGripHorizontal} style={{color:'var(--text-color-muted)'}} />
                {viewMode === 'edit' && <button className="icon-action-btn" onClick={() => setViewMode("list")} title="Back to Library"><FontAwesomeIcon icon={faArrowLeft}/></button>}
                <h3 style={{margin:0, fontSize: '1.2rem'}}><FontAwesomeIcon icon={faRadio} style={{marginRight: '10px'}}/> {viewMode === 'list' ? 'Instrument Library' : 'Edit Instrument'}</h3>
            </div>
            <button onClick={onClose} className="modal-close-button" style={{position:'static'}}>&times;</button>
        </div>

        {/* --- Content Area --- */}
        <div style={{flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative'}}>
            
            {/* SUB-MODAL: Range Editor (Overlays the content area but stays inside window) */}
            {editingRange && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                    backgroundColor: 'var(--content-background)', 
                    zIndex: 10, 
                    display: 'flex', flexDirection: 'column',
                    padding: '20px'
                }}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                        <h3 style={{margin:0}}>Edit Tolerances</h3>
                        <button onClick={() => setEditingRange(null)} className="modal-icon-button secondary" style={{border:'none', background:'transparent', padding:'0 5px'}}><FontAwesomeIcon icon={faTimes} size="lg" /></button>
                    </div>
                    <div style={{marginBottom:'10px', fontSize:'0.9rem', color:'var(--text-color-muted)'}}>
                        Range: <strong>{editingRange.min} - {editingRange.max} {activeFunction.unit}</strong>
                    </div>
                    <div className="modal-body-scrollable" style={{flex: 1}}>
                        <ToleranceForm tolerance={editingRange.tolerances} setTolerance={handleToleranceUpdate} isUUT={false} referencePoint={{ unit: activeFunction.unit }} />
                    </div>
                    <div className="modal-actions" style={{justifyContent: 'flex-end', marginTop: '10px'}}>
                        <button className="modal-icon-button primary" onClick={saveRangeSpecs} title="Save Specifications"><FontAwesomeIcon icon={faCheck} /></button>
                    </div>
                </div>
            )}

            {/* VIEW: List */}
            {viewMode === "list" && (
                <>
                    <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
                        <div style={{position:'relative', flex: 1}}>
                            <FontAwesomeIcon icon={faSearch} style={{position:'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-color-muted)'}}/>
                            <input 
                                type="text" 
                                placeholder="Search library..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{width: '100%', padding: '10px 10px 10px 35px', borderRadius:'6px', border:'1px solid var(--border-color)'}}
                            />
                        </div>
                        <button className="button" onClick={handleCreateNew} title="Create New Instrument" style={{padding: '0 15px'}}>
                            <FontAwesomeIcon icon={faPlus} />
                        </button>
                    </div>

                    <div style={{flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px'}}>
                        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem'}}>
                            <thead style={{position: 'sticky', top: 0, backgroundColor: 'var(--component-header-bg)', zIndex: 1}}>
                                <tr style={{textAlign:'left', borderBottom:'2px solid var(--border-color)'}}>
                                    <th style={{padding:'12px', width:'20%'}}>Manufacturer</th>
                                    <th style={{padding:'12px', width:'15%'}}>Model</th>
                                    <th style={{padding:'12px', width:'30%'}}>Description</th>
                                    <th style={{padding:'12px', width:'25%'}}>Functions</th>
                                    <th style={{padding:'12px', width:'10%', textAlign:'center'}}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredInstruments.map(inst => {
                                    const isExpanded = expandedDetail?.instId === inst.id;
                                    return (
                                        <React.Fragment key={inst.id}>
                                            <tr 
                                                style={{
                                                    borderBottom: isExpanded ? 'none' : '1px solid var(--border-color)', 
                                                    cursor: 'pointer',
                                                    backgroundColor: isExpanded ? 'var(--background-secondary)' : 'transparent',
                                                    transition: 'background 0.2s'
                                                }}
                                                onClick={() => setExpandedDetail(prev => prev?.instId === inst.id ? null : {instId: inst.id, funcId: inst.functions[0]?.id})}
                                            >
                                                <td style={{padding:'12px', fontWeight: '600'}}>{inst.manufacturer}</td>
                                                <td style={{padding:'12px', color: 'var(--primary-color)', fontWeight:'bold'}}>{inst.model}</td>
                                                <td style={{padding:'12px', color: 'var(--text-color-muted)'}}>{inst.description}</td>
                                                <td style={{padding:'12px'}}>
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                                                        {inst.functions.map(f => {
                                                            const isFuncActive = isExpanded && expandedDetail.funcId === f.id;
                                                            return (
                                                                <button 
                                                                    key={f.id} 
                                                                    className={`status-pill ${isFuncActive ? "active" : ""}`}
                                                                    onClick={(e) => toggleFunctionDetails(e, inst.id, f.id)}
                                                                    style={{
                                                                        marginRight: '0', 
                                                                        fontSize:'0.75rem',
                                                                        border: isFuncActive ? "1px solid var(--primary-color)" : "1px solid var(--border-color)",
                                                                        backgroundColor: isFuncActive ? "var(--input-background)" : "transparent",
                                                                        color: "var(--text-color)",
                                                                        cursor: 'pointer',
                                                                        padding: '2px 8px',
                                                                        borderRadius: '12px'
                                                                    }}
                                                                >
                                                                    {f.name} {isFuncActive ? <FontAwesomeIcon icon={faChevronUp} size="xs" /> : <FontAwesomeIcon icon={faChevronDown} size="xs" />}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                                <td style={{padding:'12px', textAlign: 'center'}}>
                                                    <div style={{display: 'flex', justifyContent: 'center', gap: '10px'}}>
                                                        <button className="btn-icon-only" onClick={(e) => handleEditExisting(e, inst)} title="Edit Instrument"><FontAwesomeIcon icon={faEdit} /></button>
                                                        <button className="btn-icon-only danger" onClick={(e) => handleDeleteInstrument(e, inst.id)} title="Delete Instrument"><FontAwesomeIcon icon={faTrashAlt} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr style={{ backgroundColor: "var(--background-secondary)", borderBottom: "1px solid var(--border-color)" }}>
                                                    <td colSpan="5" style={{ padding: "0" }}>
                                                        <div style={{ padding: "15px 20px", borderLeft: "4px solid var(--primary-color-dim)" }}>
                                                            {(() => {
                                                                const func = inst.functions.find(f => f.id === expandedDetail.funcId);
                                                                if (!func) return <div style={{fontStyle:'italic', color:'var(--text-color-muted)'}}>Select a function to view details.</div>;
                                                                return (
                                                                    <div>
                                                                        <h5 style={{ margin: "0 0 10px 0", color: "var(--text-color)", display: "flex", alignItems: "center", gap: "8px" }}>
                                                                            <FontAwesomeIcon icon={faInfoCircle} color="var(--primary-color)" />
                                                                            Specifications: {func.name} (Base Unit: {func.unit})
                                                                        </h5>
                                                                        <table style={{ width: "100%", fontSize: "0.85rem", backgroundColor: "var(--input-background)", color: "var(--text-color)", borderRadius: "4px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid var(--border-color)"}}>
                                                                            <thead>
                                                                                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--component-header-bg)" }}>
                                                                                    <th style={{ padding: "8px", color: "var(--text-color)", fontWeight: "600" }}>Range Min</th>
                                                                                    <th style={{ padding: "8px", color: "var(--text-color)", fontWeight: "600" }}>Range Max</th>
                                                                                    <th style={{ padding: "8px", color: "var(--text-color)", fontWeight: "600" }}>Resolution</th>
                                                                                    <th style={{ padding: "8px", color: "var(--text-color)", fontWeight: "600" }}>Tolerance</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {func.ranges.map((range, idx) => (
                                                                                    <tr key={range.id || idx} style={{ borderBottom: "1px solid var(--border-color)" }}>
                                                                                        <td style={{ padding: "8px" }}>{range.min}</td>
                                                                                        <td style={{ padding: "8px" }}>{range.max}</td>
                                                                                        <td style={{ padding: "8px" }}>{range.resolution}</td>
                                                                                        <td style={{ padding: "8px", fontFamily: "monospace", color: "var(--primary-color)" }}>{renderToleranceString(range.tolerances)}</td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* VIEW: Editor */}
            {viewMode === "edit" && !editingRange && (
                <div style={{display:'flex', flexDirection:'column', height:'100%'}}>
                    <div className="instrument-meta-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '15px', marginBottom: '20px', padding: '15px', backgroundColor: 'var(--input-background)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div><label>Manufacturer</label><input type="text" value={instrument.manufacturer} onChange={e => setInstrument({...instrument, manufacturer: e.target.value})} /></div>
                        <div><label>Model</label><input type="text" value={instrument.model} onChange={e => setInstrument({...instrument, model: e.target.value})} /></div>
                        <div><label>Description</label><input type="text" value={instrument.description} onChange={e => setInstrument({...instrument, description: e.target.value})} /></div>
                    </div>

                    <div style={{flex: 1, display: 'flex', gap: '20px', overflow: 'hidden', minHeight: 0}}>
                        {/* Sidebar */}
                        <div className="function-sidebar" style={{ width: '250px', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)', paddingRight: '15px' }}>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '10px'}}>
                                <h5 style={{margin:0}}>Functions</h5>
                                <button className="icon-action-btn" onClick={handleAddFunction}><FontAwesomeIcon icon={faPlus}/></button>
                            </div>
                            <div style={{flex: 1, overflowY: 'auto'}}>
                                {instrument.functions.map(f => (
                                    <div key={f.id} onClick={() => setActiveFunctionId(f.id)}
                                        style={{ padding: '10px', borderRadius: '6px', cursor: 'pointer', backgroundColor: activeFunctionId === f.id ? 'var(--primary-color-light)' : 'transparent', border: activeFunctionId === f.id ? '1px solid var(--primary-color)' : '1px solid transparent', marginBottom: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{fontWeight: activeFunctionId === f.id ? '700' : '400'}}>{f.name}</span>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteFunction(f.id); }} style={{background:'none', border:'none', color: 'var(--text-color-muted)', cursor:'pointer'}}><FontAwesomeIcon icon={faTrashAlt} size="sm" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Range Editor */}
                        <div className="range-editor" style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
                            {activeFunction ? (
                                <>
                                    <div style={{display:'flex', gap:'15px', marginBottom:'15px', alignItems: 'flex-end'}}>
                                        <div style={{flex: 1}}><label>Function Name</label><input type="text" value={activeFunction.name} onChange={e => updateActiveFunction('name', e.target.value)} /></div>
                                        <div style={{width: '150px'}}>
                                            <label>Base Unit</label>
                                            <Select 
                                                value={
                                                    categorizedUnitOptions
                                                        .flatMap(g => g.options ? g.options : g)
                                                        .find(opt => opt.value === activeFunction.unit) || null
                                                }
                                                onChange={opt => updateActiveFunction('unit', opt.value)}
                                                options={categorizedUnitOptions}
                                                menuPortalTarget={document.body}
                                                styles={portalStyle}
                                                className="react-select-container"
                                                classNamePrefix="react-select"
                                            />
                                        </div>
                                    </div>
                                    <div style={{flex: 1, backgroundColor: 'var(--input-background)', borderRadius: '8px', border: '1px solid var(--border-color)', display:'flex', flexDirection:'column', overflow:'hidden'}}>
                                        <div style={{padding:'10px', borderBottom:'1px solid var(--border-color)', display:'flex', justifyContent:'space-between', alignItems:'center', backgroundColor:'var(--component-header-bg)'}}>
                                            <h5 style={{margin:0}}><FontAwesomeIcon icon={faLayerGroup} /> Ranges</h5>
                                            <button className="icon-action-btn" onClick={handleAddRange}><FontAwesomeIcon icon={faPlus} /></button>
                                        </div>
                                        <div style={{flex: 1, overflowY:'auto', padding:'10px'}}>
                                            <table style={{width:'100%', borderCollapse:'collapse'}}>
                                                <thead><tr style={{textAlign:'left', borderBottom:'2px solid var(--border-color)'}}><th>Min</th><th>Max</th><th>Res</th><th>Tol</th><th></th><th></th></tr></thead>
                                                <tbody>
                                                    {activeFunction.ranges.map(range => (
                                                        <tr key={range.id} style={{borderBottom:'1px solid var(--border-color)'}}>
                                                            <td><input type="number" step="any" value={range.min} onChange={e => updateRangeBounds(range.id, 'min', e.target.value)} style={{width:'80px'}} /></td>
                                                            <td><input type="number" step="any" value={range.max} onChange={e => updateRangeBounds(range.id, 'max', e.target.value)} style={{width:'80px'}} /></td>
                                                            <td><input type="number" step="any" value={range.resolution} onChange={e => updateRangeBounds(range.id, 'resolution', e.target.value)} style={{width:'80px'}} /></td>
                                                            <td style={{fontSize:'0.85rem'}}>{formatToleranceSummary(range.tolerances)}</td>
                                                            <td><button className="btn-icon-only" onClick={() => setEditingRange({...range})}><FontAwesomeIcon icon={faEdit}/></button></td>
                                                            <td><button className="btn-icon-only danger" onClick={() => handleDeleteRange(range.id)}><FontAwesomeIcon icon={faTrashAlt}/></button></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--text-color-muted)'}}>Select or create a function.</div>
                            )}
                        </div>
                    </div>

                    <div className="modal-actions" style={{ marginTop: '20px' }}>
                        <button className="modal-icon-button primary" onClick={handleSaveAndExit} title="Save Instrument"><FontAwesomeIcon icon={faCheck} /></button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </>
  );
};

export default InstrumentBuilderModal;