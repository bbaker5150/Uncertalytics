import React, { useState, useEffect, useMemo, useCallback } from "react";
import ToleranceForm from "./ToleranceForm";
import { unitSystem } from "../App";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faTimes } from "@fortawesome/free-solid-svg-icons";

const AddTmdeModal = ({
  isOpen,
  onClose,
  onSave,
  testPointData,
  initialTmdeData = null,
  hasParentOverlay = false,
}) => {
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
      measurementPoint: { ...uutMeasurementPoint },
      variableType:
        isDerived && availableTypes.length > 0 ? availableTypes[0] : "",
    };

    if (initialTmdeData) {
      const existingData = JSON.parse(JSON.stringify(initialTmdeData));
      if (!existingData.measurementPoint) {
        existingData.measurementPoint = { ...uutMeasurementPoint };
      }
      if (!existingData.hasOwnProperty("variableType")) {
        existingData.variableType =
          isDerived && availableTypes.length > 0 ? availableTypes[0] : "";
      }
      if (!existingData.id) {
        existingData.id = Date.now() + Math.random();
      }
      return existingData;
    }
    return defaultState;
  }, [uutMeasurementPoint, initialTmdeData, isDerived, availableTypes]);

  const [tmde, setTmde] = useState(getInitialState());

  const [useUutRef, setUseUutRef] = useState(() => {
    if (!initialTmdeData || !initialTmdeData.measurementPoint) return true;
    const tmdePoint = initialTmdeData.measurementPoint;
    return (
      uutMeasurementPoint.value === tmdePoint.value &&
      uutMeasurementPoint.unit === tmdePoint.unit
    );
  });

  const allUnits = useMemo(() => Object.keys(unitSystem.units), []);

  useEffect(() => {
    if (isOpen) {
      const initialState = getInitialState();
      setTmde(initialState);
      if (initialTmdeData && initialTmdeData.measurementPoint) {
        const tmdePoint = initialTmdeData.measurementPoint;
        const refsMatch =
          uutMeasurementPoint.value === tmdePoint.value &&
          uutMeasurementPoint.unit === tmdePoint.unit;
        setUseUutRef(refsMatch);
      } else {
        setUseUutRef(true);
      }
    }
  }, [isOpen, getInitialState, initialTmdeData, uutMeasurementPoint]);

  useEffect(() => {
    if (!isDerived && useUutRef && uutMeasurementPoint) {
      // Only apply if not derived and toggle is on
      setTmde((prev) => ({
        ...prev,
        measurementPoint: { ...uutMeasurementPoint },
      }));
    } else if (!isDerived && !useUutRef && !initialTmdeData) {
      // Clear value only if direct, toggle off, and adding new
      setTmde((prev) => ({
        ...prev,
        measurementPoint: { ...(prev.measurementPoint || {}), value: "" },
      }));
    }
    // If derived, measurementPoint is always manual or based on initialState
    // If editing a direct point and toggling off, it reverts via getInitialState logic.
  }, [useUutRef, uutMeasurementPoint, initialTmdeData, isDerived]); // Added isDerived

  const handleSave = () => {
    const cleanupTolerance = (tol) => {
      const cleaned = { ...tol };
      const componentKeys = ["reading", "range", "floor", "db"];
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
    onSave(cleanupTolerance(tmde));
    onClose();
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="modal-content" style={{ maxWidth: "600px" }}>
      <button onClick={onClose} className="modal-close-button">
        &times;
      </button>
      <h3>{initialTmdeData ? "Edit TMDE" : "Add New TMDE"}</h3>

      <div className="modal-body-scrollable">
        <div className="tmde-header">
          <div className="form-section">
            <label>TMDE Name</label>
            <input
              type="text"
              value={tmde.name || ""}
              onChange={(e) => setTmde({ ...tmde, name: e.target.value })}
              placeholder="e.g., Standard DMM"
            />
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
            <label>Reference Measurement Point</label>
            {/* Conditionally render the toggle section only if NOT derived */}
            {!isDerived && (
              <div className="reference-point-control">
                <div className="toggle-switch-container">
                  <input
                    type="checkbox"
                    id="useUutRef"
                    className="toggle-switch-checkbox"
                    checked={useUutRef}
                    onChange={(e) => setUseUutRef(e.target.checked)}
                  />
                  <label className="toggle-switch-label" htmlFor="useUutRef">
                    <span className="toggle-switch-switch" />
                  </label>
                  <label htmlFor="useUutRef" className="toggle-option-label">
                    Use UUT Measurement Point
                    {uutMeasurementPoint?.value &&
                      uutMeasurementPoint?.unit && (
                        <span className="uut-point-display">
                          ({uutMeasurementPoint.value}{" "}
                          {uutMeasurementPoint.unit})
                        </span>
                      )}
                  </label>
                </div>
              </div>
            )}
            {/* Manual input container is always rendered, but might be disabled for direct points */}
            <div
              className={`manual-input-container ${
                !isDerived && useUutRef ? "disabled" : ""
              }`}
            >
              <div className="input-with-unit">
                <input
                  type="text"
                  placeholder="Value"
                  // Disable only if it's a direct measurement AND the toggle is checked
                  disabled={!isDerived && useUutRef}
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
                />
                <select
                  // Disable only if it's a direct measurement AND the toggle is checked
                  disabled={!isDerived && useUutRef}
                  value={tmde.measurementPoint?.unit || ""}
                  onChange={(e) =>
                    setTmde({
                      ...tmde,
                      measurementPoint: {
                        ...(tmde.measurementPoint || {}),
                        unit: e.target.value,
                      },
                    })
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
        </div>
        <ToleranceForm
          tolerance={tmde}
          setTolerance={setTmde}
          isUUT={false}
          referencePoint={tmde.measurementPoint}
        />
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
          title="Save TMDE"
        >
          <FontAwesomeIcon icon={faCheck} />
        </button>
      </div>
    </div>
  );

  if (hasParentOverlay) {
    return modalContent;
  }

  return <div className="modal-overlay">{modalContent}</div>;
};

export default AddTmdeModal;
