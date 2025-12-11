import React, { useState, useEffect, useMemo, useCallback } from "react";
import Select from "react-select"; 
import ToleranceForm from "../../../components/common/ToleranceForm";
import { unitSystem, findInstrumentTolerance } from "../../../utils/uncertaintyMath";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faPlus, faBookOpen } from "@fortawesome/free-solid-svg-icons";
import InstrumentLookupModal from "./InstrumentLookupModal";

// --- Configuration for Unit Grouping (Copied from ToleranceForm) ---
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

// Helper to transform flat unit list into React-Select Grouped Options
const getCategorizedUnitOptions = (allUnits, referenceUnit) => {
  const options = [];
  const usedUnits = new Set();

  // 1. Prioritize Reference Unit (Smart Context)
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

  // 2. Add remaining categories
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

  // 3. Catch-all for leftovers
  const leftovers = allUnits
    .filter((u) => !usedUnits.has(u) && !["%", "ppm", "dB", "ppb"].includes(u))
    .map((u) => ({ value: u, label: u }));

  if (leftovers.length > 0) {
    options.push({ label: "Other", options: leftovers });
  }

  return options;
};

// --- Style to ensure dropdown isn't clipped by modal ---
const portalStyle = {
  menuPortal: (base) => ({
    ...base,
    zIndex: 99999,
  }),
  menu: (base) => ({
    ...base,
    zIndex: 99999,
  }),
};

const AddTmdeModal = ({
  isOpen,
  onClose,
  onSave,
  testPointData,
  initialTmdeData = null,
  hasParentOverlay = false,
  instruments = [] 
}) => {
  const [isLookupOpen, setIsLookupOpen] = useState(false);

  const uutMeasurementPoint = useMemo(
    () => testPointData?.testPointInfo?.parameter || { value: "", unit: "" },
    [testPointData?.testPointInfo?.parameter]
  );

  const isDerived = testPointData?.measurementType === "derived";
  const variableMappings = useMemo(
    () => testPointData?.variableMappings || {},
    [testPointData?.variableMappings]
  );
  const availableTypes = useMemo(
    () => Object.values(variableMappings),
    [variableMappings]
  );

  const getInitialState = useCallback(() => {
    const defaultState = {
      id: Date.now(),
      name: "New TMDE",
      measurementPoint: isDerived ? { value: "", unit: "" } : { ...uutMeasurementPoint },
      variableType:
        isDerived && availableTypes.length > 0 ? availableTypes[0] : "",
      quantity: 1,
    };

    if (initialTmdeData) {
      const existingData = JSON.parse(JSON.stringify(initialTmdeData));
      if (!existingData.measurementPoint) {
        existingData.measurementPoint = isDerived ? { value: "", unit: "" } : { ...uutMeasurementPoint };
      }
      if (!existingData.hasOwnProperty("variableType")) {
        existingData.variableType =
          isDerived && availableTypes.length > 0 ? availableTypes[0] : "";
      }
      if (!existingData.id) {
        existingData.id = Date.now() + Math.random();
      }
      return { ...defaultState, ...existingData };
    }
    return defaultState;
  }, [uutMeasurementPoint, initialTmdeData, isDerived, availableTypes]);

  const [tmde, setTmde] = useState(getInitialState());
  const [useUutRef, setUseUutRef] = useState(!isDerived);

  const allUnits = useMemo(() => Object.keys(unitSystem.units), []);
  
  const physicalUnitOptions = useMemo(() => {
    return getCategorizedUnitOptions(allUnits, tmde.measurementPoint?.unit);
  }, [allUnits, tmde.measurementPoint?.unit]);

  useEffect(() => {
    if (isOpen) {
      const initialState = getInitialState();
      setTmde(initialState);
      setUseUutRef(!isDerived); 
      setIsLookupOpen(false);
    }
  }, [isOpen, getInitialState, isDerived]);

  useEffect(() => {
    if (!isDerived && uutMeasurementPoint) {
      setTmde((prev) => ({
        ...prev,
        measurementPoint: { ...uutMeasurementPoint },
      }));
    }
  }, [uutMeasurementPoint, isDerived]);

  // Handle Import from Instrument Library
  const handleInstrumentImport = (instrument) => {
    const currentVal = tmde.measurementPoint?.value;
    const currentUnit = tmde.measurementPoint?.unit;

    if (!currentVal || !currentUnit) {
      alert("Please ensure the Measurement Point has a value and unit before importing specifications.");
      return;
    }

    // FIX 1: Parse value to ensure numeric comparison works in the lookup utility
    const numericVal = parseFloat(currentVal);
    if (isNaN(numericVal)) {
        alert("Invalid measurement value. Please enter a number.");
        return;
    }

    const matchedData = findInstrumentTolerance(instrument, numericVal, currentUnit);

    if (matchedData) {
      // FIX 2: Robustly find the specs (handle both 'tolerances' and 'tolerance' keys)
      // This solves the issue of specs not populating if the property name differs.
      const specs = matchedData.tolerances || matchedData.tolerance || {};

      setTmde(prev => ({
        ...prev,
        name: `${instrument.manufacturer} ${instrument.model}`, 
        
        // FIX 3: Explicitly remove measuringResolution so it doesn't persist from previous states
        // This solves the issue of "Resolution" appearing in the budget when it shouldn't.
        measuringResolution: undefined, 
        
        // Apply the found specs (Reading, Range, etc.)
        ...specs
      }));
    } else {
      alert(`Could not find a matching range in ${instrument.model} for ${currentVal} ${currentUnit}.`);
    }
  };

  const handleSave = (andClose = true) => {
    const cleanupTolerance = (tol) => {
      const cleaned = { ...tol };
      const componentKeys = ["reading", "readings_iv", "range", "floor", "db"];
      componentKeys.forEach((key) => {
        if (
          cleaned[key] &&
          (cleaned[key].high === "" || isNaN(parseFloat(cleaned[key].high)))
        ) {
          delete cleaned[key];
        }
      });
      if (!isDerived && cleaned.hasOwnProperty("variableType")) {
        delete cleaned.variableType;
      }
      return cleaned;
    };

    const finalTmde = {
      ...tmde,
      quantity: parseInt(tmde.quantity, 10) || 1,
    };

    onSave(cleanupTolerance(finalTmde), andClose);

    if (!andClose) {
      setTmde(getInitialState());
      setUseUutRef(!isDerived);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="modal-content" style={{ maxWidth: "600px" }}>
      
      {/* Nested Lookup Modal */}
      <InstrumentLookupModal 
         isOpen={isLookupOpen} 
         onClose={() => setIsLookupOpen(false)} 
         instruments={instruments}
         onSelect={handleInstrumentImport} 
      />

      <button onClick={onClose} className="modal-close-button">
        &times;
      </button>
      
      {/* Cleaned Header (Button Removed) */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h3>{initialTmdeData ? (tmde.name || "Edit TMDE") : "Add New TMDE"}</h3>
      </div>

      <div className="modal-body-scrollable">
        <div className="tmde-header">
          <div className="details-grid">
            <div className="form-section">
              <label>TMDE Name</label>
              {/* Flex Container for Input + Library Button */}
              <div style={{display: 'flex', gap: '10px'}}>
                  <input
                    type="text"
                    value={tmde.name || ""}
                    onChange={(e) => setTmde({ ...tmde, name: e.target.value })}
                    placeholder="e.g., Standard DMM"
                    style={{flex: 1}}
                  />
                  <button 
                      className="btn-icon-only" 
                      onClick={() => setIsLookupOpen(true)}
                      title="Import from Instrument Library"
                      style={{ width: '42px', height: '42px', fontSize: '1rem', flexShrink: 0 }}
                  >
                      <FontAwesomeIcon icon={faBookOpen} />
                  </button>
              </div>
            </div>

            <div className="form-section">
              <label>Quantity</label>
              <input
                type="number"
                min="1"
                step="1"
                value={tmde.quantity || 1}
                onChange={(e) =>
                  setTmde({
                    ...tmde,
                    quantity: parseInt(e.target.value, 10) || 1,
                  })
                }
              />
            </div>
          </div>

          {isDerived && availableTypes.length > 0 && (
            <div className="form-section">
              <label>Variable Type (Input to Equation)</label>
              <select
                value={tmde.variableType || ""}
                onChange={(e) =>
                  setTmde({ ...tmde, variableType: e.target.value })
                }
              >
                <option value="">-- Select Type --</option>
                {availableTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-section">
            <label>Measurement Point</label>
            
            {!isDerived ? (
                <div style={{ 
                    padding: '10px 12px', 
                    backgroundColor: 'var(--primary-color-light)', 
                    color: 'var(--primary-color-dark)',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    {uutMeasurementPoint.value} {uutMeasurementPoint.unit}
                </div>
            ) : (
                <div className="manual-input-container" style={{marginTop: '5px', borderTop: 'none', paddingTop: 0}}>
                    <div 
                        className="input-with-unit"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 120px",
                            gap: "10px",
                        }}
                    >
                        <input
                            type="text"
                            placeholder="Value"
                            value={tmde.measurementPoint?.value || ""}
                            onChange={(e) =>
                                setTmde({
                                    ...tmde,
                                    measurementPoint: {
                                        ...(tmde.measurementPoint || {}),
                                        value: e.target.value,
                                    },
                                })
                            }
                            style={{ width: '100%' }}
                        />
                        
                        <Select
                            value={
                                physicalUnitOptions
                                    .flatMap(g => g.options ? g.options : g)
                                    .find(opt => opt.value === tmde.measurementPoint?.unit) || null
                            }
                            onChange={(option) =>
                                setTmde({
                                    ...tmde,
                                    measurementPoint: {
                                        ...(tmde.measurementPoint || {}),
                                        unit: option ? option.value : "",
                                    },
                                })
                            }
                            options={physicalUnitOptions}
                            className="react-select-container"
                            classNamePrefix="react-select"
                            placeholder="Unit"
                            isSearchable={true}
                            menuPortalTarget={document.body}
                            menuPosition="fixed"
                            styles={portalStyle}
                        />
                    </div>
                </div>
            )}
          </div>
        </div>
        <ToleranceForm
          tolerance={tmde}
          setTolerance={setTmde}
          isUUT={false}
          referencePoint={tmde.measurementPoint}
        />
      </div>

      <div
        className="modal-actions"
        style={{ justifyContent: "flex-end", alignItems: "center" }}
      >
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {!initialTmdeData && (
            <button
              className="modal-icon-button primary"
              onClick={() => handleSave(false)} 
              title="Save this TMDE and add another"
            >
              <FontAwesomeIcon icon={faPlus} />
            </button>
          )}

          <button
            className="modal-icon-button primary"
            onClick={() => handleSave(true)} 
            title={initialTmdeData ? "Save Changes" : "Save and Close"}
          >
            <FontAwesomeIcon icon={faCheck} />
          </button>
        </div>
      </div>
    </div>
  );

  if (hasParentOverlay) {
    return modalContent;
  }

  return <div className="modal-overlay">{modalContent}</div>;
};

export default AddTmdeModal;