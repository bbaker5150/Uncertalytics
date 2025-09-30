import React, { useState, useMemo } from "react";
import Latex from "react-latex-next";
import { calculateUncertaintyFromToleranceObject, unitSystem } from "../App";

const convertPpmToUnit = (ppmValue, targetUnit, referencePoint) => {
    const nominalValue = parseFloat(referencePoint.value);
    if (isNaN(ppmValue) || !referencePoint) return "N/A";
    if (targetUnit === "ppm") return ppmValue;

    if (isNaN(nominalValue)) return "N/A";

    if (nominalValue === 0) {
        if (targetUnit === '%') return ppmValue / 10000;
        return "N/A (Nominal is 0)";
    }

    const nominalInBase = unitSystem.toBaseUnit(nominalValue, referencePoint.unit);
    const deviationInBase = (ppmValue / 1e6) * Math.abs(nominalInBase);

    if (targetUnit === "%") {
        return (deviationInBase / Math.abs(nominalInBase)) * 100;
    }

    const targetUnitInfo = unitSystem.units[targetUnit];
    if (targetUnitInfo?.to_si) {
        return deviationInBase / targetUnitInfo.to_si;
    }

    return ppmValue; // Fallback
};

const BreakdownItem = ({ comp, nominal }) => {
  const [displayUnit, setDisplayUnit] = useState(nominal?.unit || "ppm");

  const unitOptions = useMemo(() => {
    if (!nominal?.unit) return ["ppm"];
    const relevant = unitSystem.getRelevantUnits(nominal.unit);
    const preferred = [nominal.unit, "ppm"];
    return [...new Set([...preferred, ...relevant.filter(u => u !== "dB")])];
  }, [nominal]);

  const displayedValue = useMemo(() => 
    convertPpmToUnit(comp.ppm, displayUnit, nominal),
    [displayUnit, comp.ppm, nominal]
  );

  const standardUncertaintyInUnit = useMemo(() => {
    if (typeof displayedValue !== "number" || !comp.divisor) return "N/A";
    return displayedValue / comp.divisor;
  }, [displayedValue, comp.divisor]);
  
  const absoluteHalfSpan = useMemo(() => {
      const nominalValue = parseFloat(nominal.value);
      if (isNaN(comp.ppm) || isNaN(nominalValue) || nominalValue === 0) return null;
      return (comp.ppm / 1_000_000) * Math.abs(nominalValue);
  }, [comp.ppm, nominal]);

  return (
    <div className="breakdown-step">
      <h5>{comp.name} Component</h5>
      <ul>
        <li>
          <strong>Specification:</strong> {comp.input}
        </li>
        {comp.absoluteLow !== undefined && comp.absoluteHigh !== undefined && !isNaN(comp.absoluteLow) && !isNaN(comp.absoluteHigh) &&(
          <li>
            <strong>Tolerance Limits:</strong> 
            {` ${comp.absoluteLow.toPrecision(6)} to ${comp.absoluteHigh.toPrecision(6)} ${nominal.unit}`}
          </li>
        )}
        <li className="limit-value-display">
          <strong>Limit (Half-Span):</strong>
          <strong>
            {typeof displayedValue === "number" ? displayedValue.toPrecision(4) : displayedValue}
          </strong>
          <select value={displayUnit} onChange={(e) => setDisplayUnit(e.target.value)} >
            {unitOptions.map((u) => (<option key={u} value={u}>{u}</option>))}
          </select>
        </li>
        {absoluteHalfSpan !== null && (
            <li>
                <strong>PPM Conversion:</strong>
                <Latex>{`$$ \\frac{${absoluteHalfSpan.toPrecision(4)} \\text{ ${nominal.unit}}}{${parseFloat(nominal.value)} \\text{ ${nominal.unit}}} \\times 1,000,000 = \\mathbf{${comp.ppm.toFixed(2)}} \\text{ ppm} $$`}</Latex>
            </li>
        )}
        <li>
          <strong>Distribution:</strong> {comp.distributionLabel}
        </li>
        <li>
          <strong>Std. Uncertainty (uᵢ):</strong>
          <Latex>{`$$ u_i = \\frac{${
            typeof displayedValue === "number" ? displayedValue.toPrecision(4) : "..."
          } \\text{ ${displayUnit}}}{${comp.divisor.toFixed(3)}} = \\mathbf{${
            typeof standardUncertaintyInUnit === "number" ? standardUncertaintyInUnit.toPrecision(4) : "..."
          }} \\text{ ${displayUnit}}$$`}</Latex>
        </li>
      </ul>
    </div>
  );
};

