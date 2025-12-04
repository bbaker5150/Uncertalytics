import React, { useState, useLayoutEffect, useMemo, useEffect } from "react";
import ToleranceForm from "./ToleranceForm";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { v4 as uuidv4 } from "uuid";
import {
  faCheck,
  faPlus,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import NotificationModal from './NotificationModal';

const EditSessionModal = ({
  isOpen,
  onClose,
  sessionData,
  onSave,
  initialSection,
  sessionImageCache, 
  onImageCacheChange,
}) => {
  const [formData, setFormData] = useState({});
  const [activeSection, setActiveSection] = useState("details");
  const [notification, setNotification] = useState(null);
  const [newlyAddedFiles, setNewlyAddedFiles] = useState([]);
  const [imageSrcCache, setImageSrcCache] = useState(new Map());
  const [viewingImageSrc, setViewingImageSrc] = useState(null);

  // Gets the URL for an image
  const getImageSrc = (imageRef) => {
    const src = imageSrcCache.get(imageRef.id);
    return src || null;
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newImageRefs = [];
    const newFileObjects = [];

    for (const file of files) {
      const newId = uuidv4();
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });

      newImageRefs.push({ id: newId, fileName: file.name });
      newFileObjects.push({ id: newId, fileObject: base64 });
    }

    setFormData((prev) => ({
      ...prev,
      noteImages: [...(prev.noteImages || []), ...newImageRefs],
    }));

    setNewlyAddedFiles((prev) => [...prev, ...newFileObjects]);
  };

  const handleRemoveImage = (e, imageIdToRemove) => {
    e.stopPropagation(); 

    setFormData((prev) => ({
      ...prev,
      noteImages: prev.noteImages.filter((img) => img.id !== imageIdToRemove),
    }));

    setNewlyAddedFiles((prev) =>
      prev.filter((img) => img.id !== imageIdToRemove)
    );

    if (sessionImageCache && sessionData && sessionImageCache.has(sessionData.id)) {
        const currentSessionCache = sessionImageCache.get(sessionData.id);
        if (currentSessionCache && currentSessionCache.has(imageIdToRemove)) {
            const newGlobalCache = new Map(sessionImageCache);
            const newSessionCache = new Map(currentSessionCache);
            newSessionCache.delete(imageIdToRemove);
            newGlobalCache.set(sessionData.id, newSessionCache);
            onImageCacheChange(newGlobalCache);
        }
    }
  };

  useEffect(() => {
    const newImageSrcCache = new Map();
    if (sessionImageCache && sessionData && sessionData.id) {
        const currentSessionImages = sessionImageCache.get(sessionData.id);
        if (currentSessionImages instanceof Map) {
            currentSessionImages.forEach((dataURI, imageId) => {
                newImageSrcCache.set(imageId, dataURI);
            });
        }
    }
    newlyAddedFiles.forEach((file) => {
      newImageSrcCache.set(file.id, file.fileObject);
    });
    setImageSrcCache(newImageSrcCache);
  }, [sessionImageCache, newlyAddedFiles, sessionData]);

  useLayoutEffect(() => {
    if (isOpen && sessionData) {
      setFormData({
        ...sessionData,
        uncReq: sessionData.uncReq || {},
      });
      setActiveSection(initialSection || "details");
    }
  }, [isOpen, sessionData, initialSection]);

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
      
      {viewingImageSrc && (
      <div className="image-viewer-overlay" onClick={() => setViewingImageSrc(null)}>
        <button className="image-viewer-close" onClick={() => setViewingImageSrc(null)}>&times;</button>
        <img src={viewingImageSrc} alt="Full-size preview" onClick={(e) => e.stopPropagation()} />
      </div>
    )}

      <div className="modal-content edit-session-modal">
        {/* CHANGED: Swapped FontAwesomeIcon back to &times; for consistency */}
        <button onClick={onClose} className="modal-close-button">
          &times;
        </button>

        <div className="modal-main-content">
          <div className="modal-tabs">
            <button
              className={`modal-tab ${activeSection === "details" ? "active" : ""}`}
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
              className={`modal-tab ${activeSection === "requirements" ? "active" : ""}`}
              onClick={() => setActiveSection("requirements")}
            >
              Uncertainty Requirements
            </button>
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
                        onClick={() => src && setViewingImageSrc(src)}
                        style={{ cursor: src ? 'pointer' : 'default', border: src ? '1px solid #ccc' : '2px dashed red' }}
                        title={src ? `Click to view ${imageRef.fileName}` : 'Image not found in cache'}
                        >
                        {src ? (
                            <img src={src} alt={imageRef.fileName} />
                        ) : (
                            <div style={{color: 'red', fontSize: '10px', padding: '5px', textAlign: 'center'}}>
                                Missing Image Data
                            </div>
                        )}
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
                  <label htmlFor="image-upload-input" className="image-add-button">
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
                hideDistribution={true}
              />
            </>
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
            </div>
          )}

          <div className="modal-actions" style={{ justifyContent: "flex-end", alignItems: "center", marginTop: "auto", paddingTop: "20px" }}>
            <div style={{ display: "flex", gap: "10px" }}>
              <button className="modal-icon-button primary" onClick={handleSave} title="Save Changes">
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