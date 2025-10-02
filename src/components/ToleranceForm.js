import React, { useMemo, useEffect, useState, useRef } from "react";
import {
  unitSystem,
  errorDistributions,
  getToleranceUnitOptions,
} from "../App";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrashAlt, faPlus } from "@fortawesome/free-solid-svg-icons";

// Define all possible tolerance components and their default states
const componentDefinitions = {
  reading: {
    label: "Reading (e.g., % of Value)",
    defaultState: {
      high: "",
      low: "",
      unit: "%",
      distribution: "1.960",
      symmetric: true,
    },
  },
  range: {
    label: "Range (e.g., % of Full Scale)",
    defaultState: {
      value: "",
      high: "",
      low: "",
      unit: "%",
      distribution: "1.960",
      symmetric: true,
    },
  },
  floor: {
    label: "Floor (Absolute Value)",
    defaultState: {
      high: "",
      low: "",
      unit: "",
      distribution: "1.960",
      symmetric: true,
    },
  },
  db: {
    label: "dB Component",
    defaultState: {
      high: "",
      low: "",
      multiplier: 20,
      ref: 1,
      distribution: "1.960",
      symmetric: true,
    },
  },
};

const ToleranceForm = ({
  tolerance,
  setTolerance,
  isUUT,
  referencePoint,
}) => {
  const [isAddComponentVisible, setAddComponentVisible] = useState(false);
  const addComponentRef = useRef(null);
  const allUnits = useMemo(() => Object.keys(unitSystem.units), []);

  const toleranceUnitOptions = useMemo(() => {
    return getToleranceUnitOptions(referencePoint?.unit);
  }, [referencePoint]);
  
  // Effect to handle clicks outside the dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
        if (addComponentRef.current && !addComponentRef.current.contains(event.target)) {
            setAddComponentVisible(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (referencePoint?.unit && !componentDefinitions.floor.defaultState.unit) {
      componentDefinitions.floor.defaultState.unit = referencePoint.unit;
    }
  }, [referencePoint]);

  const handleChange = (e) => {
    const { name, value, checked, dataset } = e.target;

    if (dataset.type === "misc") {
      setTolerance((prev) => ({ ...prev, [name]: value }));
      return;
    }

    const { field, componentKey } = dataset;

    setTolerance((prev) => {
      const newTol = { ...prev };
      const comp = { ...newTol[componentKey] };
      let newHigh = comp.high;
      let newLow = comp.low;
      let newSymmetric = comp.symmetric;

      if (field === "symmetric") newSymmetric = checked;
      else if (field === "high") newHigh = value;
      else if (field === "low") newLow = value;
      else comp[field] = value;
      
      if (newSymmetric) {
        if (field === "high" || (field === "symmetric" && newHigh)) {
          const highVal = parseFloat(newHigh);
          newLow = !isNaN(highVal) ? String(-highVal) : "";
        }
      }
      
      comp.high = newHigh;
      comp.low = newLow;
      comp.symmetric = newSymmetric;
      newTol[componentKey] = comp;
      return newTol;
    });
  };

  const handleAddComponent = (componentKey) => {
    if (componentKey && !tolerance[componentKey]) {
      setTolerance((prev) => ({
        ...prev,
        [componentKey]: { ...componentDefinitions[componentKey].defaultState },
      }));
    }
    setAddComponentVisible(false); // Hide menu after adding
  };

  const handleRemoveComponent = (key) => {
    setTolerance((prev) => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  };

  const renderComponentCard = (key) => {
    const componentData = tolerance[key];
    if (!componentData) return null;

    let content = null;
    const distributionOptions = errorDistributions.filter(
      (d) => d.label !== "Std. Uncertainty"
    );

    const commonFields = (
      <>
        <div className="input-group-asymmetric">
          <div>
            <label>Upper Limit</label>
            <input type="number" step="any" data-component-key={key} data-field="high" value={componentData.high || ""} onChange={handleChange} placeholder="+ value" />
          </div>
          <div>
            <label>Lower Limit</label>
            <input type="number" step="any" data-component-key={key} data-field="low" value={componentData.low || ""} onChange={handleChange} disabled={componentData.symmetric} placeholder="- value" />
          </div>
        </div>
        <div className="toggle-switch-container" style={{ margin: '15px 0' }}>
            <input 
                type="checkbox" 
                id={`symmetric_${key}_${tolerance.id || 'new'}`} 
                data-component-key={key} 
                data-field="symmetric" 
                className="toggle-switch-checkbox"
                checked={!!componentData.symmetric} 
                onChange={handleChange} 
            />
            {/* THIS IS THE CORRECTED LINE */}
            <label className="toggle-switch-label" htmlFor={`symmetric_${key}_${tolerance.id || 'new'}`}>
                <span className="toggle-switch-switch" />
            </label>
            <label htmlFor={`symmetric_${key}_${tolerance.id || 'new'}`} className="toggle-option-label">
                Symmetric Limits
            </label>
        </div>
      </>
    );

    const distributionSelect = (
      <>
        <label>Distribution</label>
        <select data-component-key={key} data-field="distribution" value={componentData.distribution || "1.960"} onChange={handleChange}>
          {distributionOptions.map((dist) => (<option key={dist.value} value={dist.value}>{dist.label}</option>))}
        </select>
      </>
    );

    switch (key) {
      case "reading":
        content = (
          <div className="config-stack">
            {commonFields}
            <label>Units</label>
            <select data-component-key="reading" data-field="unit" value={componentData.unit || "%"} onChange={handleChange}>
              {toleranceUnitOptions.map((u) => (<option key={u} value={u}>{u}</option>))}
            </select>
            {distributionSelect}
          </div>
        );
        break;
      case "range":
        content = (
          <div className="config-stack">
            <label>Range (FS) Value</label>
            <input type="number" step="any" data-component-key="range" data-field="value" value={componentData.value || ""} onChange={handleChange} placeholder="e.g., 100" />
            {commonFields}
            <label>Units</label>
            <select data-component-key="range" data-field="unit" value={componentData.unit || "%"} onChange={handleChange}>
              {toleranceUnitOptions.map((u) => (<option key={u} value={u}>{u}</option>))}
            </select>
            {distributionSelect}
          </div>
        );
        break;
      case "floor":
        content = (
          <div className="config-stack">
            {commonFields}
            <label>Units</label>
            <select data-component-key="floor" data-field="unit" value={componentData.unit || referencePoint?.unit} onChange={handleChange}>
              {allUnits.filter((u) => !["%", "ppm", "dB"].includes(u)).map((u) => (<option key={u} value={u}>{u}</option>))}
            </select>
            {distributionSelect}
          </div>
        );
        break;
      case "db":
        content = (
          <div className="config-stack">
            {commonFields}
            <label>dB Equation Multiplier</label>
            <input type="number" step="any" data-component-key="db" data-field="multiplier" value={componentData.multiplier || 20} onChange={handleChange} />
            <label>dB Reference Value</label>
            <input type="number" step="any" data-component-key="db" data-field="ref" value={componentData.ref || 1} onChange={handleChange} />
            {distributionSelect}
          </div>
        );
        break;
      default: return null;
    }

    return (
      <div className="component-card" key={key}>
        <div className="component-header">
          <h5>{componentDefinitions[key].label}</h5>
          <button onClick={() => handleRemoveComponent(key)} className="remove-component-btn" title="Remove component">
            <FontAwesomeIcon icon={faTrashAlt} />
          </button>
        </div>
        <div className="component-body">{content}</div>
      </div>
    );
  };

  const addedComponents = Object.keys(tolerance).filter((key) => componentDefinitions[key]);
  const availableComponents = Object.keys(componentDefinitions).filter((key) => !tolerance[key]);

  return (
    <>
      <div className="components-container">
        {addedComponents.length > 0 ? (
          addedComponents.map((key) => renderComponentCard(key))
        ) : (
          <div className="placeholder-content" style={{ minHeight: "100px", margin: "10px 0", backgroundColor: "transparent" }}>
            <p>No tolerance components added.</p>
          </div>
        )}
      </div>

      <div className="add-component-wrapper" ref={addComponentRef}>
          {availableComponents.length > 0 && (
              <button
                  className="add-component-button"
                  onClick={() => setAddComponentVisible(prev => !prev)}
                  title="Add new tolerance component"
              >
                  <FontAwesomeIcon icon={faPlus} />
                  <span>Add Component</span>
              </button>
          )}

          {isAddComponentVisible && availableComponents.length > 0 && (
              <div className="add-component-dropdown">
                  <ul>
                      {availableComponents.map(key => (
                          <li key={key} onClick={() => handleAddComponent(key)}>
                              {componentDefinitions[key].label}
                          </li>
                      ))}
                  </ul>
              </div>
          )}
      </div>
      
      {isUUT && (
        <div className="form-section" style={{ marginTop: "20px", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
          <label>Measuring Resolution (Least Significant Digit)</label>
          <div className="input-with-unit">
            <input type="number" step="any" name="measuringResolution" data-type="misc" value={tolerance.measuringResolution || ""} onChange={handleChange} placeholder="e.g., 1" />
            <select name="measuringResolutionUnit" data-type="misc" value={tolerance.measuringResolutionUnit || referencePoint?.unit} onChange={handleChange}>
              {allUnits.filter((u) => !["%", "ppm", "dB"].includes(u)).map((u) => (<option key={u} value={u}>{u}</option>))}
            </select>
          </div>
        </div>
      )}
    </>
  );
};

export default ToleranceForm;