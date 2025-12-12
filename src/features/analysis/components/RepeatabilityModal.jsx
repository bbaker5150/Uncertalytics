import React, { useState, useMemo, useRef, useEffect } from "react";
import Select from "react-select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrashAlt, faUndo, faCheck, faChartLine } from "@fortawesome/free-solid-svg-icons";
import * as math from "mathjs";
import { unitSystem, convertToPPM } from "../../../utils/uncertaintyMath";

// --- Unit Category Definitions ---
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

const portalStyle = {
  menuPortal: (base) => ({ ...base, zIndex: 99999 }),
  menu: (base) => ({ ...base, zIndex: 99999 }),
};

// --- Helper to calculate standard deviation (Sample) ---
const calculateStats = (values) => {
  if (!values || values.length < 2) return { mean: 0, stdDev: 0, dof: 0 };
  
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  
  return { mean, stdDev, dof: n - 1 };
};

const RepeatabilityModal = ({ isOpen, onClose, onSave, uutNominal }) => {
  const [readings, setReadings] = useState([]);
  const [currentInput, setCurrentInput] = useState("");
  const [selectedUnit, setSelectedUnit] = useState(uutNominal?.unit || "V");
  const inputRef = useRef(null);

  // Prepare Unit Options
  const allUnits = useMemo(() => Object.keys(unitSystem.units), []);
  const unitOptions = useMemo(() => {
    return getCategorizedUnitOptions(allUnits, uutNominal?.unit || selectedUnit);
  }, [allUnits, uutNominal?.unit, selectedUnit]);

  // Focus input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setReadings([]);
      setCurrentInput("");
    }
  }, [isOpen]);

  const handleAddReading = () => {
    const val = parseFloat(currentInput);
    if (!isNaN(val)) {
      setReadings([...readings, val]);
      setCurrentInput("");
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddReading();
    }
  };

  const handleRemoveReading = (index) => {
    const newReadings = [...readings];
    newReadings.splice(index, 1);
    setReadings(newReadings);
  };

  const stats = useMemo(() => calculateStats(readings), [readings]);

  const handleSave = () => {
    if (readings.length < 2) return;
    
    onSave({
      stdDev: stats.stdDev,
      mean: stats.mean,
      dof: stats.dof,
      unit: selectedUnit,
      count: readings.length
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 2002 }}>
      <div className="modal-content" style={{ maxWidth: "700px", display: 'flex', flexDirection: 'column' }}>
        <button onClick={onClose} className="modal-close-button">&times;</button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px' }}>
            <div style={{ 
                width: '40px', height: '40px', borderRadius: '8px', 
                backgroundColor: 'var(--primary-color-light)', color: 'var(--primary-color)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'
            }}>
                <FontAwesomeIcon icon={faChartLine} />
            </div>
            <div>
                <h3 style={{ margin: 0, fontSize: '1.3rem' }}>Repeatability Calculator</h3>
            </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', flexGrow: 1, minHeight: '350px' }}>
            {/* LEFT: Input Side */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                
                <div className="form-section" style={{margin: 0}}>
                    <label>Add Measurement</label>
                    <div className="input-group" style={{ gridTemplateColumns: '2fr 1.2fr 40px', alignItems: 'center' }}>
                        <input
                            ref={inputRef}
                            type="number"
                            step="any"
                            value={currentInput}
                            onChange={(e) => setCurrentInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="e.g. 10.001"
                            style={{borderColor: 'var(--primary-color)'}}
                        />
                        
                        <Select
                            value={
                                unitOptions
                                    .flatMap(g => g.options ? g.options : g)
                                    .find(opt => opt.value === selectedUnit) || { value: selectedUnit, label: selectedUnit }
                            }
                            onChange={(option) => setSelectedUnit(option ? option.value : "")}
                            options={unitOptions}
                            className="react-select-container"
                            classNamePrefix="react-select"
                            placeholder="Unit"
                            isSearchable={true}
                            menuPortalTarget={document.body}
                            menuPosition="fixed"
                            styles={portalStyle}
                        />

                        <button 
                            onClick={handleAddReading}
                            title="Add Value"
                            style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                color: 'var(--primary-color)', 
                                cursor: 'pointer', 
                                fontSize: '1.2rem',
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                padding: '0 5px',
                                transition: 'transform 0.2s ease, color 0.2s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <FontAwesomeIcon icon={faPlus} />
                        </button>
                    </div>
                </div>

                <div style={{ 
                    flexGrow: 1, 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px', 
                    padding: '10px',
                    backgroundColor: 'var(--input-background)',
                    overflowY: 'auto',
                    maxHeight: '250px'
                }}>
                    {readings.length === 0 ? (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-color-muted)', fontSize: '0.9rem', opacity: 0.7 }}>
                            <span>No readings added.</span>
                            <span style={{fontSize: '0.8rem'}}>Enter values to calculate statistics.</span>
                        </div>
                    ) : (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {readings.map((val, idx) => (
                                <li key={idx} style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    padding: '8px 10px',
                                    borderBottom: '1px solid var(--border-color)',
                                    fontSize: '0.95rem'
                                }}>
                                    <span style={{fontFamily: 'monospace', fontWeight: '600'}}>
                                        <span style={{color: 'var(--text-color-muted)', marginRight: '10px', fontSize: '0.8rem'}}>#{idx + 1}</span>
                                        {val}
                                    </span>
                                    <button 
                                        onClick={() => handleRemoveReading(idx)}
                                        style={{ background: 'none', border: 'none', color: 'var(--status-bad)', cursor: 'pointer', opacity: 0.6 }}
                                        title="Remove reading"
                                    >
                                        <FontAwesomeIcon icon={faTrashAlt} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                
                {readings.length > 0 && (
                    <button 
                        onClick={() => setReadings([])} 
                        style={{ background: 'none', border: 'none', color: 'var(--text-color-muted)', fontSize: '0.85rem', cursor: 'pointer', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                        <FontAwesomeIcon icon={faUndo} /> Clear All
                    </button>
                )}
            </div>

            {/* RIGHT: Results Side */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ 
                    background: 'var(--component-bg)', 
                    borderRadius: '12px', 
                    padding: '20px', 
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--box-shadow-glow)',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    flexGrow: 1
                }}>
                    <h5 style={{ margin: '0 0 15px 0', color: 'var(--text-color-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Calculated Results</h5>
                    
                    <div style={{ marginBottom: '20px' }}>
                        <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-color-muted)', marginBottom: '5px' }}>Standard Deviation (s)</span>
                        <div style={{ fontSize: '2.2rem', fontWeight: '700', color: 'var(--primary-color)' }}>
                            {stats.stdDev === 0 ? "—" : stats.stdDev.toPrecision(5)}
                            <span style={{ fontSize: '1rem', marginLeft: '8px', color: 'var(--text-color)' }}>{selectedUnit}</span>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                        <div>
                            <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-color-muted)' }}>MEAN</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: '600' }}>{readings.length > 0 ? stats.mean.toPrecision(5) : "—"}</span>
                        </div>
                        <div>
                            <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-color-muted)' }}>DEGREES OF FREEDOM</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: '600' }}>{stats.dof > 0 ? stats.dof : "—"}</span>
                        </div>
                        <div>
                            <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-color-muted)' }}>COUNT (N)</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: '600' }}>{readings.length}</span>
                        </div>
                        <div>
                            <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-color-muted)' }}>RANGE</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                                {readings.length > 0 ? (Math.max(...readings) - Math.min(...readings)).toPrecision(4) : "—"}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="modal-actions">
                    <button 
                        onClick={handleSave}
                        disabled={readings.length < 2}
                        title="Add to Budget"
                        style={{ 
                            background: 'transparent', 
                            border: 'none', 
                            color: readings.length < 2 ? 'var(--text-color-muted)' : 'var(--primary-color)', 
                            cursor: readings.length < 2 ? 'not-allowed' : 'pointer', 
                            fontSize: '1.5rem', /* Slightly larger for main action */
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            opacity: readings.length < 2 ? 0.5 : 1,
                            transition: 'transform 0.2s ease, color 0.2s ease'
                        }}
                        onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.transform = 'scale(1.2)')}
                        onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.transform = 'scale(1)')}
                    >
                        <FontAwesomeIcon icon={faCheck} />
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default RepeatabilityModal;