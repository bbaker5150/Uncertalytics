import React, { useState, useLayoutEffect, useMemo, useEffect } from "react";
import AddTmdeModal from "./AddTmdeModal";
import ToleranceForm from "./ToleranceForm";
import ContextMenu from "./ContextMenu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { v4 as uuidv4 } from "uuid";
import {
  faCheck,
  faPlus,
  faTrashAlt,
  faPencilAlt,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";

import {
  NotificationModal,
  getToleranceSummary,
  getToleranceErrorSummary,
  getAbsoluteLimits,
  calculateUncertaintyFromToleranceObject,
  convertPpmToUnit,
} from "../App";

const UutSealDisplay = ({ uutDescription, uutTolerance, measurementType }) => {
    const toleranceSummary = getToleranceSummary(uutTolerance);
    const isDerived = measurementType === 'derived';

    return (
        <div className="uut-seal-container" style={{padding: '0 0 20px 0', justifyContent: 'center'}}>
            <div 
                className={`uut-seal ${isDerived ? 'derived-point' : ''}`} 
                style={{minWidth: '350px', height: 'auto', minHeight: '320px', padding: '25px', cursor: 'default'}}
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
      <div
        className="tmde-seal-clickable-container"
        onContextMenu={onContextMenu}
      >
        <div
          className="tmde-seal-clickable tmde-seal-error"
          onClick={onEditClick}
          title="Error: Missing Reference Point. Click to edit."
        >
          <div className="uut-seal-content">
            <span className="seal-label">TMDE (Error)</span>
            <h4 className="seal-title">{tmde.name || "TMDE"}</h4>
            <p
              style={{
                color: "var(--status-bad)",
                fontSize: "0.8rem",
                marginTop: "10px",
                textAlign: "center",
              }}
            >
              Missing Reference Point
            </p>
          </div>
        </div>
      </div>
    );
  }

  const toleranceSummary = getToleranceSummary(tmde);
  const toleranceErrorSummary = getToleranceErrorSummary(tmde, referencePoint);
  const { low: limitLow, high: limitHigh } = getAbsoluteLimits(
    tmde,
    referencePoint
  );

  const { standardUncertainty: uPpm } = calculateUncertaintyFromToleranceObject(
    tmde,
    referencePoint
  );
  const stdUncAbs = convertPpmToUnit(uPpm, referencePoint.unit, referencePoint);
  const stdUncDisplay =
    typeof stdUncAbs === "number"
      ? `${stdUncAbs.toPrecision(3)} ${referencePoint.unit}`
      : stdUncAbs;

  return (
    <div
      className="tmde-seal-clickable-container"
      onContextMenu={onContextMenu}
    >
      <div
        className="tmde-seal-clickable"
        onClick={onEditClick}
        title={`Click to edit ${tmde.name}`}
      >
        <div className="uut-seal-content">
          <span className="seal-label">TMDE</span>
          <h4 className="seal-title">{tmde.name || "TMDE"}</h4>

          {totalQuantity > 1 && (
            <span
              className="seal-label seal-instance-label"
              style={{ color: "var(--primary-color)", fontWeight: "bold" }}
            >
              (Device {instanceIndex + 1} of {totalQuantity})
            </span>
          )}

          {measurementType === "derived" && tmde.variableType && (
            <div className="seal-info-item">
              <span>Eq. Input Type</span>
              <strong
                style={{
                  color: "var(--primary-color-dark)",
                  fontSize: "0.9rem",
                }}
              >
                {tmde.variableType}
              </strong>
            </div>
          )}
          <div className="seal-info-item">
            <span>Nominal Point</span>
            <strong>
              {referencePoint.value} {referencePoint.unit}
            </strong>
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
            <span>
              Std. Unc (u<sub>i</sub>)
            </span>
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

const EditSessionModal = ({
  isOpen,
  onClose,
  sessionData,
  onSave,
  initialSection,
  initialTmdeToEdit,
  sessionImageCache,
  onImageCacheChange,
}) => {
  const [formData, setFormData] = useState({});
  const [activeSection, setActiveSection] = useState("details");
  const [editingTmde, setEditingTmde] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [notification, setNotification] = useState(null);
  const [newlyAddedFiles, setNewlyAddedFiles] = useState([]);
  const [imageSrcCache, setImageSrcCache] = useState(new Map());
  const [viewingImageSrc, setViewingImageSrc] = useState(null);

  // Gets the URL for an image, either from the session cache or a new file
  const getImageSrc = (imageRef) => {
    return imageSrcCache.get(imageRef.id) || null; // Or a placeholder image path
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newImageRefs = [];
    const newFileObjects = [];

    files.forEach((file) => {
      const newId = uuidv4();
      const newRef = { id: newId, fileName: file.name };
      newImageRefs.push(newRef);
      newFileObjects.push({ id: newId, fileObject: file });
    });

    // Update the formData (which holds the JSON references)
    setFormData((prev) => ({
      ...prev,
      noteImages: [...(prev.noteImages || []), ...newImageRefs],
    }));

    // Update the local state for new files to be passed up on save
    setNewlyAddedFiles((prev) => [...prev, ...newFileObjects]);
  };

  const handleRemoveImage = (e, imageIdToRemove) => {
    e.stopPropagation(); // Prevent modal from closing, etc.

    // Update the formData (removing the JSON reference)
    setFormData((prev) => ({
      ...prev,
      noteImages: prev.noteImages.filter((img) => img.id !== imageIdToRemove),
    }));

    // Remove from newly added files if it's there
    setNewlyAddedFiles((prev) =>
      prev.filter((img) => img.id !== imageIdToRemove)
    );

    // Remove from the main cache (this is a direct mutation, but fine for a Map)
    // This removes the image *for this session only*. It doesn't delete the attachment.
    // A full delete would require re-saving the PDF without the attachment.
    const sessionCache = sessionImageCache.get(sessionData.id);
    if (sessionCache && sessionCache.has(imageIdToRemove)) {
      sessionCache.delete(imageIdToRemove);
      onImageCacheChange(new Map(sessionImageCache)); // Trigger re-render
    }
  };

  useEffect(() => {
    const newImageSrcCache = new Map();

    if (sessionData && formData.noteImages) {
      const sessionCache = sessionImageCache.get(sessionData.id);

      formData.noteImages.forEach(imageRef => {
        let objectUrl = null;

        // 1. Check newly added files
        const newFile = newlyAddedFiles.find(f => f.id === imageRef.id);
        if (newFile) {
          objectUrl = URL.createObjectURL(newFile.fileObject);
        }
        // 2. Check the main app cache for loaded Blobs/Files
        else if (sessionCache) {
          const cachedFile = sessionCache.get(imageRef.id);
          if (cachedFile instanceof File || cachedFile instanceof Blob) {
            objectUrl = URL.createObjectURL(cachedFile);
          }
        }
        
        if (objectUrl) {
          newImageSrcCache.set(imageRef.id, objectUrl);
        }
      });
    }

    // Update the state with the new URLs
    setImageSrcCache(newImageSrcCache);

    // Cleanup function: This runs when the component unmounts
    // or before the effect runs again. It revokes all old URLs.
    return () => {
      imageSrcCache.forEach(url => URL.revokeObjectURL(url));
    };
    
  }, [formData.noteImages, sessionData, sessionImageCache, newlyAddedFiles]);

  const showOverviewTab = useMemo(() => {
    if (!formData.testPoints) return false;
    return formData.testPoints.some(
      (tp) =>
        tp.riskMetrics && tp.tmdeTolerances && tp.tmdeTolerances.length > 0
    );
  }, [formData.testPoints]);

  const handleEditTmdeClick = (tmde, testPoint) => {
    setEditingTmde({ tmde, testPoint });
  };

  useLayoutEffect(() => {
    if (isOpen && sessionData) {
      setFormData({
        ...sessionData,
        uncReq: sessionData.uncReq || {},
      });
      setActiveSection(initialSection || "details");

      if (initialTmdeToEdit) {
        handleEditTmdeClick(
          initialTmdeToEdit.tmde,
          initialTmdeToEdit.testPoint
        );
      } else {
        setEditingTmde(null);
      }
    }
  }, [isOpen, sessionData, initialSection, initialTmdeToEdit]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevFormData => ({
      ...prevFormData,
      [name]: value
    }));
  };

  const handleReqChange = (e) => {
    const { name, value } = e.target;

    setFormData((prevFormData) => ({
      ...prevFormData,
      uncReq: {
        ...prevFormData.uncReq,
        [name]: value,
      },
    }));
  };

  const handleToleranceChange = (updater) => {
    setFormData((prev) => {
      const currentTolerance = prev.uutTolerance || {};
      const newTolerance =
        typeof updater === "function" ? updater(currentTolerance) : updater;
      return { ...prev, uutTolerance: newTolerance };
    });
  };

  const handleSave = () => {
    const uncReqLabel = {
      uncertaintyConfidence: "Uncertainty Confidence (%)",
      reliability: "Meas Rel Target (%)",
      calInt: "Calibration Interval",
      measRelCalcAssumed: "Meas Rel Calc/Assumed (%)",
      neededTUR: "TUR Needed For Assumed Meas Rel",
      reqPFA: "PFA Required (%)",
      guardBandMultiplier: "Default Guard Band Multiplier",
    };

    if (!formData.uncReq) {
      onSave(formData, newlyAddedFiles);
      return;
    }

    for (const key in formData.uncReq) {
      if (formData.uncReq[key] === "") {
        setNotification({
          title: uncReqLabel[key],
          message: "Enter valid " + uncReqLabel[key] + ".",
        });
        return;
      }
    }
    onSave(formData, newlyAddedFiles);
  };

  const handleAddTmdeClick = (testPoint) => {
    setEditingTmde({ tmde: null, testPoint });
  };

  const handleSaveTmde = (savedTmde) => {
    const updatedTestPoints = formData.testPoints.map((tp) => {
      if (tp.id === editingTmde.testPoint.id) {
        const tolerances = tp.tmdeTolerances || [];
        const existingIndex = tolerances.findIndex(
          (t) => t.id === savedTmde.id
        );
        let newTolerances;
        if (existingIndex > -1) {
          newTolerances = [...tolerances];
          newTolerances[existingIndex] = savedTmde;
        } else {
          newTolerances = [...tolerances, savedTmde];
        }
        return { ...tp, tmdeTolerances: newTolerances };
      }
      return tp;
    });
    const newFormData = { ...formData, testPoints: updatedTestPoints };

    onSave(newFormData);

    if (!initialTmdeToEdit) {
      setFormData(newFormData);
      setEditingTmde(null);
    }
  };

  const handleDeleteTmde = (testPointId, tmdeId) => {
    const updatedTestPoints = formData.testPoints.map((tp) => {
      if (tp.id === testPointId) {
        const newTolerances = tp.tmdeTolerances.filter((t) => t.id !== tmdeId);
        return { ...tp, tmdeTolerances: newTolerances };
      }
      return tp;
    });
    const newFormData = { ...formData, testPoints: updatedTestPoints };

    setFormData(newFormData);
    onSave(newFormData);
  };

  const handleDecrementQuantity = (testPointId, tmdeId) => {
    const updatedTestPoints = formData.testPoints.map((tp) => {
      if (tp.id === testPointId) {
        const newTolerances = tp.tmdeTolerances
          .map((t) => {
            if (t.id === tmdeId) {
              const newQuantity = (t.quantity || 1) - 1;
              return { ...t, quantity: newQuantity };
            }
            return t;
          })
          .filter((t) => t.quantity > 0);

        return { ...tp, tmdeTolerances: newTolerances };
      }
      return tp;
    });
    const newFormData = { ...formData, testPoints: updatedTestPoints };

    setFormData(newFormData);
    onSave(newFormData);
  };

  return (
    <div className="modal-overlay">
      {notification && (
        <NotificationModal
          isOpen={!!notification}
          onClose={() => setNotification(null)}
          title={notification.title}
          message={notification.message}
        />
      )}
      <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
      {editingTmde && (
        <AddTmdeModal
          isOpen={!!editingTmde}
          onClose={() => {
            setEditingTmde(null);
            if (initialTmdeToEdit) {
              onClose();
            }
          }}
          onSave={handleSaveTmde}
          testPointData={editingTmde.testPoint}
          initialTmdeData={editingTmde.tmde}
          hasParentOverlay={true}
        />
      )}
      {viewingImageSrc && (
      <div
        className="image-viewer-overlay"
        onClick={() => setViewingImageSrc(null)}
      >
        <button
          className="image-viewer-close"
          onClick={() => setViewingImageSrc(null)}
        >
          &times;
        </button>
        <img
          src={viewingImageSrc}
          alt="Full-size preview"
          onClick={(e) => e.stopPropagation()} // Prevents image click from closing modal
        />
      </div>
    )}
      <div
        className={`modal-content edit-session-modal ${
          editingTmde ? "modal-content-hidden" : ""
        }`}
      >
        <button onClick={onClose} className="modal-close-button">
          &times;
        </button>

        <div className="modal-main-content">
          <h3>Session Settings</h3>
          <div className="modal-tabs">
            <button
              className={`modal-tab ${
                activeSection === "details" ? "active" : ""
              }`}
              onClick={() => setActiveSection("details")}
            >
              Session Details
            </button>
            <button
              className={`modal-tab ${activeSection === "uut" ? "active" : ""}`}
              onClick={() => setActiveSection("uut")}
            >
              UUT Specification
            </button>
            <button
              className={`modal-tab ${
                activeSection === "requirements" ? "active" : ""
              }`}
              onClick={() => setActiveSection("requirements")}
            >
              Uncertainty Requirements
            </button>
            {showOverviewTab && (
              <button
                className={`modal-tab ${
                  activeSection === "tmdes" ? "active" : ""
                }`}
                onClick={() => setActiveSection("tmdes")}
              >
                Overview
              </button>
            )}
          </div>

          {activeSection === "details" && (
            <div className="details-grid">
              <div className="form-section full-span">
                <label>Session Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name || ""}
                  onChange={handleChange}
                  placeholder="e.g., Fluke 8588A Verification"
                />
              </div>
              <div className="form-section">
                <label>Analyst</label>
                <input
                  type="text"
                  name="analyst"
                  value={formData.analyst || ""}
                  onChange={handleChange}
                  placeholder="Your Name"
                />
              </div>
              <div className="form-section">
                <label>Organization</label>
                <input
                  type="text"
                  name="organization"
                  value={formData.organization || ""}
                  onChange={handleChange}
                  placeholder="Your Organization"
                />
              </div>
              <div className="form-section">
                <label>Document</label>
                <input
                  type="text"
                  name="document"
                  value={formData.document || ""}
                  onChange={handleChange}
                  placeholder="Document ID or Name"
                />
              </div>
              <div className="form-section">
                <label>Document Date</label>
                <input
                  type="date"
                  name="documentDate"
                  value={formData.documentDate || ""}
                  onChange={handleChange}
                />
              </div>
              <div className="form-section full-span">
                <label>Analysis Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes || ""}
                  onChange={handleChange}
                  rows="8"
                  placeholder="Record analysis notes here..."
                ></textarea>
              </div>

              <div className="form-section full-span">
                <label>Attached Images</label>
                <div className="image-gallery-container">
                  {(formData.noteImages || []).map((imageRef) => {
                    const src = getImageSrc(imageRef);
                    return (
                      <div 
                        key={imageRef.id} 
                        className="image-thumbnail"
                        onClick={() => setViewingImageSrc(src)}
                        style={{ cursor: 'pointer' }}
                        title={`Click to view ${imageRef.fileName}`}
                        >
                        <img
                            src={src}
                            alt={imageRef.fileName}
                        />
                        <button
                          className="remove-image-btn"
                          onClick={(e) => handleRemoveImage(e, imageRef.id)}
                          title="Remove Image"
                        >
                          <FontAwesomeIcon icon={faTimes} />
                        </button>
                      </div>
                    );
                  })}
                  <label
                    htmlFor="image-upload-input"
                    className="image-add-button"
                  >
                    <FontAwesomeIcon icon={faPlus} />
                  </label>
                  <input
                    id="image-upload-input"
                    type="file"
                    accept="image/png, image/jpeg"
                    multiple
                    onChange={handleImageUpload}
                    style={{ display: "none" }}
                  />
                </div>
              </div>

            </div>
          )}

          {activeSection === "uut" && (
            <>
              <div className="form-section">
                <label>UUT Name / Model</label>
                <input
                  type="text"
                  name="uutDescription"
                  value={formData.uutDescription || ""}
                  onChange={handleChange}
                  placeholder="e.g., Fluke 8588A"
                />
              </div>
              <ToleranceForm
                tolerance={formData.uutTolerance || {}}
                setTolerance={handleToleranceChange}
                isUUT={true}
                referencePoint={null}
              />
            </>
          )}

          {activeSection === "tmdes" && (
            <div className="tmde-management-container">
              <UutSealDisplay
                uutDescription={formData.uutDescription}
                uutTolerance={formData.uutTolerance}
                measurementType={formData.testPoints?.[0]?.measurementType}
              />

              {formData.testPoints && formData.testPoints.length > 0 ? (
                formData.testPoints.map((tp) => (
                  <div className="tmde-test-point-group" key={tp.id}>
                    <div className="test-point-header-block">
                      <div className="tp-header-row primary-row">
                        <div className="tp-info-item">
                          <span className="tp-label">Measurement Point:</span>
                          <span className="tp-value">
                            {tp.testPointInfo.parameter.value}{" "}
                            {tp.testPointInfo.parameter.unit}
                          </span>
                        </div>
                        <div className="tp-info-item">
                          <span className="tp-label">Measurement Type:</span>
                          <span className="tp-value">
                            {tp.testPointInfo.parameter.name}
                          </span>
                        </div>
                      </div>

                      {tp.riskMetrics && (
                        <div className="tp-header-row secondary-row">
                          <div className="tp-info-item">
                            <span className="tp-label">
                              Expanded Uncertainty:
                            </span>
                            <span className="tp-value">
                              {tp.riskMetrics.expandedUncertainty.toPrecision(
                                4
                              )}{" "}
                              {tp.riskMetrics.nativeUnit}
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
                              setContextMenu(null);

                              const menuItems = [
                                {
                                  label: `Edit "${tmde.name}" (All ${quantity})`,
                                  action: () => handleEditTmdeClick(tmde, tp),
                                  icon: faPencilAlt,
                                },
                              ];

                              if (quantity > 1) {
                                menuItems.push({
                                  label: `Delete This Instance`,
                                  action: () =>
                                    handleDecrementQuantity(tp.id, tmde.id),
                                  icon: faTrashAlt,
                                  className: "destructive",
                                });
                              }

                              menuItems.push({
                                label: `Delete All "${tmde.name}"`,
                                action: () => handleDeleteTmde(tp.id, tmde.id),
                                icon: faTrashAlt,
                                className: "destructive",
                              });

                              setContextMenu({
                                x: e.pageX,
                                y: e.pageY,
                                items: menuItems,
                              });
                            }}
                          />
                        ));
                      })}
                      <AddTmdeSeal onClick={() => handleAddTmdeClick(tp)} />
                    </div>

                    <div className="metric-pods-row-condensed">
                      {tp.riskMetrics ? (
                        <>
                          <div
                            className={`metric-pod ${getPfaClass(
                              tp.riskMetrics.pfa
                            )}`}
                          >
                            <span className="metric-pod-label">PFA</span>
                            <span className="metric-pod-value">
                              {tp.riskMetrics.pfa.toFixed(4)} %
                            </span>
                          </div>
                          <div className="metric-pod pfr">
                            <span className="metric-pod-label">PFR</span>
                            <span className="metric-pod-value">
                              {tp.riskMetrics.pfr.toFixed(4)} %
                            </span>
                          </div>
                          <div className="metric-pod tur">
                            <span className="metric-pod-label">TUR</span>
                            <span className="metric-pod-value">
                              {tp.riskMetrics.tur.toFixed(2)} : 1
                            </span>
                          </div>
                          <div className="metric-pod tar">
                            <span className="metric-pod-label">TAR</span>
                            <span className="metric-pod-value">
                              {tp.riskMetrics.tar.toFixed(2)} : 1
                            </span>
                          </div>
                        </>
                      ) : (
                        <span className="risk-not-calculated">
                          Risk metrics not calculated for this point.
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div
                  className="placeholder-content"
                  style={{ minHeight: "200px" }}
                >
                  <p>
                    This session has no measurement points. <br /> Add
                    measurement points from the main screen to manage their
                    TMDEs here.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeSection === "requirements" && (
            <div className="details-grid">
              <div className="form-section">
                <label>Uncertainty Confidence (%)</label>
                <input
                  type="number"
                  name="uncertaintyConfidence"
                  value={formData.uncReq?.uncertaintyConfidence || ""}
                  onChange={handleReqChange}
                  placeholder="e.g., 95"
                  min="0"
                  max="99.999"
                  step="0.01"
                />
              </div>
              <div className="form-section">
                <label>Meas Rel Target (%)</label>
                <input
                  type="number"
                  step="1"
                  max="100"
                  min="0"
                  name="reliability"
                  placeholder="e.g., 85"
                  value={formData.uncReq?.reliability || ""}
                  onChange={handleReqChange}
                />
              </div>
              <div className="form-section">
                <label>Calibration Interval</label>
                <input
                  type="number"
                  name="calInt"
                  value={formData.uncReq?.calInt || ""}
                  onChange={handleReqChange}
                  placeholder="e.g., 12"
                  min="1"
                  max="1000"
                  step="1"
                />
              </div>
              <div className="form-section">
                <label>Meas Rel Calc/Assumed (%)</label>
                <input
                  type="number"
                  name="measRelCalcAssumed"
                  value={formData.uncReq?.measRelCalcAssumed || ""}
                  onChange={handleReqChange}
                  placeholder="e.g., 85"
                  min="1"
                  max="99.999"
                  step="0.01"
                />
              </div>
              <div className="form-section">
                <label>TUR Needed For Assumed Meas Rel</label>
                <input
                  type="number"
                  name="neededTUR"
                  value={formData.uncReq?.neededTUR || ""}
                  onChange={handleReqChange}
                  placeholder="e.g., 4"
                  min="1"
                  max="100"
                  step="1"
                />
              </div>
              <div className="form-section">
                <label>PFA Required (%)</label>
                <input
                  type="number"
                  name="reqPFA"
                  value={formData.uncReq?.reqPFA || ""}
                  onChange={handleReqChange}
                  placeholder="e.g., 2"
                  min="1"
                  max="99.999"
                  step="0.01"
                />
              </div>
              {/* <div className="form-section">
                <label>Default Guard Band Multiplier</label>
                <input
                  type="number"
                  step="0.01"
                  max="1"
                  min="0"
                  name="guardBandMultiplier"
                  value={formData.uncReq?.guardBandMultiplier || ""}
                  onChange={handleReqChange}
                />
              </div> */}
            </div>
          )}

          <div
            className="modal-actions"
            style={{
              justifyContent: "flex-end",
              alignItems: "center",
              marginTop: "auto",
              paddingTop: "20px",
            }}
          >
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                className="modal-icon-button primary"
                onClick={handleSave}
                title="Save Changes"
              >
                <FontAwesomeIcon icon={faCheck} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditSessionModal;