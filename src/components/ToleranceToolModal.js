import React, { useState, useEffect, useMemo } from "react";
import { unitSystem, errorDistributions } from "../App";
import ContextMenu from "./ContextMenu";
import NotificationModal from "./NotificationModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrashAlt, faCheck, faTimes, faInfoCircle } from '@fortawesome/free-solid-svg-icons';

// Define all possible tolerance components and their default states
const componentDefinitions = {
  reading: {
    label: "% of Reading",
    defaultState: { high: "", unit: "%", distribution: "1.732" },
  },
  range: {
    label: "% of Full Scale (Range)",
    defaultState: { value: "", high: "", unit: "%", distribution: "1.732" },
  },
  floor: {
    label: "Floor (Absolute)",
    defaultState: { high: "", unit: "", distribution: "1.732" },
  },
  db: {
    label: "dB Component",
    defaultState: { high: "", multiplier: 20, ref: 1, distribution: "1.732" },
  },
};

/**
 * A dynamic form for building a tolerance specification by adding/removing components.
 */
const ToleranceFormContent = ({ tolerance, setTolerance, isUUT, nominal }) => {
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

  // Adds a selected component to the tolerance object when selected from the dropdown
  const handleComponentSelect = (e) => {
    const componentKey = e.target.value;
    if (componentKey && !tolerance[componentKey]) {
      setTolerance((prev) => ({
        ...prev,
        [componentKey]: componentDefinitions[componentKey].defaultState,
      }));
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
    const distributionOptions = errorDistributions.filter(d => d.label !== 'Std. Uncertainty');

    const distributionSelect = (
      <>
        <label>Distribution</label>
        <select
          data-type={key}
          data-field="distribution"
          value={componentData.distribution || "1.732"}
          onChange={handleChange}
        >
          {distributionOptions.map((dist) => (
            <option key={dist.value} value={dist.value}>
              {dist.label}
            </option>
          ))}
        </select>
      </>
    );


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
            {distributionSelect}
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
            {distributionSelect}
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
            {distributionSelect}
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
            {distributionSelect}
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
          value=""
          onChange={handleComponentSelect}
          disabled={availableComponents.length === 0}
        >
          <option value="">-- Select component to add --</option>
          {availableComponents.map((key) => (
            <option key={key} value={key}>
              {componentDefinitions[key].label}
            </option>
          ))}
        </select>
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
          <div className="input-with-unit">
            <input
              type="number"
              step="any"
              name="measuringResolution"
              data-type="misc"
              value={tolerance.measuringResolution || ""}
              onChange={handleChange}
              placeholder="e.g., 1"
            />
            <select
              name="measuringResolutionUnit"
              data-type="misc"
              value={tolerance.measuringResolutionUnit || nominal.unit}
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
        </div>
      )}
    </>
  );
};

const ToleranceToolModal = ({ isOpen, onClose, onSave, testPointData }) => {
  const [activeTab, setActiveTab] = useState("UUT"); // 'UUT' or a TMDE object's id
  const [uutTolerance, setUutTolerance] = useState({});
  const [tmdeTolerances, setTmdeTolerances] = useState([]); // Array of TMDE objects
  const [contextMenu, setContextMenu] = useState(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen && testPointData) {
      const cleanObject = (obj) =>
        Object.fromEntries(
          Object.entries(obj || {}).filter(([_, v]) => v !== undefined)
        );

      const initialUutTolerance = cleanObject(testPointData.uutTolerance);
      if (!initialUutTolerance.name) {
        initialUutTolerance.name = 'UUT'; // Default name if not present
      }
      setUutTolerance(initialUutTolerance);

      // Load new array format, or migrate from old object format
      let loadedTmde = testPointData.tmdeTolerances || [];
      if (loadedTmde.length === 0 && testPointData.tmdeTolerance && Object.keys(testPointData.tmdeTolerance).length > 0) {
          loadedTmde = [{
              id: Date.now(),
              name: 'TMDE', // Default name for migrated data
              ...cleanObject(testPointData.tmdeTolerance)
          }];
      }
      setTmdeTolerances(loadedTmde.map(t => ({...t, ...cleanObject(t)})));
      
      setActiveTab("UUT");
    }
  }, [isOpen, testPointData]);

  const handleAddTmde = () => {
    const newTmde = {
      id: Date.now(),
      name: `TMDE ${tmdeTolerances.length + 1}`,
    };
    setTmdeTolerances(prev => [...prev, newTmde]);
    setActiveTab(newTmde.id);
  };

  const handleRemoveTmde = (idToRemove) => {
    setTmdeTolerances(prev => prev.filter(t => t.id !== idToRemove));
    if (activeTab === idToRemove) {
      setActiveTab("UUT");
    }
  };
  
  const handleTmdeNameChange = (id, newName) => {
      setTmdeTolerances(prev => prev.map(t => 
        t.id === id ? { ...t, name: newName } : t
      ));
  };

  const handleTmdeToleranceChange = (id, setter) => {
    setTmdeTolerances(prevTolerances => 
        prevTolerances.map(t => {
            if (t.id === id) {
                return typeof setter === 'function' ? setter(t) : setter;
            }
            return t;
        })
    );
  };

  if (!isOpen) return null;

  const handleSave = () => {
    // Helper to remove any components the user added but left empty
    const cleanupTolerance = (tol) => {
      const cleaned = { ...tol };

      Object.keys(componentDefinitions).forEach((key) => {
        const component = cleaned[key];
        if (component && !parseFloat(component.high)) {
          delete cleaned[key];
        }
      });

      if (!parseFloat(cleaned.measuringResolution)) {
        delete cleaned.measuringResolution;
        delete cleaned.measuringResolutionUnit;
      }
      return cleaned;
    };

    onSave({
      uutTolerance: cleanupTolerance(uutTolerance),
      tmdeTolerances: tmdeTolerances.map(t => cleanupTolerance(t)),
      tmdeTolerance: undefined, // Explicitly remove the old key
    });
    onClose();
  };
  
  const infoMessage = "• Add TMDE: Click the '+' button in the tab bar.\n\n" +
                      "• Delete TMDE: Right-click on a TMDE's tab to open the delete option.\n\n" +
                      "• Add Component: Select a tolerance component from the dropdown list to add it to the budget.";

  const activeTmde = tmdeTolerances.find(t => t.id === activeTab);

  return (
    <div className="modal-overlay">
       {contextMenu && (
        <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
      )}
      <NotificationModal
            isOpen={isInfoModalOpen}
            onClose={() => setIsInfoModalOpen(false)}
            title="Navigating the Editor"
            message={infoMessage}
      />
      <div className="modal-content" style={{ maxWidth: "600px" }}>
        <FontAwesomeIcon 
                icon={faInfoCircle} 
                className="info-icon-modal" 
                onClick={() => setIsInfoModalOpen(true)}
                title="How to use this editor"
        />
        <button onClick={onClose} className="modal-close-button">
          &times;
        </button>
        <h3>Tolerance Editor</h3>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === "UUT" ? "active" : ""}`}
            onClick={() => setActiveTab("UUT")}
          >
            {uutTolerance.name || 'UUT'}
          </button>
          {tmdeTolerances.map(tmde => (
              <button
                key={tmde.id}
                className={`modal-tab ${activeTab === tmde.id ? "active" : ""}`}
                onClick={() => setActiveTab(tmde.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  const menuItems = [
                    {
                      label: `Delete "${tmde.name}"`,
                      action: () => handleRemoveTmde(tmde.id),
                      icon: faTrashAlt,
                      className: 'destructive',
                    },
                  ];
                  setContextMenu({
                    x: e.pageX,
                    y: e.pageY,
                    items: menuItems,
                  });
                }}
              >
                {tmde.name}
              </button>
          ))}
          <button className="modal-tab-add" onClick={handleAddTmde} title="Add New TMDE">
            <FontAwesomeIcon icon={faPlus} />
          </button>
        </div>

        <div className="modal-body-scrollable">
            {activeTab === "UUT" && (
            <>
                <div className="uut-header">
                    <div className='form-section' style={{marginBottom: 0, paddingBottom: 0}}>
                        <label>UUT Name</label>
                        <input
                            type="text"
                            value={uutTolerance.name || ''}
                            onChange={(e) => setUutTolerance(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., Device Under Test"
                        />
                    </div>
                </div>
                <ToleranceFormContent
                    tolerance={uutTolerance}
                    setTolerance={setUutTolerance}
                    isUUT={true}
                    nominal={testPointData.testPointInfo.parameter}
                />
            </>
            )}

            {activeTmde && (
            <>
                <div className="tmde-header">
                    <div className='form-section' style={{marginBottom: 0, paddingBottom: 0}}>
                        <label>TMDE Name</label>
                        <input
                            type="text"
                            value={activeTmde.name}
                            onChange={(e) => handleTmdeNameChange(activeTmde.id, e.target.value)}
                            placeholder="e.g., Standard DMM"
                        />
                    </div>
                </div>
                <ToleranceFormContent
                    tolerance={activeTmde}
                    setTolerance={(setter) => handleTmdeToleranceChange(activeTmde.id, setter)}
                    isUUT={false}
                    nominal={testPointData.testPointInfo.parameter}
                />
            </>
            )}
        </div>

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