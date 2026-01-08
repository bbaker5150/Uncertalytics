/**
 * * The main container for the "Uncertainty Analysis" tab.
 * * Responsibilities:
 * - Renders the visual Instrument Table (formerly Seals) for UUT and TMDEs.
 * - Renders the Uncertainty Budget Table.
 * - Renders the Contribution Bar Graph.
 * - Handles context menus.
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
  onOpenUutModal, 
  onDeleteUut,
  setContextMenu,
  setBreakdownPoint,
  onBudgetRowContextMenu,
  onShowDerivedBreakdown,
  onShowRiskBreakdown,
  showContribution,
  setShowContribution,
  onOpenRepeatability,
  riskResults,
  setNotification
}) => {

  // Determine if UUT is defined (has a description or specs)
  const isUutDefined = (sessionData.uutDescription && sessionData.uutDescription.trim() !== "") || 
                       (uutToleranceData && Object.keys(uutToleranceData).length > 0);

  return (
    <div className="configuration-panel">
      
      {/* --- INSTRUMENT CONFIGURATION TABLE (New Design) --- */}
      <div className="instrument-section">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', marginTop: '10px'}}>
             <h4 className="analyzed-components-title" style={{margin: 0, border: 'none', padding: 0}}>Measurement System Configuration</h4>
             <button className="button button-small" onClick={onAddTmde} style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                <FontAwesomeIcon icon={faPlus} /> <span>Add TMDE</span>
             </button>
        </div>

        <div className="instrument-table-container">
            <table className="instrument-summary-table">
                <thead>
                    <tr>
                        <th style={{width: '90px'}}>Role</th>
                        <th>Instrument / Description</th>
                        <th>Parameter / Range</th>
                        <th>Tolerance Specification <span style={{fontSize:'0.75em', fontWeight:'normal', opacity: 0.8, marginLeft: '5px'}}>(Click to Edit)</span></th>
                        <th>Std. Unc (k=1)</th>
                        <th>Limits</th>
                        <th style={{width: '60px'}}></th>
                    </tr>
                </thead>
                <tbody>
                    {/* --- UUT ROW --- */}
                    <tr className="uut-row">
                        <td><span className="role-badge uut">UUT</span></td>
                        <td>
                            {isUutDefined ? (
                                <div style={{fontWeight: 600}}>{sessionData.uutDescription}</div>
                            ) : (
                                <span style={{fontStyle: 'italic', color: 'var(--text-color-muted)'}}>Not Defined</span>
                            )}
                        </td>
                        <td>
                             {testPointData.measurementType === "derived" ? (
                                 <span>Derived: <strong>{calcResults?.calculatedNominalValue?.toPrecision(5) ?? "N/A"}</strong> {uutNominal?.unit}</span>
                             ) : (
                                 <span>{uutNominal?.value} {uutNominal?.unit}</span>
                             )}
                        </td>
                        <td
                            className="clickable-spec-cell"
                            onClick={onOpenUutModal}
                            title="Edit UUT Specifications"
                        >
                            {isUutDefined ? (
                                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                                    <span>{getToleranceSummary(uutToleranceData)}</span>
                                    <FontAwesomeIcon icon={faPencilAlt} className="edit-icon-hover" />
                                </div>
                            ) : (
                                <button className="add-link-btn" onClick={(e) => { e.stopPropagation(); onOpenUutModal(); }}>
                                    + Define UUT
                                </button>
                            )}
                        </td>
                        <td>
                            <span style={{color: 'var(--text-color-muted)'}}>-</span>
                        </td>
                        <td>
                            {isUutDefined && uutNominal ? (
                                <div className="limits-cell">
                                    <span className="limit-val">{getAbsoluteLimits(uutToleranceData, uutNominal).low}</span>
                                    <span className="limit-sep">to</span>
                                    <span className="limit-val">{getAbsoluteLimits(uutToleranceData, uutNominal).high}</span>
                                </div>
                            ) : "-"}
                        </td>
                        <td className="action-cell">
                             {isUutDefined && (
                                <button className="icon-action-btn destructive" onClick={onDeleteUut} title="Delete UUT">
                                    <FontAwesomeIcon icon={faTrashAlt} />
                                </button>
                             )}
                        </td>
                    </tr>

                    {/* --- TMDE ROWS --- */}
                    {tmdeTolerancesData.map((tmde, index) => {
                        const quantity = tmde.quantity || 1;
                        return Array.from({ length: quantity }).map((_, i) => {
                             const referencePoint = tmde.measurementPoint;
                             const isError = !referencePoint?.value || !referencePoint?.unit;
                             const key = `${tmde.id}-${i}`;

                             // Calculate Std Unc for display
                             let stdUncDisplay = "-";
                             if (!isError) {
                                const { standardUncertainty: uPpm } = calculateUncertaintyFromToleranceObject(tmde, referencePoint);
                                const uAbs = convertPpmToUnit(uPpm, referencePoint.unit, referencePoint);
                                stdUncDisplay = typeof uAbs === "number" ? `${uAbs.toPrecision(3)}` : uAbs;
                             }

                             return (
                                <tr key={key} className="tmde-row">
                                    <td>
                                        <span className="role-badge tmde">TMDE {quantity > 1 ? `#${i+1}` : ""}</span>
                                    </td>
                                    <td>
                                        <div style={{fontWeight: 500}}>{tmde.name || "Unknown TMDE"}</div>
                                        {testPointData.measurementType === "derived" && tmde.variableType && (
                                            <div style={{fontSize: '0.75rem', color: 'var(--primary-color)', marginTop: '2px'}}>
                                                Input: <strong>{tmde.variableType}</strong>
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        {isError ? (
                                            <span className="status-bad" style={{fontWeight: 'bold', fontSize: '0.8rem'}}>Missing Ref</span>
                                        ) : (
                                            <span>{referencePoint.value} {referencePoint.unit}</span>
                                        )}
                                    </td>
                                    <td
                                        className="clickable-spec-cell"
                                        onClick={() => onEditTmde(tmde)}
                                        title="Edit TMDE Specifications"
                                    >
                                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                                            <span>{getToleranceSummary(tmde)}</span>
                                            <FontAwesomeIcon icon={faPencilAlt} className="edit-icon-hover" />
                                        </div>
                                    </td>
                                    <td>
                                        <strong>{stdUncDisplay}</strong> <span style={{fontSize: '0.8rem', color: 'var(--text-color-muted)'}}>{!isError ? referencePoint.unit : ''}</span>
                                    </td>
                                    <td>
                                        {!isError ? (
                                            <div className="limits-cell">
                                                <span className="limit-val">{getAbsoluteLimits(tmde, referencePoint).low}</span>
                                                <span className="limit-sep">to</span>
                                                <span className="limit-val">{getAbsoluteLimits(tmde, referencePoint).high}</span>
                                            </div>
                                        ) : "-"}
                                    </td>
                                    <td className="action-cell">
                                        <div className="action-row">
                                            {quantity > 1 ? (
                                                <button
                                                    className="icon-action-btn destructive"
                                                    onClick={() => onDecrementTmdeQuantity(tmde.id)}
                                                    title="Remove this instance"
                                                >
                                                    <FontAwesomeIcon icon={faTrashAlt} />
                                                </button>
                                            ) : (
                                                <button
                                                    className="icon-action-btn destructive"
                                                    onClick={() => onDeleteTmdeDefinition(tmde.id)}
                                                    title="Remove TMDE"
                                                >
                                                    <FontAwesomeIcon icon={faTrashAlt} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                             );
                        });
                    })}

                    {tmdeTolerancesData.length === 0 && (
                        <tr>
                            <td colSpan="7" style={{textAlign: 'center', padding: '30px', color: 'var(--text-color-muted)', fontStyle: 'italic'}}>
                                No TMDEs configured. Click the "Add TMDE" button above to begin.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* --- UNCERTAINTY BUDGET & GRAPH --- */}
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
            setNotification={setNotification}
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