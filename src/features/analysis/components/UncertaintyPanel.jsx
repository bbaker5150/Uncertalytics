/**
 * * The main container for the "Uncertainty Analysis" tab.
 * * Responsibilities:
 * - Renders the visual "Seals" for UUT and TMDEs.
 * - Renders the Uncertainty Budget Table.
 * - Renders the Contribution Bar Graph.
 * - Handles context menus for Seals.
 */

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faCalculator, 
  faPlus, 
  faPencilAlt, 
  faTrashAlt 
} from "@fortawesome/free-solid-svg-icons";

// Sub-components
import UncertaintyBudgetTable from "./UncertaintyBudgetTable";
import PercentageBarGraph from "./ContributionPlot";

// Utils
import {
  getToleranceSummary,
  getToleranceErrorSummary,
  getAbsoluteLimits,
  calculateUncertaintyFromToleranceObject,
  convertPpmToUnit,
} from "../../../utils/uncertaintyMath";

const UncertaintyPanel = ({
  testPointData,
  sessionData,
  calcResults,
  calculationError,
  uutNominal,
  uutToleranceData,
  tmdeTolerancesData,
  // Handlers
  onAddManualComponent,
  onEditManualComponent,
  onRemoveComponent,
  onAddTmde,
  onEditTmde,
  onDeleteTmdeDefinition,
  onDecrementTmdeQuantity,
  handleOpenSessionEditor,
  setContextMenu,
  setBreakdownPoint,
  onBudgetRowContextMenu,
  onShowDerivedBreakdown,
  onShowRiskBreakdown,
  showContribution,
  setShowContribution,
  onOpenRepeatability,
  riskResults
}) => {
  return (
    <div className="configuration-panel">
      {/* --- UUT SECTION --- */}
      <h4 className="uut-components-title">Unit Under Test</h4>
      <div className="uut-seal-container">
        <div
          className={`uut-seal ${testPointData.measurementType === "derived" ? "derived-point" : ""}`}
          onClick={() => handleOpenSessionEditor("uut")}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({
              x: e.pageX,
              y: e.pageY,
              items: [
                {
                  label: "View UUT Calculation",
                  action: () =>
                    setBreakdownPoint({
                      title: "UUT Breakdown",
                      toleranceObject: uutToleranceData,
                      referencePoint: uutNominal,
                    }),
                  icon: faCalculator,
                },
              ],
            });
          }}
        >
          <div className="uut-seal-content">
            <span className="seal-label">Unit Under Test</span>
            <h4 className="seal-title">{sessionData.uutDescription || "N/A"}</h4>
            <div className="seal-info-item">
              <span>Current Point {testPointData.measurementType === "derived" && "(Derived)"}</span>
              <strong>
                {testPointData.measurementType === "derived"
                  ? calcResults?.calculatedNominalValue?.toPrecision(5) ?? (testPointData.testPointInfo.parameter.name || "Derived Value")
                  : `${uutNominal?.value ?? ""} ${uutNominal?.unit ?? ""}`}{" "}
                {testPointData.measurementType === "derived" && ` (${uutNominal?.unit ?? ""})`}
              </strong>
            </div>
            {testPointData.measurementType === "derived" && testPointData.equationString && (
              <div className="seal-info-item" style={{ fontStyle: "italic", marginTop: "5px" }}>
                <span>Equation</span>
                <strong style={{ fontFamily: "monospace" }}>{testPointData.equationString}</strong>
              </div>
            )}
            <div className="seal-info-item">
              <span>Tolerance Spec</span>
              <strong>{getToleranceSummary(uutToleranceData)}</strong>
            </div>
            <div className="seal-info-item">
              <span>Calculated Error</span>
              <strong>{getToleranceErrorSummary(uutToleranceData, uutNominal)}</strong>
            </div>
            <div className="seal-limits-split">
              <div className="seal-info-item">
                <span>Low Limit</span>
                <strong className="calculated-limit">
                  {getAbsoluteLimits(uutToleranceData, uutNominal).low}
                </strong>
              </div>
              <div className="seal-info-item">
                <span>High Limit</span>
                <strong className="calculated-limit">
                  {getAbsoluteLimits(uutToleranceData, uutNominal).high}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- TMDE SECTION --- */}
      <h4 className="analyzed-components-title">Test Measurement Device Equipment</h4>
      <div className="analyzed-components-container">
        {tmdeTolerancesData.flatMap((tmde, index) => {
          const quantity = tmde.quantity || 1;
          return Array.from({ length: quantity }, (_, i) => {
            const referencePoint = tmde.measurementPoint;
            
            // Error State: Missing Reference
            if (!referencePoint?.value || !referencePoint?.unit) {
              return (
                <div key={`${tmde.id || index}-${i}`} className="tmde-seal tmde-seal-error">
                  <div className="uut-seal-content">
                    <span className="seal-label">TMDE (Error)</span>
                    <h4>{tmde.name || "TMDE"}</h4>
                    <p style={{ color: "var(--status-bad)", fontSize: "0.8rem", marginTop: "10px" }}>
                      Missing Reference
                    </p>
                    <button onClick={() => onEditTmde(tmde)} className="button button-small" style={{ marginTop: "auto" }}>
                      Edit
                    </button>
                  </div>
                </div>
              );
            }

            // Standard TMDE Seal
            return (
              <div
                key={`${tmde.id || index}-${i}`}
                className="tmde-seal"
                onClick={() => onEditTmde(tmde)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  const menuItems = [
                    {
                      label: `View ${tmde.name || "TMDE"} Calculation`,
                      action: () => setBreakdownPoint({
                          title: `${tmde.name || "TMDE"} Breakdown`,
                          toleranceObject: tmde,
                          referencePoint: tmde.measurementPoint,
                        }),
                      icon: faCalculator,
                    },
                    {
                      label: `Edit "${tmde.name}" (All ${quantity})`,
                      action: () => onEditTmde(tmde),
                      icon: faPencilAlt,
                    },
                    { type: "divider" },
                  ];

                  if (quantity > 1) {
                    menuItems.push({
                      label: `Delete This Instance`,
                      action: () => onDecrementTmdeQuantity(tmde.id),
                      icon: faTrashAlt,
                      className: "destructive",
                    });
                  }

                  menuItems.push({
                    label: `Delete All "${tmde.name}"`,
                    action: () => onDeleteTmdeDefinition(tmde.id),
                    icon: faTrashAlt,
                    className: "destructive",
                  });

                  setContextMenu({ x: e.pageX, y: e.pageY, items: menuItems });
                }}
              >
                <div className="uut-seal-content">
                  <span className="seal-label">TMDE</span>
                  <h4 className="seal-title">{tmde.name || "TMDE"}</h4>
                  {quantity > 1 && (
                    <span className="seal-label seal-instance-label">(Device {i + 1} of {quantity})</span>
                  )}
                  {testPointData.measurementType === "derived" && tmde.variableType && (
                    <div className="seal-info-item">
                      <span>Equation Input Type</span>
                      <strong style={{ color: "var(--primary-color-dark)", fontSize: "0.9rem" }}>
                        {tmde.variableType}
                      </strong>
                    </div>
                  )}
                  <div className="seal-info-item">
                    <span>Nominal Point</span>
                    <strong>{referencePoint.value} {referencePoint.unit}</strong>
                  </div>
                  <div className="seal-info-item">
                    <span>Tolerance Spec</span>
                    <strong>{getToleranceSummary(tmde)}</strong>
                  </div>
                  <div className="seal-info-item">
                    <span>Calculated Error</span>
                    <strong>{getToleranceErrorSummary(tmde, referencePoint)}</strong>
                  </div>
                  <div className="seal-info-item">
                    <span>Std. Unc (u<sub>i</sub>)</span>
                    <strong>
                      {(() => {
                        const { standardUncertainty: uPpm } = calculateUncertaintyFromToleranceObject(tmde, referencePoint);
                        const uAbs = convertPpmToUnit(uPpm, referencePoint.unit, referencePoint);
                        return typeof uAbs === "number" ? `${uAbs.toPrecision(3)} ${referencePoint.unit}` : uAbs;
                      })()}
                    </strong>
                  </div>
                  <div className="seal-limits-split">
                    <div className="seal-info-item">
                      <span>Low Limit</span>
                      <strong className="calculated-limit">{getAbsoluteLimits(tmde, referencePoint).low}</strong>
                    </div>
                    <div className="seal-info-item">
                      <span>High Limit</span>
                      <strong className="calculated-limit">{getAbsoluteLimits(tmde, referencePoint).high}</strong>
                    </div>
                  </div>
                </div>
              </div>
            );
          });
        })}

        {/* Add TMDE Button */}
        <div className="add-tmde-card">
          <button className="add-tmde-button" onClick={onAddTmde}>
            <FontAwesomeIcon icon={faPlus} />
            <span>Add TMDE</span>
          </button>
        </div>
      </div>

      {/* --- TABLE & GRAPH --- */}
      {calculationError ? (
        <div className="form-section-warning">
          <p><strong>Calculation Error:</strong> {calculationError}</p>
          <p style={{ marginTop: "5px", fontSize: "0.9rem", color: "var(--text-color-muted)" }}>
            Please ensure all required fields are set (e.g., UUT nominal, equation, and all mapped TMDEs).
          </p>
        </div>
      ) : (
        <>
          <UncertaintyBudgetTable
            components={calcResults?.calculatedBudgetComponents || []}
            onRemove={onRemoveComponent}
            calcResults={calcResults}
            referencePoint={uutNominal}
            uncertaintyConfidence={sessionData.uncReq.uncertaintyConfidence}
            onRowContextMenu={onBudgetRowContextMenu}
            equationString={testPointData.equationString}
            measurementType={testPointData.measurementType}
            riskResults={riskResults}
            onShowDerivedBreakdown={onShowDerivedBreakdown}
            onShowRiskBreakdown={onShowRiskBreakdown}
            showContribution={showContribution}
            setShowContribution={setShowContribution}
            hasTmde={tmdeTolerancesData.length > 0}
            onAddManualComponent={onAddManualComponent}
            onEdit={onEditManualComponent}
            onOpenRepeatability={onOpenRepeatability}
          />
          {showContribution && calcResults?.calculatedBudgetComponents?.length > 0 && (
            <PercentageBarGraph
              type={testPointData.measurementType === "derived"}
              unit={uutNominal?.unit || "Units"}
              data={Object.fromEntries(
                calcResults.calculatedBudgetComponents.map((item) => {
                  const value = testPointData.measurementType === "derived"
                    ? item.contribution || 0
                    : item.value_native || item.value || 0;
                  const label = item.name.startsWith("Input: ") ? item.name.substring(7) : item.name;
                  return [label, value];
                })
              )}
            />
          )}
        </>
      )}
    </div>
  );
};

export default UncertaintyPanel;