import React, { useState, useEffect, useMemo } from "react";
import { unitSystem } from "../App";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrashAlt, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';
// Define all possible tolerance components and their default states
const componentDefinitions = {
  reading: {
    label: "% of Reading",
    defaultState: { high: "", unit: "%" },
  },
  range: {
    label: "% of Full Scale (Range)",
    defaultState: { value: "", high: "", unit: "%" },
  },
  floor: {
    label: "Floor (Absolute)",
    defaultState: { high: "", unit: "" }, // Default unit is set dynamically from nominal
  },
  db: {
    label: "dB Component",
    defaultState: { high: "", multiplier: 20, ref: 1 },
  },
};

/**
 * A dynamic form for building a tolerance specification by adding/removing components.
 */
const ToleranceFormContent = ({ tolerance, setTolerance, isUUT, nominal }) => {
  const [componentToAdd, setComponentToAdd] = useState("");

  const unitOptions = useMemo(() => {
    return nominal?.unit
      ? unitSystem.getRelevantUnits(nominal.unit)
      : ["%", "ppm"];
  }, [nominal]);

  // Set the default unit for the 'floor' component based on the nominal parameter's unit
  useEffect(() => {
    if (nominal?.unit) {
      componentDefinitions.floor.defaultState.unit = nominal.unit;
    }
  }, [nominal]);

  // Generic handler to update any field in the tolerance state
  const handleChange = (e) => {
    const { name, value, dataset } = e.target;
    const { field, type } = dataset; // `type` is 'reading', 'range', 'misc', etc.

    if (type === "misc") {
      // For standalone fields like measuringResolution
      setTolerance((prev) => ({ ...prev, [name]: value }));
      return;
    }

    // For fields within a component (e.g., the 'high' field of the 'reading' component)
    setTolerance((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }));
  };

  // Adds a selected component to the tolerance object
  const handleAddComponent = () => {
    if (componentToAdd && !tolerance[componentToAdd]) {
      setTolerance((prev) => ({
        ...prev,
        [componentToAdd]: componentDefinitions[componentToAdd].defaultState,
      }));
      setComponentToAdd(""); // Reset dropdown after adding
    }
  };

  // Removes a component from the tolerance object
  const handleRemoveComponent = (key) => {
    setTolerance((prev) => {
      const newTolerance = { ...prev };
      delete newTolerance[key];
      return newTolerance;
    });
  };

  // Renders the form inputs for a specific component card
  const renderComponentCard = (key) => {
    const componentData = tolerance[key];
    if (!componentData) return null;

    let content = null;
    switch (key) {
      case "reading":
        content = (
          <div className="config-stack">
            <label>Tolerance (±)</label>
            <input
              type="number"
              step="any"
              data-type="reading"
              data-field="high"
              value={componentData.high || ""}
              onChange={handleChange}
              placeholder="e.g., 0.1"
            />
            <label>Units</label>
            <select
              data-type="reading"
              data-field="unit"
              value={componentData.unit || "%"}
              onChange={handleChange}
            >
              {["%", "ppm"].map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        );
        break;
      case "range":
        content = (
          <div className="config-stack">
            <label>Range (FS) Value</label>
            <input
              type="number"
              step="any"
              data-type="range"
              data-field="value"
              value={componentData.value || ""}
              onChange={handleChange}
              placeholder="e.g., 100"
            />
            <label>Tolerance (±)</label>
            <input
              type="number"
              step="any"
              data-type="range"
              data-field="high"
              value={componentData.high || ""}
              onChange={handleChange}
              placeholder="e.g., 0.05"
            />
            <label>Units</label>
            <select
              data-type="range"
              data-field="unit"
              value={componentData.unit || "%"}
              onChange={handleChange}
            >
              {["%"].map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        );
        break;
      case "floor":
        content = (
          <div className="config-stack">
            <label>Tolerance (±)</label>
            <input
              type="number"
              step="any"
              data-type="floor"
              data-field="high"
              value={componentData.high || ""}
              onChange={handleChange}
              placeholder="e.g., 0.001"
            />
            <label>Units</label>
            <select
              data-type="floor"
              data-field="unit"
              value={componentData.unit || nominal.unit}
              onChange={handleChange}
            >
              {unitOptions
                .filter((u) => u !== "%" && u !== "ppm")
                .map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
            </select>
          </div>
        );
        break;
      case "db":
        content = (
          <div className="config-stack">
            <label>Tolerance (± dB)</label>
            <input
              type="number"
              step="any"
              data-type="db"
              data-field="high"
              value={componentData.high || ""}
              onChange={handleChange}
              placeholder="e.g., 0.5"
            />
            <label>dB Equation Multiplier</label>
            <input
              type="number"
              step="any"
              data-type="db"
              data-field="multiplier"
              value={componentData.multiplier || 20}
              onChange={handleChange}
            />
            <label>dB Reference Value</label>
            <input
              type="number"
              step="any"
              data-type="db"
              data-field="ref"
              value={componentData.ref || 1}
              onChange={handleChange}
            />
          </div>
        );
        break;
      default:
        return null;
    }

    return (
      <div className="component-card" key={key}>
        <div className="component-header">
          <h5>{componentDefinitions[key].label}</h5>
          <button
            onClick={() => handleRemoveComponent(key)}
            className="remove-component-btn"
            title="Remove component"
          >
            <FontAwesomeIcon icon={faTrashAlt} />
          </button>
        </div>
        <div className="component-body">{content}</div>
      </div>
    );
  };

  const addedComponents = Object.keys(tolerance).filter(
    (key) => componentDefinitions[key]
  );
  const availableComponents = Object.keys(componentDefinitions).filter(
    (key) => !tolerance[key]
  );

  return (
    <>
      <div className="components-container">
        {addedComponents.length > 0 ? (
          addedComponents.map((key) => renderComponentCard(key))
        ) : (
          <div
            className="placeholder-content"
            style={{
              minHeight: "100px",
              margin: "10px 0",
              backgroundColor: "transparent",
            }}
          >
            <p>No tolerance components added.</p>
          </div>
        )}
      </div>

      <div className="add-component-section">
        <select
          value={componentToAdd}
          onChange={(e) => setComponentToAdd(e.target.value)}
          disabled={availableComponents.length === 0}
        >
          <option value="">-- Select component to add --</option>
          {availableComponents.map((key) => (
            <option key={key} value={key}>
              {componentDefinitions[key].label}
            </option>
          ))}
        </select>
        <button
          className="tolerance-add-btn"
          onClick={handleAddComponent}
          disabled={!componentToAdd}
          title="Add Component"
        >
          <FontAwesomeIcon icon={faPlus} />
        </button>
      </div>

      {isUUT && (
        <div
          className="form-section"
          style={{
            marginTop: "20px",
            borderTop: "1px solid var(--border-color)",
            paddingTop: "20px",
          }}
        >
          <label>Measuring Resolution (Least Significant Digit)</label>
          <input
            type="number"
            step="any"
            name="measuringResolution"
            data-type="misc"
            value={tolerance.measuringResolution || ""}
            onChange={handleChange}
            placeholder="e.g., 0.001"
          />
        </div>
      )}
    </>
  );
};

const ToleranceToolModal = ({ isOpen, onClose, onSave, testPointData }) => {
  const [activeTab, setActiveTab] = useState("UUT");
  const [uutTolerance, setUutTolerance] = useState({});
  const [tmdeTolerance, setTmdeTolerance] = useState({});

  useEffect(() => {
    if (isOpen && testPointData) {
      // Ensure we load a clean object, removing any undefined keys from older data structures
      const cleanObject = (obj) =>
        Object.fromEntries(
          Object.entries(obj || {}).filter(([_, v]) => v !== undefined)
        );
      setUutTolerance(cleanObject(testPointData.uutTolerance));
      setTmdeTolerance(cleanObject(testPointData.tmdeTolerance));
      setActiveTab("UUT");
    }
  }, [isOpen, testPointData]);

  if (!isOpen) return null;

  const handleSave = () => {
    // Helper to remove any components the user added but left empty
    const cleanupTolerance = (tol) => {
      const cleaned = { ...tol };

      Object.keys(componentDefinitions).forEach((key) => {
        const component = cleaned[key];
        // If the component object exists but its primary value ('high') is empty or zero, remove the whole component
        if (component && !parseFloat(component.high)) {
          delete cleaned[key];
        }
      });

      // Clean up measuringResolution if it's 0 or empty
      if (!parseFloat(cleaned.measuringResolution)) {
        delete cleaned.measuringResolution;
      }
      return cleaned;
    };

    onSave({
      uutTolerance: cleanupTolerance(uutTolerance),
      tmdeTolerance: cleanupTolerance(tmdeTolerance),
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "600px" }}>
        <button onClick={onClose} className="modal-close-button">
          &times;
        </button>
        <h3>Tolerance Editor</h3>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === "UUT" ? "active" : ""}`}
            onClick={() => setActiveTab("UUT")}
          >
            UUT
          </button>
          <button
            className={`modal-tab ${activeTab === "TMDE" ? "active" : ""}`}
            onClick={() => setActiveTab("TMDE")}
          >
            TMDE
          </button>
        </div>

        {activeTab === "UUT" && (
          <ToleranceFormContent
            tolerance={uutTolerance}
            setTolerance={setUutTolerance}
            isUUT={true}
            nominal={testPointData.testPointInfo.parameter}
          />
        )}

        {activeTab === "TMDE" && (
          <ToleranceFormContent
            tolerance={tmdeTolerance}
            setTolerance={setTmdeTolerance}
            isUUT={false}
            nominal={testPointData.testPointInfo.parameter}
          />
        )}

        <div className="modal-actions">
          <button
            className="modal-icon-button secondary"
            onClick={onClose}
            title="Cancel"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
          <button
            className="modal-icon-button primary"
            onClick={handleSave}
            title="Store and Return"
          >
            <FontAwesomeIcon icon={faCheck} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ToleranceToolModal;
