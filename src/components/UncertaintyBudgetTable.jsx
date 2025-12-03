import React, { useState, useMemo } from "react";
import Latex from "./Latex"; // Assuming Latex.jsx is in the components folder
import { unitSystem } from "../utils/uncertaintyMath";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalculator } from "@fortawesome/free-solid-svg-icons";

const UncertaintyBudgetTable = ({
  components,
  onRemove,
  calcResults,
  referencePoint,
  uncertaintyConfidence,
  onRowContextMenu,
  equationString,
  measurementType,
  riskResults,
  onShowDerivedBreakdown,
  onShowRiskBreakdown,
  showContribution,
  setShowContribution,
}) => {
  const confidencePercent = parseFloat(uncertaintyConfidence) || 95;
  const derivedUnit = referencePoint?.unit || "Units";
  const derivedName = referencePoint?.name || "Derived";

  const isDirect = measurementType === "direct";
  const headerColSpan = isDirect ? 6 : 8;
  const finalColSpan = isDirect ? 3 : 5;

  const [showGuardband, setShowGuardband] = useState(false);

  const getPfaClass = (pfa) => {
    if (pfa > 5) return "status-bad";
    if (pfa > 2) return "status-warning";
    return "status-good";
  };

  const derivedSymbol = useMemo(() => {
    if (measurementType !== "derived" || !equationString) {
      return null;
    }
    const eqParts = equationString.split("=");
    if (eqParts.length > 1) {
      return eqParts[0].trim();
    }
    return null;
  }, [equationString, measurementType]);

  const derivedDisplayName = useMemo(() => {
    if (derivedSymbol) {
      return `${derivedName} (${derivedSymbol})`;
    }
    return derivedName;
  }, [derivedName, derivedSymbol]);

  let combinedUncertaintyInDerivedUnit = NaN;
  let expandedUncertaintyInDerivedUnit = NaN;
  const targetUnitInfo = unitSystem.units[derivedUnit];

  if (calcResults && targetUnitInfo?.to_si) {
    if (!isNaN(calcResults.combined_uncertainty_absolute_base)) {
      combinedUncertaintyInDerivedUnit =
        calcResults.combined_uncertainty_absolute_base / targetUnitInfo.to_si;
    }
    if (!isNaN(calcResults.expanded_uncertainty_absolute_base)) {
      expandedUncertaintyInDerivedUnit =
        calcResults.expanded_uncertainty_absolute_base / targetUnitInfo.to_si;
    }
  } else if (calcResults && derivedUnit === "ppm") {
    combinedUncertaintyInDerivedUnit = calcResults.combined_uncertainty;
    expandedUncertaintyInDerivedUnit = calcResults.expanded_uncertainty;
  }

  const inputComponents = components.filter((c) => c.name.startsWith("Input:"));
  const directComponents = components.filter(
    (c) => !c.name.startsWith("Input:")
  );
  const showDerivedInputs =
    inputComponents.length > 0 &&
    calcResults?.combined_uncertainty_inputs_native !== undefined;

  const renderComponentRows = (filteredComponents) => {
    if (filteredComponents.length === 0) return null;

    return (
      <>
        {filteredComponents.map((c) => {
          let formattedValueUi = "N/A";
          let displayValueUnitUi = "";
          let formattedContribution = "N/A";
          let displayContributionUnit = derivedUnit;
          const quantity = c.quantity || 1;
          const displayName =
            quantity > 1 ? `${c.name} (Qty: ${quantity})` : c.name;

          if (c.value_native !== undefined && c.unit_native) {
            formattedValueUi = c.value_native.toPrecision(4);
            displayValueUnitUi = c.unit_native;
          } else if (c.isBaseUnitValue && !isNaN(c.value) && c.unit) {
            const inputUnitInfo = unitSystem.units[c.unit];
            if (inputUnitInfo?.to_si) {
              const valueInOriginalUnit = c.value / inputUnitInfo.to_si;
              formattedValueUi = valueInOriginalUnit.toPrecision(4);
              displayValueUnitUi = c.unit;
            } else {
              formattedValueUi = "Conv Err";
            }
          } else if (!c.isBaseUnitValue && !isNaN(c.value)) {
            formattedValueUi = c.value.toPrecision(4);
            displayValueUnitUi = "ppm";
          }

          const formattedCi =
            typeof c.sensitivityCoefficient === "number"
              ? c.sensitivityCoefficient.toPrecision(4)
              : c.sensitivityCoefficient
              ? String(c.sensitivityCoefficient)
              : "N/A";

          if (typeof c.contribution === "number" && !isNaN(c.contribution)) {
            formattedContribution = c.contribution.toPrecision(4);

            if (isDirect) {
              displayContributionUnit = displayValueUnitUi;
            }
          }

          return (
            <tr
              key={c.id}
              onContextMenu={(e) => {
                if (onRowContextMenu) {
                  onRowContextMenu(e, c);
                }
              }}
            >
              <td>{displayName}</td>
              <td>{c.sourcePointLabel || "N/A"}</td>
              <td>{c.type}</td>
              <td>
                {formattedValueUi} {displayValueUnitUi}
              </td>

              {!isDirect && <td>{formattedCi}</td>}
              {!isDirect && (
                <td>
                  {formattedContribution} {displayContributionUnit}
                </td>
              )}

              <td>{c.distribution}</td>

              <td className="action-cell">
                {!c.isCore && (
                  <span
                    onClick={() => onRemove(c.id)}
                    className="delete-action"
                    title="Remove Component"
                  >
                    ×
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </>
    );
  };

  return (
    <table className="uncertainty-budget-table">
      <thead>
        <tr>
          <th>Uncertainty Component</th>
          <th>Source / Nominal</th>
          <th>Type</th>
          <th>uᵢ</th>

          {!isDirect && <th>Sens. Coeff (cᵢ)</th>}
          {!isDirect && (
            <th>
              <Latex>{"Contribution ($|c_i \\times u_i|$)"}</Latex>
            </th>
          )}

          <th>Distribution</th>

          <th style={{ width: "60px" }}></th>
        </tr>
      </thead>

      {showDerivedInputs && (
        <tbody className="component-group-tbody informational-group">
          <tr className="category-header">
            <td colSpan={headerColSpan}>Input Variables (Informational)</td>
          </tr>
          {renderComponentRows(inputComponents)}
        </tbody>
      )}

      <tbody className="component-group-tbody">
        {showDerivedInputs ? (
          <tr className="category-header">
            <td colSpan={headerColSpan}>
              Direct Uncertainty Components (Final Budget)
            </td>
          </tr>
        ) : (
          <tr className="category-header"></tr>
        )}

        {showDerivedInputs && (
          <tr className="propagated-unc-row" key="propagated_unc">
            <td>{`Derived: ${derivedDisplayName}`}</td>
            <td>(From Inputs)</td>
            <td>B</td>
            <td>
              {calcResults.combined_uncertainty_inputs_native.toPrecision(4)}{" "}
              {derivedUnit}
            </td>

            {!isDirect && <td>1.000</td>}
            {!isDirect && (
              <td>
                {calcResults.combined_uncertainty_inputs_native.toPrecision(4)}{" "}
                {derivedUnit}
              </td>
            )}

            <td>Calculated</td>

            <td className="action-cell">
              <span
                onClick={onShowDerivedBreakdown}
                className="action-icon"
                title="View Calculation Breakdown"
                style={{ cursor: "pointer", color: "var(--primary-color)" }}
              >
                <FontAwesomeIcon icon={faCalculator} />
              </span>
            </td>
          </tr>
        )}

        {renderComponentRows(showDerivedInputs ? directComponents : components)}
      </tbody>

      <tfoot>
        <tr>
          <td colSpan={finalColSpan}>{"Combined Standard Uncertainty (uₑ)"}</td>
          <td>
            {!isNaN(combinedUncertaintyInDerivedUnit)
              ? `${combinedUncertaintyInDerivedUnit.toPrecision(
                  4
                )} ${derivedUnit}`
              : "N/A"}
          </td>
          <td colSpan="2"></td>
        </tr>
        {calcResults && (
          <>
            <tr className="final-uncertainty-row">
              <td colSpan={headerColSpan}>
                <div
                  className="final-result-display"
                  style={{ position: "relative" }}
                >
                  {/* Absolute Toggle Switch */}
                  <div
                    style={{
                      position: "absolute",
                      top: "20px",
                      left: "20px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: "600",
                        color: "var(--text-color-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Show Contribution
                    </span>
                    <label className="dark-mode-toggle" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={showContribution}
                        onChange={(e) => setShowContribution(e.target.checked)}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      top: "20px",
                      right: "20px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: "600",
                        color: "var(--text-color-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Show Guardband
                    </span>
                    <label className="dark-mode-toggle" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={showGuardband}
                        onChange={(e) => setShowGuardband(e.target.checked)}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <span className="final-result-label">
                    Expanded Uncertainty (U)
                  </span>
                  <div className="final-result-value">
                    ±{" "}
                    {!isNaN(expandedUncertaintyInDerivedUnit)
                      ? expandedUncertaintyInDerivedUnit.toPrecision(5)
                      : "N/A"}
                    <span className="final-result-unit">{derivedUnit}</span>
                  </div>
                  <span className="final-result-confidence-note">
                    The reported expanded uncertainty... k≈
                    {calcResults.k_value.toFixed(3)}... {confidencePercent}%.
                  </span>

                  {/* Cleaned Up Metric Pods */}
                  {riskResults && (
                    <div className="budget-risk-metrics">
                      {/* Row 1: Core Risk Metrics */}
                      <div className="metrics-row">
                        <div
                          className={`metric-pod ${getPfaClass(
                            riskResults.pfa
                          )} clickable`}
                          onClick={() =>
                            onShowRiskBreakdown && onShowRiskBreakdown("pfa")
                          }
                          title="Show PFA Breakdown"
                        >
                          <span className="metric-pod-label">PFA</span>
                          <span className="metric-pod-value">
                            {riskResults.pfa.toFixed(4)} %
                          </span>
                        </div>
                        <div
                          className="metric-pod pfr clickable"
                          onClick={() =>
                            onShowRiskBreakdown && onShowRiskBreakdown("pfr")
                          }
                          title="Show PFR Breakdown"
                        >
                          <span className="metric-pod-label">PFR</span>
                          <span className="metric-pod-value">
                            {riskResults.pfr.toFixed(4)} %
                          </span>
                        </div>
                        <div
                          className="metric-pod tur clickable"
                          onClick={() =>
                            onShowRiskBreakdown && onShowRiskBreakdown("tur")
                          }
                          title="Show TUR Breakdown"
                        >
                          <span className="metric-pod-label">TUR</span>
                          <span className="metric-pod-value">
                            {riskResults.tur.toFixed(2)} : 1
                          </span>
                        </div>
                        {isDirect && (
                          <div
                            className="metric-pod tar clickable"
                            onClick={() =>
                              onShowRiskBreakdown && onShowRiskBreakdown("tar")
                            }
                            title="Show TAR Breakdown"
                          >
                            <span className="metric-pod-label">TAR</span>
                            <span className="metric-pod-value">
                              {riskResults.tar.toFixed(2)} : 1
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Optional Guardband Section */}
                      {showGuardband && (
                        <>
                          <div className="metrics-separator">
                            <span>Guardband Analysis</span>
                          </div>

                          {/* Row 2: Guardband Limits & Multiplier */}
                          <div className="metrics-row">
                            <div
                              className="metric-pod gblow clickable"
                              onClick={() => onShowRiskBreakdown("gblow")}
                            >
                              <span className="metric-pod-label">GB LOW</span>
                              <span className="metric-pod-value">
                                {riskResults.gbResults.GBLOW.toFixed(4)}
                              </span>
                            </div>
                            <div
                              className="metric-pod gbhigh clickable"
                              onClick={() => onShowRiskBreakdown("gbhigh")}
                            >
                              <span className="metric-pod-label">GB HIGH</span>
                              <span className="metric-pod-value">
                                {riskResults.gbResults.GBUP.toFixed(4)}
                              </span>
                            </div>
                            <div
                              className="metric-pod gbmult clickable"
                              onClick={() => onShowRiskBreakdown("gbmult")}
                            >
                              <span className="metric-pod-label">
                                GB Multiplier
                              </span>
                              <span className="metric-pod-value">
                                {riskResults.gbResults.GBMULT.toFixed(4)} %
                              </span>
                            </div>
                          </div>

                          {/* Row 3: Guardband Risk */}
                          <div className="metrics-row">
                            <div
                              className="metric-pod gbpfa clickable"
                              onClick={() => onShowRiskBreakdown("gbpfa")}
                            >
                              <span className="metric-pod-label">
                                PFA w/ GB
                              </span>
                              <span className="metric-pod-value">
                                {riskResults.gbResults.GBPFA.toFixed(4)} %
                              </span>
                            </div>
                            <div
                              className="metric-pod gbpfr clickable"
                              onClick={() => onShowRiskBreakdown("gbpfr")}
                            >
                              <span className="metric-pod-label">
                                PFR w/ GB
                              </span>
                              <span className="metric-pod-value">
                                {riskResults.gbResults.GBPFR.toFixed(4)} %
                              </span>
                            </div>
                          </div>

                          {/* Row 4: Intervals & Reliability */}
                          <div className="metrics-row">
                            <div
                              className="metric-pod gbcalint clickable"
                              onClick={() => onShowRiskBreakdown("gbcalint")}
                            >
                              <span className="metric-pod-label">
                                CAL INT w/ GB
                              </span>
                              <span className="metric-pod-value">
                                {riskResults.gbResults.GBCALINT.toFixed(4)}
                              </span>
                            </div>
                            <div
                              className="metric-pod calint clickable"
                              onClick={() => onShowRiskBreakdown("calint")}
                            >
                              <span className="metric-pod-label">
                                CAL INT w/o GB
                              </span>
                              <span className="metric-pod-value">
                                {riskResults.gbResults.NOGBCALINT.toFixed(4)}
                              </span>
                            </div>
                            <div
                              className="metric-pod measrel clickable"
                              onClick={() => onShowRiskBreakdown("measrel")}
                            >
                              <span className="metric-pod-label">
                                REL w/o GB
                              </span>
                              <span className="metric-pod-value">
                                {riskResults.gbResults.NOGBMEASREL.toFixed(4)} %
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </td>
            </tr>
          </>
        )}
      </tfoot>
    </table>
  );
};

export default UncertaintyBudgetTable;