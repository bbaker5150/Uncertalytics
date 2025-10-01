import React, { useState, useEffect, useMemo } from "react";
import {
  unitSystem,
  errorDistributions,
  getToleranceUnitOptions,
} from "../App";
import ContextMenu from "./ContextMenu";
import { NotificationModal } from "../App";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faTrashAlt,
  faCheck,
  faTimes,
  faInfoCircle,
} from "@fortawesome/free-solid-svg-icons";

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

/**
 * A dynamic form for building a tolerance specification by adding/removing components.
 */
const ToleranceFormContent = ({
  tolerance,
  setTolerance,
  isUUT,
  isTMDE,
  nominal,
  referenceMeasurementPoint,
}) => {
  const allUnits = useMemo(() => Object.keys(unitSystem.units), []);

  const toleranceUnitOptions = useMemo(() => {
    const refUnit = isTMDE ? referenceMeasurementPoint?.unit : nominal?.unit;
    return getToleranceUnitOptions(refUnit);
  }, [nominal, referenceMeasurementPoint, isTMDE]);

  useEffect(() => {
    const refUnit = isTMDE ? referenceMeasurementPoint?.unit : nominal?.unit;
    if (refUnit && !componentDefinitions.floor.defaultState.unit) {
      componentDefinitions.floor.defaultState.unit = refUnit;
    }
  }, [nominal, referenceMeasurementPoint, isTMDE]);

  const handleChange = (e) => {
    const { name, value, checked, dataset } = e.target;

    // This condition is now correct
    if (dataset.type === "misc") {
      setTolerance((prev) => ({ ...prev, [name]: value }));
      return;
    }

    const { field, componentKey } = dataset;

    setTolerance((prev) => {
      const newTol = { ...prev };
      const comp = { ...newTol[componentKey] };

      // Create temporary variables to hold the next state
      let newHigh = comp.high;
      let newLow = comp.low;
      let newSymmetric = comp.symmetric;

      // Update the variable that was changed by the user
      if (field === "symmetric") {
        newSymmetric = checked;
      } else if (field === "high") {
        newHigh = value;
      } else if (field === "low") {
        newLow = value;
      } else {
        // Handles other fields like 'unit', 'value', 'multiplier', etc.
        comp[field] = value;
      }

      // If symmetric is enabled, enforce the relationship
      if (newSymmetric) {
        // If the high field was just changed, or if symmetric was just turned on
        if (field === "high" || (field === "symmetric" && newHigh)) {
          const highVal = parseFloat(newHigh);
          // Ensure the 'low' value is always a STRING for the input field
          newLow = !isNaN(highVal) ? String(-highVal) : "";
        }
      }

      // Update the component object with the new values
      comp.high = newHigh;
      comp.low = newLow;
      comp.symmetric = newSymmetric;

      newTol[componentKey] = comp;
      return newTol;
    });
  };

  const handleComponentSelect = (e) => {
    const componentKey = e.target.value;
    if (componentKey && !tolerance[componentKey]) {
      setTolerance((prev) => ({
        ...prev,
        [componentKey]: { ...componentDefinitions[componentKey].defaultState },
      }));
    }
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
    const refUnit = isTMDE ? referenceMeasurementPoint?.unit : nominal?.unit;

    const commonFields = (
      <>
        <div className="input-group-asymmetric">
          <div>
            <label>Upper Limit</label>
            <input
              type="number"
              step="any"
              data-component-key={key}
              data-field="high"
              value={componentData.high || ""}
              onChange={handleChange}
              placeholder="+ value"
            />
          </div>
          <div>
            <label>Lower Limit</label>
            <input
              type="number"
              step="any"
              data-component-key={key}
              data-field="low"
              value={componentData.low || ""}
              onChange={handleChange}
              disabled={componentData.symmetric}
              placeholder="- value"
            />
          </div>
        </div>
        <div className="symmetric-toggle">
          <input
            type="checkbox"
            id={`symmetric_${key}_${tolerance.id}`}
            data-component-key={key}
            data-field="symmetric"
            checked={!!componentData.symmetric}
            onChange={handleChange}
          />
          <label htmlFor={`symmetric_${key}_${tolerance.id}`}>Symmetric</label>
        </div>
      </>
    );

    const distributionSelect = (
      <>
        <label>Distribution</label>
        <select
          data-component-key={key}
          data-field="distribution"
          value={componentData.distribution || "1.960"}
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
            {commonFields}
            <label>Units</label>
            <select
              data-component-key="reading"
              data-field="unit"
              value={componentData.unit || "%"}
              onChange={handleChange}
            >
              {toleranceUnitOptions.map((u) => (
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
              data-component-key="range"
              data-field="value"
              value={componentData.value || ""}
              onChange={handleChange}
              placeholder="e.g., 100"
            />
            {commonFields}
            <label>Units</label>
            <select
              data-component-key="range"
              data-field="unit"
              value={componentData.unit || "%"}
              onChange={handleChange}
            >
              {toleranceUnitOptions.map((u) => (
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
            {commonFields}
            <label>Units</label>
            <select
              data-component-key="floor"
              data-field="unit"
              value={componentData.unit || refUnit}
              onChange={handleChange}
            >
              {allUnits
                .filter((u) => !["%", "ppm", "dB"].includes(u))
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
            {commonFields}
            <label>dB Equation Multiplier</label>
            <input
              type="number"
              step="any"
              data-component-key="db"
              data-field="multiplier"
              value={componentData.multiplier || 20}
              onChange={handleChange}
            />
            <label>dB Reference Value</label>
            <input
              type="number"
              step="any"
              data-component-key="db"
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
              value={tolerance.measuringResolutionUnit || nominal?.unit}
              onChange={handleChange}
            >
              {allUnits
                .filter((u) => !["%", "ppm", "dB"].includes(u))
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
  const [activeTab, setActiveTab] = useState("UUT");
  const [uutTolerance, setUutTolerance] = useState({});
  const [tmdeTolerances, setTmdeTolerances] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const allUnits = useMemo(() => Object.keys(unitSystem.units), []);

  useEffect(() => {
    if (isOpen && testPointData) {
      const cleanObject = (obj) =>
        Object.fromEntries(
          Object.entries(obj || {}).filter(
            ([_, v]) => v !== undefined && v !== null
          )
        );

      // Destructure 'name' out to ensure it's not managed in this modal's state
      const { name, ...restOfUutTolerance } = testPointData.uutTolerance || {};
      const initialUutTolerance = cleanObject(restOfUutTolerance);
      setUutTolerance(initialUutTolerance);

      let loadedTmde = testPointData.tmdeTolerances || [];
      if (
        loadedTmde.length === 0 &&
        testPointData.tmdeTolerance &&
        Object.keys(testPointData.tmdeTolerance).length > 0
      ) {
        loadedTmde = [
          {
            id: Date.now(),
            name: "TMDE",
            ...cleanObject(testPointData.tmdeTolerance),
          },
        ];
      }
      setTmdeTolerances(
        loadedTmde.map((t) => {
          const { measuringResolution, measuringResolutionUnit, ...rest } = t;
          return { ...rest, ...cleanObject(rest) };
        })
      );

      setActiveTab("UUT");
    }
  }, [isOpen, testPointData]);

  const handleAddTmde = () => {
    const newTmde = {
      id: Date.now(),
      name: `TMDE ${tmdeTolerances.length + 1}`,
      measurementPoint: {
        value: "",
        unit: testPointData.testPointInfo.parameter.unit,
      },
    };
    setTmdeTolerances((prev) => [...prev, newTmde]);
    setActiveTab(newTmde.id);
  };

  const handleRemoveTmde = (idToRemove) => {
    setTmdeTolerances((prev) => prev.filter((t) => t.id !== idToRemove));
    if (activeTab === idToRemove) {
      setActiveTab("UUT");
    }
  };

  const handleTmdePropChange = (id, field, value, parentField = null) => {
    setTmdeTolerances((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (parentField) {
          const updatedParent = { ...(t[parentField] || {}), [field]: value };
          return { ...t, [parentField]: updatedParent };
        }
        return { ...t, [field]: value };
      })
    );
  };

  const handleTmdeToleranceChange = (id, setter) => {
    setTmdeTolerances((prevTolerances) =>
      prevTolerances.map((t) => {
        if (t.id === id) {
          return typeof setter === "function" ? setter(t) : setter;
        }
        return t;
      })
    );
  };

  if (!isOpen) return null;

  const handleSave = () => {
    const cleanupTolerance = (tol, isUut = false) => {
      const cleaned = { ...tol };
      Object.keys(componentDefinitions).forEach((key) => {
        const component = cleaned[key];
        if (
          component &&
          (component.high === "" || isNaN(parseFloat(component.high)))
        ) {
          delete cleaned[key];
        }
      });
      if (isUut) {
        if (!parseFloat(cleaned.measuringResolution)) {
          delete cleaned.measuringResolution;
          delete cleaned.measuringResolutionUnit;
        }
      }
      return cleaned;
    };

    onSave({
      uutTolerance: cleanupTolerance(uutTolerance, true),
      tmdeTolerances: tmdeTolerances.map((t) => cleanupTolerance(t)),
      tmdeTolerance: undefined, // Clear out old single TMDE object
    });
    onClose();
  };

  const infoMessage =
    "• Add TMDE: Click the '+' button in the tab bar.\n\n" +
    "• Delete TMDE: Right-click on a TMDE's tab to open the delete option.\n\n" +
    "• Add Component: Select a tolerance component from the dropdown list to add it to the budget.";

  const activeTmde = tmdeTolerances.find((t) => t.id === activeTab);

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
            {testPointData.uutDescription || "UUT"}
          </button>
          {tmdeTolerances.map((tmde) => (
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
                    className: "destructive",
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
          <button
            className="modal-tab-add"
            onClick={handleAddTmde}
            title="Add New TMDE"
          >
            <FontAwesomeIcon icon={faPlus} />
          </button>
        </div>

        <div className="modal-body-scrollable">
          {activeTab === "UUT" && (
            <>
              <div className="uut-header">
                <div
                  className="form-section"
                  style={{ marginBottom: 0, paddingBottom: 0 }}
                >
                  <label>UUT Name</label>
                  <p className="static-display-field">
                    {testPointData.uutDescription || "N/A"}
                  </p>
                </div>
              </div>
              <ToleranceFormContent
                tolerance={uutTolerance}
                setTolerance={setUutTolerance}
                isUUT={true}
                isTMDE={false}
                nominal={testPointData.testPointInfo.parameter}
              />
            </>
          )}

          {activeTmde && (
            <>
              <div className="tmde-header">
                <div className="form-section">
                  <label>TMDE Name</label>
                  <input
                    type="text"
                    value={activeTmde.name}
                    onChange={(e) =>
                      handleTmdePropChange(
                        activeTmde.id,
                        "name",
                        e.target.value
                      )
                    }
                    placeholder="e.g., Standard DMM"
                  />
                </div>
                <div
                  className="form-section"
                  style={{ marginBottom: 0, paddingBottom: 0 }}
                >
                  <label>Reference Measurement Point</label>
                  <div className="input-with-unit">
                    <input
                      type="text"
                      placeholder="Value"
                      value={activeTmde.measurementPoint?.value || ""}
                      onChange={(e) =>
                        handleTmdePropChange(
                          activeTmde.id,
                          "value",
                          e.target.value,
                          "measurementPoint"
                        )
                      }
                    />
                    <select
                      value={activeTmde.measurementPoint?.unit || ""}
                      onChange={(e) =>
                        handleTmdePropChange(
                          activeTmde.id,
                          "unit",
                          e.target.value,
                          "measurementPoint"
                        )
                      }
                    >
                      <option value="">-- Unit --</option>
                      {allUnits.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <ToleranceFormContent
                tolerance={activeTmde}
                setTolerance={(setter) =>
                  handleTmdeToleranceChange(activeTmde.id, setter)
                }
                isUUT={false}
                isTMDE={true}
                nominal={testPointData.testPointInfo.parameter}
                referenceMeasurementPoint={activeTmde.measurementPoint}
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