const BreakdownDetails = ({ title, toleranceObject, referencePoint }) => {
  const { standardUncertainty, breakdown } =
    calculateUncertaintyFromToleranceObject(
      toleranceObject,
      referencePoint
    );
    
  const [combinedUnit, setCombinedUnit] = useState(referencePoint?.unit || "ppm");
  const [expandedUnit, setExpandedUnit] = useState(referencePoint?.unit || "ppm");

  const unitOptions = useMemo(() => {
    if (!referencePoint?.unit) return ["ppm"];
    const relevant = unitSystem.getRelevantUnits(referencePoint.unit);
    return ["ppm", ...relevant.filter(u => u !== "ppm" && u !== "dB")];
  }, [referencePoint]);

  const kFactor = 1.96;
  const expandedUncertaintyPPM = standardUncertainty * kFactor;

  const displayedCombinedUncertainty = useMemo(() => 
    convertPpmToUnit(standardUncertainty, combinedUnit, referencePoint),
    [standardUncertainty, combinedUnit, referencePoint]
  );

  const displayedExpandedUncertainty = useMemo(() => 
    convertPpmToUnit(expandedUncertaintyPPM, expandedUnit, referencePoint),
    [expandedUncertaintyPPM, expandedUnit, referencePoint]
  );

  const combinedUncertaintyLatex = useMemo(() => {
    const u_i_in_selected_unit = breakdown.map(c => 
        convertPpmToUnit(c.u_i, combinedUnit, referencePoint)
    );
    const allNumeric = u_i_in_selected_unit.every(v => typeof v === 'number');

    if (!allNumeric) {
        return `$$ u_c = \\sqrt{\\sum u_i^2} = \\mathbf{${standardUncertainty.toFixed(3)}} \\text{ ppm} $$`;
    }

    const sumString = u_i_in_selected_unit.map(u => `${u.toPrecision(3)}^2`).join(" + ");
    const finalValueString = typeof displayedCombinedUncertainty === 'number' 
        ? displayedCombinedUncertainty.toPrecision(4) 
        : displayedCombinedUncertainty;

    return `$$ u_c = \\sqrt{${sumString}} = \\mathbf{${finalValueString}} \\text{ ${combinedUnit}} $$`;
  }, [breakdown, standardUncertainty, displayedCombinedUncertainty, combinedUnit, referencePoint]);

  const expandedUncertaintyLatex = useMemo(() => {
    const combinedInSelectedUnit = convertPpmToUnit(standardUncertainty, expandedUnit, referencePoint);

    if (typeof combinedInSelectedUnit !== 'number') {
        return `$$ U = k \\times u_c = ${kFactor} \\times ${standardUncertainty.toFixed(3)} \\text{ ppm} = \\mathbf{${expandedUncertaintyPPM.toFixed(3)}} \\text{ ppm} $$`;
    }

    const finalValueString = typeof displayedExpandedUncertainty === 'number'
        ? displayedExpandedUncertainty.toPrecision(4)
        : displayedExpandedUncertainty;
    
    return `$$ U = k \\times u_c = ${kFactor} \\times ${combinedInSelectedUnit.toPrecision(4)} \\text{ ${expandedUnit}} = \\mathbf{${finalValueString}} \\text{ ${expandedUnit}} $$`;
  }, [standardUncertainty, expandedUncertaintyPPM, displayedExpandedUncertainty, expandedUnit, referencePoint]);


  if (!toleranceObject || Object.keys(toleranceObject).length <= 1 || breakdown.length === 0) {
    return (
      <div className="full-breakdown-column">
        <h4>{title}</h4>
        <div className="breakdown-step" style={{ border: "none", padding: "1rem", textAlign: "center" }}>
          <p style={{ fontStyle: "italic", color: "var(--text-color-muted)" }}>
            No tolerance components have been defined.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="full-breakdown-column">
      <h4>{title}</h4>
      {breakdown.map((comp, index) => (
        <BreakdownItem
          key={`${title}-${index}`}
          comp={comp}
          nominal={referencePoint}
        />
      ))}
      <div className="breakdown-step">
        <h5><Latex>Combined Uncertainty ($u_c$)</Latex></h5>
        <div className="limit-value-display">
            <strong>
                {typeof displayedCombinedUncertainty === 'number'
                    ? displayedCombinedUncertainty.toPrecision(4)
                    : displayedCombinedUncertainty}
            </strong>
            <select value={combinedUnit} onChange={(e) => setCombinedUnit(e.target.value)}>
                {unitOptions.map((u) => (<option key={u} value={u}>{u}</option>))}
            </select>
        </div>
        <Latex>{combinedUncertaintyLatex}</Latex>
      </div>
      <div className="breakdown-step">
        <h5><Latex>Expanded Uncertainty (U)</Latex></h5>
        <p>Calculated with a coverage factor of k={kFactor} (for ~95% confidence).</p>
        <div className="limit-value-display">
            <strong>
                {typeof displayedExpandedUncertainty === 'number'
                    ? displayedExpandedUncertainty.toPrecision(4)
                    : displayedExpandedUncertainty}
            </strong>
            <select value={expandedUnit} onChange={(e) => setExpandedUnit(e.target.value)}>
                {unitOptions.map((u) => (<option key={u} value={u}>{u}</option>))}
            </select>
        </div>
        <Latex>{expandedUncertaintyLatex}</Latex>
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
                
                <div className="modal-body-scrollable">
                    {testPoint.testPointInfo && testPoint.testPointInfo.parameter && (
                      <div className="breakdown-step">
                          <h5>Nominal Value</h5>
                          <p>The primary reference value for the UUT: <strong>{testPoint.testPointInfo.parameter.value} {testPoint.testPointInfo.parameter.unit}</strong></p>
                      </div>
                    )}
                    <div className="full-breakdown-container">
                        {testPoint.testPointInfo && testPoint.testPointInfo.parameter && (
                            <BreakdownDetails 
                                title="UUT Breakdown"
                                toleranceObject={testPoint.uutTolerance}
                                referencePoint={testPoint.testPointInfo.parameter}
                            />
                        )}

                        {(testPoint.tmdeTolerances || []).map((tmde, index) => (
                            tmde.measurementPoint && tmde.measurementPoint.value && (
                                <BreakdownDetails
                                    key={tmde.id || index}
                                    title={`${tmde.name || 'TMDE'} Breakdown`}
                                    toleranceObject={tmde}
                                    referencePoint={tmde.measurementPoint}
                                />
                            )
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FullBreakdownModal;