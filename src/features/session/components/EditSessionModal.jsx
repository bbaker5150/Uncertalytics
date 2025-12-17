import React, { useState, useLayoutEffect, useMemo, useEffect } from "react";
import ToleranceForm from "../../../components/common/ToleranceForm";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { v4 as uuidv4 } from "uuid";
import {
  faCheck,
  faPlus,
  faTimes,
  faBookOpen,
  faGripHorizontal,
  faEdit
} from "@fortawesome/free-solid-svg-icons";
import NotificationModal from '../../../components/modals/NotificationModal';
import InstrumentLookupModal from "../../instruments/components/InstrumentLookupModal";
import { findInstrumentTolerance } from "../../../utils/uncertaintyMath";

const EditSessionModal = ({
  isOpen,
  onClose,
  sessionData,
  onSave,
  onRemoveImageFile,
  initialSection,
  sessionImageCache, 
  onImageCacheChange,
  instruments = []
}) => {
  const [formData, setFormData] = useState({});
  const [activeSection, setActiveSection] = useState("details");
  const [notification, setNotification] = useState(null);
  const [newlyAddedFiles, setNewlyAddedFiles] = useState([]);
  const [imageSrcCache, setImageSrcCache] = useState(new Map());
  const [viewingImageSrc, setViewingImageSrc] = useState(null);

  // --- Lookup & Range Prompt State ---
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [pendingInstrument, setPendingInstrument] = useState(null); 
  const [showRangePrompt, setShowRangePrompt] = useState(false);
  const [rangePromptData, setRangePromptData] = useState({ value: "", unit: "" });

  // --- Floating Window State ---
  const [position, setPosition] = useState(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    return { 
        x: Math.max(0, (window.innerWidth - 1000) / 2), 
        y: Math.max(0, (window.innerHeight - 800) / 2) 
    };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
            });
        }
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);


  // Gets the URL/Base64 for an image
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

    // 1. Remove from UI state
    setFormData((prev) => ({
      ...prev,
      noteImages: prev.noteImages.filter((img) => img.id !== imageIdToRemove),
    }));

    setNewlyAddedFiles((prev) =>
      prev.filter((img) => img.id !== imageIdToRemove)
    );

    // 2. Remove from Local Cache
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

    // 3. Trigger Disk Deletion (Backend)
    if (onRemoveImageFile && sessionData && sessionData.id) {
        onRemoveImageFile(sessionData.id, imageIdToRemove);
    }
  };

  // Sync cache when session changes
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
    // Also include newly added (unsaved) images
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

  // --- Instrument Library Logic ---

  const handleInstrumentSelect = (instrument) => {
    // 1. Set the Name immediately
    setFormData(prev => ({
        ...prev,
        uutDescription: `${instrument.manufacturer} ${instrument.model} ${instrument.description}`
    }));
    
    // 2. Ask for a point to resolve tolerance
    setPendingInstrument(instrument);
    setRangePromptData({ value: "", unit: instrument.functions[0]?.unit || "V" });
    setShowRangePrompt(true);
  };

  const confirmRangeSelection = () => {
    if (!pendingInstrument) return;
    
    const matchedData = findInstrumentTolerance(
        pendingInstrument, 
        rangePromptData.value, 
        rangePromptData.unit
    );

    if (matchedData) {
        // 1. Clone Specs
        const specs = JSON.parse(JSON.stringify(matchedData.tolerances || matchedData.tolerance || {}));
        
        // 2. Determine Range Max
        let calculatedRangeMax = matchedData.rangeMax;
        if (!calculatedRangeMax) {
            // Default to the prompt value if rangeMax isn't explicit
            const promptVal = parseFloat(rangePromptData.value);
            if (!isNaN(promptVal)) calculatedRangeMax = promptVal;
        }

        // 3. CLEAN UP DATA (Apply Same Fixes as AddTmdeModal)
        const compKeys = ['reading', 'range', 'floor', 'readings_iv', 'db'];
      
        compKeys.forEach(key => {
            if (specs[key]) {
                // A. Ensure Unit Exists
                if (!specs[key].unit) {
                    if (key === 'reading' || key === 'range') specs[key].unit = '%';
                    else if (key === 'floor' || key === 'readings_iv') specs[key].unit = rangePromptData.unit;
                }
                
                // B. Inject Range Value
                if (key === 'range') {
                    specs[key].value = calculatedRangeMax;
                }

                // C. FIX SIGN ERROR: Force low to be negative
                if (specs[key].high) {
                    const highVal = parseFloat(specs[key].high);
                    if (!isNaN(highVal)) {
                        specs[key].low = String(-Math.abs(highVal));
                    }
                    specs[key].symmetric = true; 
                }
            }
        });

        setFormData(prev => ({
            ...prev,
            uutTolerance: {
                ...specs,
                measuringResolution: matchedData.resolution
            }
        }));
        setShowRangePrompt(false);
        setPendingInstrument(null);
    } else {
        alert("No matching range found for the values entered. Specs were not imported.");
    }
  };


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
    <>
      {notification && (
        <NotificationModal
          isOpen={!!notification}
          onClose={() => setNotification(null)}
          title={notification.title}
          message={notification.message}
        />
      )}
      
      {viewingImageSrc && (
      <div className="image-viewer-overlay" onClick={() => setViewingImageSrc(null)} style={{zIndex: 3000}}>
        <button className="image-viewer-close" onClick={() => setViewingImageSrc(null)}>&times;</button>
        <img src={viewingImageSrc} alt="Full-size preview" onClick={(e) => e.stopPropagation()} />
      </div>
    )}

      {/* --- Lookup Modal --- */}
      <InstrumentLookupModal 
         isOpen={isLookupOpen} 
         onClose={() => setIsLookupOpen(false)} 
         instruments={instruments} 
         onSelect={handleInstrumentSelect}
      />

      {/* --- Range Prompt Modal --- */}
      {showRangePrompt && (
        <div className="modal-overlay" style={{zIndex: 2200, backgroundColor: 'rgba(0,0,0,0.7)'}}>
            <div className="modal-content" style={{maxWidth: '400px'}}>
                <h4 style={{marginTop: 0}}>Set Baseline Tolerance</h4>
                <p style={{fontSize: '0.9rem', color: 'var(--text-color-muted)'}}>
                    Please enter a representative measurement value (e.g., 10 V). 
                    This is required to import the correct range specifications from the library for the Session Defaults.
                </p>
                <div className="input-group" style={{marginBottom: '20px'}}>
                    <input 
                        type="number" 
                        placeholder="Value" 
                        value={rangePromptData.value} 
                        onChange={e => setRangePromptData({...rangePromptData, value: e.target.value})}
                        autoFocus
                    />
                    <input 
                        type="text" 
                        placeholder="Unit" 
                        value={rangePromptData.unit} 
                        onChange={e => setRangePromptData({...rangePromptData, unit: e.target.value})}
                    />
                </div>
                <div className="modal-actions">
                    <button className="button button-secondary" onClick={() => { setShowRangePrompt(false); setPendingInstrument(null); }}>Skip Spec Import</button>
                    <button className="button button-primary" onClick={confirmRangeSelection} disabled={!rangePromptData.value}>Import Specs</button>
                </div>
            </div>
        </div>
      )}

      {/* --- Floating Window Content --- */}
      <div 
        className="modal-content floating-window-content"
        style={{
            position: 'fixed',
            top: position.y,
            left: position.x,
            margin: 0,
            width: '1000px',
            maxWidth: '95vw',
            height: '85vh',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 2000,
            overflow: 'hidden'
        }}
      >
        {/* --- Draggable Header --- */}
        <div 
            style={{
                display:'flex', 
                justifyContent:'space-between', 
                alignItems:'center', 
                paddingBottom: '10px', 
                marginBottom: '10px', 
                borderBottom: '1px solid var(--border-color)',
                cursor: 'move',
                userSelect: 'none'
            }}
            onMouseDown={handleMouseDown}
        >
            <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                <h3 style={{margin:0, fontSize: '1.2rem'}}>
                    <FontAwesomeIcon icon={faEdit} style={{marginRight:'10px', color:'var(--primary-color)'}}/>
                    Edit Session Configuration
                </h3>
            </div>
            <button onClick={onClose} className="modal-close-button" style={{position:'static'}}>&times;</button>
        </div>

        {/* --- Scrollable Content --- */}
        <div className="modal-main-content" style={{flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingRight: '5px'}}>
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
                <div style={{display: 'flex', gap: '10px'}}>
                    <input
                      type="text"
                      name="uutDescription"
                      value={formData.uutDescription || ""}
                      onChange={handleChange}
                      placeholder="e.g., Fluke 8588A"
                      style={{flex: 1}}
                    />
                    {/* Updated Button Style */}
                    <button 
                        className="btn-icon-only" 
                        onClick={() => setIsLookupOpen(true)}
                        title="Import from Instrument Library"
                        style={{ width: '42px', height: '42px', fontSize: '1rem' }}
                    >
                        <FontAwesomeIcon icon={faBookOpen} />
                    </button>
                </div>
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
    </>
  );
};

export default EditSessionModal;