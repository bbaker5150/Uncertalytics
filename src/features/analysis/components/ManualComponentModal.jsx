/**
 * * A form modal used to Add or Edit manual uncertainty components.
 * * Features:
 * - Dynamic fields based on Type A (Std Dev) vs Type B (Tolerance).
 * - Real-time conversion preview via ConversionInfo.
 * - Handles both "New" and "Edit" modes based on props.
 */

import React, { useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import ConversionInfo from "../../../components/common/ConversionInfo"; // Assuming this exists in src/components/
import { convertToPPM, unitSystem } from "../../../utils/uncertaintyMath";
import { oldErrorDistributions } from "../utils/budgetUtils";

const ManualComponentModal = ({
  isOpen,
  onClose,
  onSave,
  existingComponent, // If provided, we are in "Edit" mode
  uutNominal
}) => {
  const [component, setComponent] = useState({
    name: "",
    type: "B",
    errorDistributionDivisor: "1.732",
    toleranceLimit: "",
    unit: "ppm",
    standardUncertainty: "",
    dof: "Infinity",
  });

  const [error, setError] = useState(null);

  // Reset or Populate form when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (existingComponent) {
        setComponent({
          id: existingComponent.id, // Preserve ID
          name: existingComponent.name,
          type: existingComponent.type,
          // Use stored original inputs if available, otherwise fallback
          standardUncertainty: existingComponent.originalInput?.standardUncertainty || "",
          toleranceLimit: existingComponent.originalInput?.toleranceLimit || "",
          errorDistributionDivisor: existingComponent.originalInput?.errorDistributionDivisor || "1.732",
          unit: existingComponent.unit_native || existingComponent.unit || "ppm",
          dof: existingComponent.dof === Infinity ? "Infinity" : String(existingComponent.dof),
        });
      } else {
        // Reset for new entry
        setComponent({
          name: "",
          type: "B",
          errorDistributionDivisor: "1.732",
          toleranceLimit: "",
          unit: "ppm",
          standardUncertainty: "",
          dof: "Infinity",
        });
      }
    }
  }, [isOpen, existingComponent]);

  const unitOptions = useMemo(() => {
    const nominalUnit = uutNominal?.unit;
    if (!nominalUnit) return ["ppm", "ppb"];
    const relevant = unitSystem.getRelevantUnits(nominalUnit);
    return ["ppm", "ppb", ...relevant.filter((u) => u !== "ppm" && u !== "ppb" && u !== "dB")];
  }, [uutNominal]);

  const handleChange = (e) => {
    setComponent((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = () => {
    let valueInPPM = NaN;
    let dof = component.dof === "Infinity" ? Infinity : parseFloat(component.dof);

    const originalInputData = {
      standardUncertainty: component.standardUncertainty,
      toleranceLimit: component.toleranceLimit,
      errorDistributionDivisor: component.errorDistributionDivisor,
    };

    let valueNative = NaN;

    if (component.type === "A") {
      const stdUnc = parseFloat(component.standardUncertainty);
      if (isNaN(stdUnc) || stdUnc <= 0 || (dof !== Infinity && (isNaN(dof) || dof < 1))) {
        setError("For Type A, provide valid positive Std Unc and DoF (>=1).");
        return;
      }
      
      const { value: ppm, warning } = convertToPPM(
        stdUnc,
        component.unit,
        uutNominal?.value,
        uutNominal?.unit,
        null,
        true
      );

      if (warning) {
        setError(warning);
        return;
      }
      valueInPPM = ppm;
      valueNative = stdUnc;
    } else {
      // Type B
      const rawValue = parseFloat(component.toleranceLimit);
      const divisor = parseFloat(component.errorDistributionDivisor);

      if (isNaN(rawValue) || rawValue <= 0 || isNaN(divisor)) {
        setError("Provide valid positive tolerance limit and select distribution.");
        return;
      }

      const { value: ppm, warning } = convertToPPM(
        rawValue,
        component.unit,
        uutNominal?.value,
        uutNominal?.unit,
        null,
        true
      );

      if (warning) {
        setError(warning);
        return;
      }
      valueInPPM = ppm / divisor;
      valueNative = rawValue / divisor;
    }

    if (!component.name) {
        setError("Component Name is required.");
        return;
    }

    const distributionLabel = oldErrorDistributions.find(
      (d) => d.value === component.errorDistributionDivisor
    )?.label;

    const finalData = {
      ...component,
      value: valueInPPM,
      value_native: valueNative,
      unit_native: component.unit,
      dof,
      distribution: distributionLabel,
      originalInput: originalInputData
    };

    onSave(finalData);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "800px" }}>
        <button onClick={onClose} className="modal-close-button">&times;</button>
        <h3>{existingComponent ? "Edit Component" : "Add Manual Uncertainty Component"}</h3>
        
        {error && <div className="form-section-warning">{error}</div>}

        <div className="config-stack" style={{ paddingTop: "20px", textAlign: "left" }}>
          <div className="config-column">
            <label>Component Name</label>
            <input
              type="text"
              name="name"
              value={component.name}
              onChange={handleChange}
              placeholder="e.g., UUT Stability Spec"
            />
          </div>
          <div className="config-column">
            <label>Type</label>
            <select name="type" value={component.type} onChange={handleChange}>
              <option value="A">Type A</option>
              <option value="B">Type B</option>
            </select>
          </div>

          {component.type === "A" && (
            <>
              <div className="config-column">
                <label>Std Unc (uᵢ)</label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    step="any"
                    name="standardUncertainty"
                    value={component.standardUncertainty}
                    onChange={handleChange}
                    placeholder="e.g., 15.3"
                  />
                  <select name="unit" value={component.unit} onChange={handleChange}>
                    {unitOptions.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <ConversionInfo
                  value={component.standardUncertainty}
                  unit={component.unit}
                  nominal={uutNominal}
                />
              </div>
              <div className="config-column">
                <label>DoF (vᵢ)</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  name="dof"
                  value={component.dof}
                  onChange={handleChange}
                />
              </div>
            </>
          )}

          {component.type === "B" && (
            <>
              <div className="config-column">
                <label>Distribution</label>
                <select
                  name="errorDistributionDivisor"
                  value={component.errorDistributionDivisor}
                  onChange={handleChange}
                >
                  {oldErrorDistributions.map((dist) => (
                    <option key={dist.value} value={dist.value}>
                      {dist.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="config-column">
                <label>Tolerance Limits (±)</label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    step="any"
                    name="toleranceLimit"
                    value={component.toleranceLimit}
                    onChange={handleChange}
                  />
                  <select name="unit" value={component.unit} onChange={handleChange}>
                    {unitOptions.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <ConversionInfo
                  value={component.toleranceLimit}
                  unit={component.unit}
                  nominal={uutNominal}
                />
              </div>
              <div className="config-column">
                <label>DoF</label>
                <input
                  type="text"
                  name="dof"
                  value={component.dof}
                  onChange={handleChange}
                  placeholder="Infinity"
                />
              </div>
            </>
          )}
        </div>
        <div className="modal-actions">
          <button
            onClick={handleSubmit}
            title="Save Component"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--primary-color)',
              cursor: 'pointer',
              fontSize: '1.5rem',
            }}
          >
            <FontAwesomeIcon icon={faCheck} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualComponentModal;