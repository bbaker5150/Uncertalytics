import React, { useState, useMemo } from "react";
import Latex from "react-latex-next";
import { calculateUncertaintyFromToleranceObject, unitSystem } from "../App";

/**
 * A stateful component to display a single item in the uncertainty budget,
 * with a dropdown to change the display units of the limit value.
 */
const BreakdownItem = ({ comp, nominal }) => {
  const [displayUnit, setDisplayUnit] = useState("ppm");

  // Get a list of relevant units for the dropdown (e.g., V, mV, %, ppm)
  const unitOptions = useMemo(() => {
    if (!nominal?.unit) return ["ppm"];
    return unitSystem.getRelevantUnits(nominal.unit);
  }, [nominal]);

  // Calculate the displayed limit value based on the selected unit
  const displayedValue = useMemo(() => {
    const ppmValue = comp.ppm;
    const nominalValue = parseFloat(nominal.value);

    if (isNaN(ppmValue) || isNaN(nominalValue)) return "N/A";
    if (displayUnit === "ppm") return ppmValue;

    const deviationInBase =
      (ppmValue / 1e6) * unitSystem.toBaseUnit(nominalValue, nominal.unit);

    if (displayUnit === "%") {
      const nominalInBase = unitSystem.toBaseUnit(nominalValue, nominal.unit);
      return (deviationInBase / nominalInBase) * 100;
    }

    const targetUnitFactor = unitSystem.conversions[displayUnit];
    if (targetUnitFactor) {
      return deviationInBase / targetUnitFactor;
    }

    return ppmValue; // Fallback to ppm if conversion fails
  }, [displayUnit, comp.ppm, nominal]);

  // Calculate the standard uncertainty in the selected unit
  const standardUncertaintyInUnit = useMemo(() => {
    if (typeof displayedValue !== "number" || !comp.divisor) {
      return "N/A";
    }
    return displayedValue / comp.divisor;
  }, [displayedValue, comp.divisor]);

  return (
    <div className="breakdown-step">
      <h5>{comp.name} Component</h5>
      <ul>
        <li>
          <strong>Specification:</strong> {comp.input}
        </li>
        <li className="limit-value-display">
          <strong>Limit Value:</strong>
          <strong>
            {typeof displayedValue === "number"
              ? displayedValue.toPrecision(4)
              : displayedValue}
          </strong>
          <select
            value={displayUnit}
            onChange={(e) => setDisplayUnit(e.target.value)}
          >
            {unitOptions.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </li>
        <li>
          <strong>Distribution:</strong> {comp.distributionLabel}
        </li>
        <li>
          <strong>Std. Uncertainty (uᵢ):</strong>
          <Latex>{`$$ \\frac{${
            typeof displayedValue === "number"
              ? displayedValue.toPrecision(4)
              : "..."
          } \\text{ ${displayUnit}}}{${comp.divisor.toFixed(3)}} = \\mathbf{${
            typeof standardUncertaintyInUnit === "number"
              ? standardUncertaintyInUnit.toPrecision(4)
              : "..."
          }} \\text{ ${displayUnit}}$$`}</Latex>
        </li>
      </ul>
    </div>
  );
};

const BreakdownDetails = ({ type, testPoint }) => {
  const toleranceObject =
    type === "UUT" ? testPoint.uutTolerance : testPoint.tmdeTolerance;
  const { standardUncertainty, breakdown } =
    calculateUncertaintyFromToleranceObject(
      toleranceObject,
      testPoint.testPointInfo.parameter,
      type === "UUT"
    );

  if (breakdown.length === 0) {
    return (
      <div className="full-breakdown-column">
        <h4>{type} Breakdown</h4>
        <div
          className="breakdown-step"
          style={{ border: "none", padding: "1rem", textAlign: "center" }}
        >
          <p style={{ fontStyle: "italic", color: "var(--text-color-muted)" }}>
            No tolerance components have been defined.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="full-breakdown-column">
      <h4>{type} Breakdown</h4>
      {breakdown.map((comp, index) => (
        <BreakdownItem
          key={`${type}-${index}`}
          comp={comp}
          nominal={testPoint.testPointInfo.parameter}
        />
      ))}
      <div className="breakdown-step">
        <h5>{type} Combined Uncertainty</h5>
        <p>
          The individual standard uncertainties are combined using the Root Sum
          of Squares (RSS) method.
        </p>
        <Latex>{`$$ u_c = \\sqrt{\\sum u_i^2} = \\sqrt{${breakdown
          .map((c) => `${c.u_i.toFixed(3)}^2`)
          .join(" + ")}} = \\mathbf{${standardUncertainty.toFixed(
          3
        )}} \\text{ ppm} $$`}</Latex>
      </div>
    </div>
  );
};

const FullBreakdownModal = ({ isOpen, testPoint, onClose }) => {
    if (!isOpen || !testPoint) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content breakdown-modal-content" style={{ width: '90vw', maxWidth: '1200px' }}>
                <button onClick={onClose} className="modal-close-button">&times;</button>
                <h3>Tolerance Calculation Breakdown</h3>
                
                <div className="modal-scroll-content">
                    <div className="breakdown-step">
                        <h5>Nominal Value</h5>
                        <p>The reference value for all calculations: <strong>{testPoint.testPointInfo.parameter.value} {testPoint.testPointInfo.parameter.unit}</strong></p>
                    </div>
                    <div className="full-breakdown-container">
                        <BreakdownDetails type="UUT" testPoint={testPoint} />
                        <BreakdownDetails type="TMDE" testPoint={testPoint} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FullBreakdownModal;
