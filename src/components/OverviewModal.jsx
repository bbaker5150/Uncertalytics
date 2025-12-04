import React, { useState } from "react";
import AddTmdeModal from "./AddTmdeModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faPlus,
  faPencilAlt,
  faTrashAlt,
} from "@fortawesome/free-solid-svg-icons";
import {
  getToleranceSummary,
  getToleranceErrorSummary,
  getAbsoluteLimits,
  calculateUncertaintyFromToleranceObject,
  convertPpmToUnit,
} from "../utils/uncertaintyMath";

// --- Sub-Components ---

const UutSealDisplay = ({ uutDescription, uutTolerance, measurementType }) => {
  const toleranceSummary = getToleranceSummary(uutTolerance);
  const isDerived = measurementType === "derived";

  return (
    <div className="uut-seal-container" style={{ padding: "0 0 20px 0", justifyContent: "center" }}>
      <div
        className={`uut-seal ${isDerived ? "derived-point" : ""}`}
        style={{
          minWidth: "350px",
          height: "auto",
          minHeight: "320px",
          padding: "25px",
          cursor: "default",
        }}
      >
        <div className="uut-seal-content">
          <span className="seal-label">Unit Under Test</span>
          <h4 className="seal-title">{uutDescription || "N/A"}</h4>
          <div className="seal-info-item">
            <span>Tolerance Spec</span>
            <strong>{toleranceSummary}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

const TmdeSealDisplay = ({
  tmde,
  onEditClick,
  onContextMenu,
  instanceIndex,
  totalQuantity,
  referencePoint,
  measurementType,
}) => {
  if (!referencePoint?.value || !referencePoint?.unit) {
    return (
      <div className="tmde-seal-clickable-container" onContextMenu={onContextMenu}>
        <div
          className="tmde-seal-clickable tmde-seal-error"
          onClick={onEditClick}
          title="Error: Missing Reference Point. Click to edit."
        >
          <div className="uut-seal-content">
            <span className="seal-label">TMDE (Error)</span>
            <h4 className="seal-title">{tmde.name || "TMDE"}</h4>
            <p style={{ color: "var(--status-bad)", fontSize: "0.8rem", marginTop: "10px", textAlign: "center" }}>
              Missing Reference Point
            </p>
          </div>
        </div>
      </div>
    );
  }

  const toleranceSummary = getToleranceSummary(tmde);
  const toleranceErrorSummary = getToleranceErrorSummary(tmde, referencePoint);
  const { low: limitLow, high: limitHigh } = getAbsoluteLimits(tmde, referencePoint);
  const { standardUncertainty: uPpm } = calculateUncertaintyFromToleranceObject(tmde, referencePoint);
  const stdUncAbs = convertPpmToUnit(uPpm, referencePoint.unit, referencePoint);
  const stdUncDisplay = typeof stdUncAbs === "number" ? `${stdUncAbs.toPrecision(3)} ${referencePoint.unit}` : stdUncAbs;

  return (
    <div className="tmde-seal-clickable-container" onContextMenu={onContextMenu}>
      <div className="tmde-seal-clickable" onClick={onEditClick} title={`Click to edit ${tmde.name}`}>
        <div className="uut-seal-content">
          <span className="seal-label">TMDE</span>
          <h4 className="seal-title">{tmde.name || "TMDE"}</h4>
          {totalQuantity > 1 && (
            <span className="seal-label seal-instance-label" style={{ color: "var(--primary-color)", fontWeight: "bold" }}>
              (Device {instanceIndex + 1} of {totalQuantity})
            </span>
          )}
          {measurementType === "derived" && tmde.variableType && (
            <div className="seal-info-item">
              <span>Eq. Input Type</span>
              <strong style={{ color: "var(--primary-color-dark)", fontSize: "0.9rem" }}>{tmde.variableType}</strong>
            </div>
          )}
          <div className="seal-info-item">
            <span>Nominal Point</span>
            <strong>{referencePoint.value} {referencePoint.unit}</strong>
          </div>
          <div className="seal-info-item">
            <span>Tolerance Spec</span>
            <strong>{toleranceSummary}</strong>
          </div>
          <div className="seal-info-item">
            <span>Calculated Error</span>
            <strong>{toleranceErrorSummary}</strong>
          </div>
          <div className="seal-info-item">
            <span>Std. Unc (u<sub>i</sub>)</span>
            <strong>{stdUncDisplay}</strong>
          </div>
          <div className="seal-limits-split">
            <div className="seal-info-item">
              <span>Low Limit</span>
              <strong className="calculated-limit">{limitLow}</strong>
            </div>
            <div className="seal-info-item">
              <span>High Limit</span>
              <strong className="calculated-limit">{limitHigh}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AddTmdeSeal = ({ onClick }) => (
  <div className="add-tmde-card-small" onClick={onClick}>
    <div className="add-tmde-button-small">
      <FontAwesomeIcon icon={faPlus} />
      <span>Add TMDE</span>
    </div>
  </div>
);

const getPfaClass = (pfa) => {
  if (pfa > 5) return "status-bad";
  if (pfa > 2) return "status-warning";
  return "status-good";
};

// --- Main Modal Component ---

const OverviewModal = ({
  isOpen,
  onClose,
  sessionData,
  onUpdateTestPoint,
  onDeleteTmdeDefinition,
  onDecrementTmdeQuantity,
}) => {
  const [editingTmde, setEditingTmde] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  if (!isOpen || !sessionData) return null;

  const handleEditTmdeClick = (tmde, testPoint) => {
    setEditingTmde({ tmde, testPoint });
  };

  const handleAddTmdeClick = (testPoint) => {
    setEditingTmde({ tmde: null, testPoint });
  };

  const handleSaveTmde = (savedTmde) => {
    const testPoint = editingTmde.testPoint;
    const tolerances = testPoint.tmdeTolerances || [];
    const existingIndex = tolerances.findIndex((t) => t.id === savedTmde.id);
    
    let newTolerances;
    if (existingIndex > -1) {
      newTolerances = [...tolerances];
      newTolerances[existingIndex] = savedTmde;
    } else {
      newTolerances = [...tolerances, savedTmde];
    }

    onUpdateTestPoint(testPoint.id, { tmdeTolerances: newTolerances });
    setEditingTmde(null);
  };

  // Close context menu on click elsewhere
  const handleBackgroundClick = () => {
    if (contextMenu) setContextMenu(null);
  };

  return (
    <div className="modal-overlay" onClick={handleBackgroundClick}>
      
      {/* --- NESTED MODAL OVERLAY --- */}
      {/* This wrapper forces the AddTmdeModal to stack cleanly on top */}
      {editingTmde && (
        <div className="nested-modal-overlay" onClick={(e) => e.stopPropagation()}>
          <AddTmdeModal
            isOpen={!!editingTmde}
            onClose={() => setEditingTmde(null)}
            onSave={handleSaveTmde}
            testPointData={editingTmde.testPoint}
            initialTmdeData={editingTmde.tmde}
            hasParentOverlay={false} 
          />
        </div>
      )}

      {/* --- Main Modal Content --- */}
      <div className="modal-content edit-session-modal" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="modal-close-button">
          &times;
        </button>

        <div className="modal-main-content">
          <h3 style={{ textAlign: "center", marginBottom: "30px", borderBottom: "1px solid var(--border-color)", paddingBottom: "15px" }}>
            Session Overview
          </h3>

          <div className="tmde-management-container">
            <UutSealDisplay
              uutDescription={sessionData.uutDescription}
              uutTolerance={sessionData.uutTolerance}
              measurementType={sessionData.testPoints?.[0]?.measurementType}
            />

            {sessionData.testPoints && sessionData.testPoints.length > 0 ? (
              sessionData.testPoints.map((tp) => (
                <div className="tmde-test-point-group" key={tp.id}>
                  <div className="test-point-header-block">
                    <div className="tp-header-row primary-row">
                      <div className="tp-info-item">
                        <span className="tp-label">Measurement Point:</span>
                        <span className="tp-value">
                          {tp.testPointInfo.parameter.value} {tp.testPointInfo.parameter.unit}
                        </span>
                      </div>
                      <div className="tp-info-item">
                        <span className="tp-label">Measurement Type:</span>
                        <span className="tp-value">{tp.testPointInfo.parameter.name}</span>
                      </div>
                    </div>

                    {tp.riskMetrics && (
                      <div className="tp-header-row secondary-row">
                        <div className="tp-info-item">
                          <span className="tp-label">Expanded Uncertainty:</span>
                          <span className="tp-value">
                            {tp.riskMetrics.expandedUncertainty.toPrecision(4)} {tp.riskMetrics.nativeUnit}
                          </span>
                        </div>
                        <div className="tp-info-item">
                          <span className="tp-label">Tolerance Low:</span>
                          <span className="tp-value">
                            {tp.riskMetrics.LLow} {tp.riskMetrics.nativeUnit}
                          </span>
                        </div>
                        <div className="tp-info-item">
                          <span className="tp-label">Tolerance High:</span>
                          <span className="tp-value">
                            {tp.riskMetrics.LUp} {tp.riskMetrics.nativeUnit}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="tmde-seals-grid">
                    {(tp.tmdeTolerances || []).flatMap((tmde) => {
                      const quantity = tmde.quantity || 1;
                      return Array.from({ length: quantity }, (_, i) => (
                        <TmdeSealDisplay
                          key={`${tmde.id}-${i}`}
                          tmde={tmde}
                          referencePoint={tmde.measurementPoint}
                          measurementType={tp.measurementType}
                          instanceIndex={i}
                          totalQuantity={quantity}
                          onEditClick={() => handleEditTmdeClick(tmde, tp)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            // Context menu logic if needed
                          }}
                        />
                      ));
                    })}
                    <AddTmdeSeal onClick={() => handleAddTmdeClick(tp)} />
                  </div>

                  <div className="metric-pods-row-condensed">
                    {tp.riskMetrics ? (
                      <>
                        <div className={`metric-pod ${getPfaClass(tp.riskMetrics.pfa)}`}>
                          <span className="metric-pod-label">PFA</span>
                          <span className="metric-pod-value">{tp.riskMetrics.pfa.toFixed(4)} %</span>
                        </div>
                        <div className="metric-pod pfr">
                          <span className="metric-pod-label">PFR</span>
                          <span className="metric-pod-value">{tp.riskMetrics.pfr.toFixed(4)} %</span>
                        </div>
                        <div className="metric-pod tur">
                          <span className="metric-pod-label">TUR</span>
                          <span className="metric-pod-value">{tp.riskMetrics.tur.toFixed(2)} : 1</span>
                        </div>
                        <div className="metric-pod tar">
                          <span className="metric-pod-label">TAR</span>
                          <span className="metric-pod-value">{tp.riskMetrics.tar.toFixed(2)} : 1</span>
                        </div>
                      </>
                    ) : (
                      <span className="risk-not-calculated">Risk metrics not calculated for this point.</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="placeholder-content" style={{ minHeight: "200px" }}>
                <p>This session has no measurement points.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewModal;