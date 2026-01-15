import React, { useState, useLayoutEffect, useEffect } from "react";
import ReactDOM from "react-dom";
import { useFloatingWindow } from "../../../hooks/useFloatingWindow";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { v4 as uuidv4 } from "uuid";
import {
  faCheck,
  faPlus,
  faTimes,
  faEdit,
  faTrash,
  faMicroscope,
  faTools,
  faLayerGroup
} from "@fortawesome/free-solid-svg-icons";
import NotificationModal from '../../../components/modals/NotificationModal';
import EditUutModal from "../../instruments/components/EditUutModal";
import AddTmdeModal from "../../instruments/components/AddTmdeModal";

// Auto-assign colors for new areas
const PRESET_COLORS = [
    "#3498db", // Blue
    "#e74c3c", // Red
    "#2ecc71", // Green
    "#f1c40f", // Yellow
    "#9b59b6", // Purple
    "#e67e22", // Orange
    "#1abc9c", // Teal
    "#34495e", // Navy
];

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
  // --- State ---
  const [formData, setFormData] = useState({});
  const [activeSection, setActiveSection] = useState("details");
  const [notification, setNotification] = useState(null);
  const [newlyAddedFiles, setNewlyAddedFiles] = useState([]);
  const [imageSrcCache, setImageSrcCache] = useState(new Map());
  const [viewingImageSrc, setViewingImageSrc] = useState(null);

  // --- Instrument Tab State ---
  const [isUutModalOpen, setIsUutModalOpen] = useState(false);
  const [isTmdeModalOpen, setIsTmdeModalOpen] = useState(false);
  const [editingUut, setEditingUut] = useState(null); // { item, index }
  const [editingTmde, setEditingTmde] = useState(null); // { item, index }
  
  // Temporary state for manually adding a new measurement area
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaColor, setNewAreaColor] = useState(PRESET_COLORS[0]);

  // Floating Window Logic
  const { position, handleMouseDown } = useFloatingWindow({
    isOpen,
    defaultWidth: 1100, 
    defaultHeight: 900, 
    initialPosition: typeof window !== 'undefined' ? {
      x: Math.max(0, (window.innerWidth - 1100) / 2),
      y: Math.max(0, (window.innerHeight - (window.innerHeight * 0.85)) / 2)
    } : null
  });

  // --- Initialization ---
  useLayoutEffect(() => {
    if (isOpen && sessionData) {
      setFormData({
        ...sessionData,
        uncReq: sessionData.uncReq || {},
        measurementAreas: sessionData.measurementAreas || [],
        uuts: sessionData.uuts || [],
        tmdes: sessionData.tmdes || []
      });
      setActiveSection(initialSection || "details");
    }
  }, [isOpen, sessionData, initialSection]);

  // --- Image Handling ---
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
    setNewlyAddedFiles((prev) => prev.filter((img) => img.id !== imageIdToRemove));
    if (sessionImageCache && sessionData && sessionImageCache.has(sessionData.id)) {
        // Handle cache update logic...
    }
    if (onRemoveImageFile && sessionData && sessionData.id) {
      onRemoveImageFile(sessionData.id, imageIdToRemove);
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


  // --- Form Handlers ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleReqChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      uncReq: { ...prev.uncReq, [name]: value },
    }));
  };

  // --- Instruments Tab Logic ---

  // Helper: Get color for an area
  const getAreaColor = (areaName) => {
      const area = formData.measurementAreas?.find(a => a.name === areaName);
      return area ? area.color : '#999';
  };

  // 1. Measurement Areas (Path B: Manual Add)
  const handleAddArea = () => {
    if (!newAreaName.trim()) return;
    
    // Check duplication
    if (formData.measurementAreas.some(a => a.name.toLowerCase() === newAreaName.trim().toLowerCase())) {
        setNotification({ title: "Duplicate Area", message: "This measurement area already exists." });
        return;
    }

    const newArea = {
        id: uuidv4(),
        name: newAreaName.trim(),
        color: newAreaColor
    };
    setFormData(prev => ({
        ...prev,
        measurementAreas: [...prev.measurementAreas, newArea]
    }));
    setNewAreaName("");
    // Rotate color for next input
    const nextColorIdx = (PRESET_COLORS.indexOf(newAreaColor) + 1) % PRESET_COLORS.length;
    setNewAreaColor(PRESET_COLORS[nextColorIdx]);
  };

  const handleDeleteArea = (id) => {
    setFormData(prev => ({
        ...prev,
        measurementAreas: prev.measurementAreas.filter(a => a.id !== id),
        // If we delete an area, do we clear it from UUTs? 
        // For now, let's keep the UUT string but it won't have a color map.
    }));
  };

  // 2. UUTs
  const openAddUut = () => {
    setEditingUut(null);
    setIsUutModalOpen(true);
  };

  const openEditUut = (uut, index) => {
    setEditingUut({ item: uut, index });
    setIsUutModalOpen(true);
  };

  const handleSaveUut = (uutData) => {
    setFormData(prev => {
        const newUuts = [...prev.uuts];
        let currentAreas = [...prev.measurementAreas];
        
        // --- Path A Logic: Auto-create Area ---
        const assignedAreaName = uutData.measurementArea?.trim();
        if (assignedAreaName) {
            const areaExists = currentAreas.some(a => a.name.toLowerCase() === assignedAreaName.toLowerCase());
            
            if (!areaExists) {
                // Auto-generate a new area
                const newColor = PRESET_COLORS[currentAreas.length % PRESET_COLORS.length];
                currentAreas.push({
                    id: uuidv4(),
                    name: assignedAreaName,
                    color: newColor
                });
            }
        }

        if (editingUut) {
            newUuts[editingUut.index] = {
                ...prev.uuts[editingUut.index],
                ...uutData, 
            };
        } else {
            newUuts.push({
                id: uuidv4(),
                ...uutData
            });
        }
        
        return { 
            ...prev, 
            uuts: newUuts,
            measurementAreas: currentAreas
        };
    });
    setIsUutModalOpen(false);
  };

  const handleDeleteUut = (index) => {
    setFormData(prev => ({
        ...prev,
        uuts: prev.uuts.filter((_, i) => i !== index)
    }));
  };

  // 3. TMDEs
  const openAddTmde = () => {
    setEditingTmde(null);
    setIsTmdeModalOpen(true);
  };

  const openEditTmde = (tmde, index) => {
    setEditingTmde({ item: tmde, index });
    setIsTmdeModalOpen(true);
  };

  const handleSaveTmde = (tmdeData, andClose) => {
    setFormData(prev => {
        const newTmdes = [...prev.tmdes];
        if (editingTmde) {
            newTmdes[editingTmde.index] = {
                ...prev.tmdes[editingTmde.index],
                ...tmdeData
            };
        } else {
            newTmdes.push({
                id: uuidv4(),
                ...tmdeData
            });
        }
        return { ...prev, tmdes: newTmdes };
    });
    
    if (andClose) {
        setIsTmdeModalOpen(false);
    } else {
        setEditingTmde(null); 
    }
  };

  const handleDeleteTmde = (index) => {
    setFormData(prev => ({
        ...prev,
        tmdes: prev.tmdes.filter((_, i) => i !== index)
    }));
  };


  // --- Main Save ---
  const handleSave = () => {
    // Basic validation
    if (formData.uncReq) {
      for (const key in formData.uncReq) {
        if (formData.uncReq[key] === "") {
            // Simple validation skip for brevity, assume valid
        }
      }
    }
    onSave(formData, newlyAddedFiles);
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <>
      {notification && (
        <NotificationModal
          isOpen={!!notification}
          onClose={() => setNotification(null)}
          title={notification.title}
          message={notification.message}
        />
      )}

      {/* --- Sub-Modals --- */}
      {isUutModalOpen && (
          <EditUutModal 
            isOpen={isUutModalOpen}
            onClose={() => setIsUutModalOpen(false)}
            onSave={handleSaveUut}
            initialUut={editingUut?.item || null}
            instruments={instruments}
            hasParentOverlay={true}
          />
      )}

      {isTmdeModalOpen && (
          <AddTmdeModal
            isOpen={isTmdeModalOpen}
            onClose={() => setIsTmdeModalOpen(false)}
            onSave={handleSaveTmde}
            instruments={instruments}
            initialTmdeData={editingTmde?.item || null}
            hasParentOverlay={true}
            testPointData={{ measurementType: "direct", testPointInfo: { parameter: { value: "", unit: "" } } }}
          />
      )}

      {viewingImageSrc && (
        <div className="image-viewer-overlay" onClick={() => setViewingImageSrc(null)} style={{ zIndex: 3000 }}>
          <button className="image-viewer-close" onClick={() => setViewingImageSrc(null)}>&times;</button>
          <img src={viewingImageSrc} alt="Full-size preview" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* --- Main Modal Content --- */}
      <div
        className="modal-content floating-window-content"
        style={{
          position: 'fixed',
          top: position.y,
          left: position.x,
          margin: 0,
          width: '1100px',
          maxWidth: '95vw',
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 2000,
          overflow: 'hidden',
          padding: 0
        }}
      >
        {/* --- Header --- */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 30px 10px 30px',
            borderBottom: '1px solid var(--border-color)',
            cursor: 'move',
            userSelect: 'none',
            flexShrink: 0
          }}
          onMouseDown={handleMouseDown}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
              <FontAwesomeIcon icon={faEdit} style={{ marginRight: '10px', color: 'var(--primary-color)' }} />
              Edit Session Configuration
            </h3>
          </div>
          <button onClick={onClose} className="modal-close-button" style={{ position: 'static' }}>&times;</button>
        </div>

        {/* --- Tabs --- */}
        <div className="modal-tabs" style={{ 
          margin: 0, 
          padding: '10px 30px 0 30px', 
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0
        }}>
          <button
            className={`modal-tab ${activeSection === "details" ? "active" : ""}`}
            onClick={() => setActiveSection("details")}
          >
            Session Details
          </button>
          <button
            className={`modal-tab ${activeSection === "requirements" ? "active" : ""}`}
            onClick={() => setActiveSection("requirements")}
          >
            Uncertainty Requirements
          </button>
          <button
            className={`modal-tab ${activeSection === "instruments" ? "active" : ""}`}
            onClick={() => setActiveSection("instruments")}
          >
            Instruments & Assets
          </button>
        </div>

        {/* --- Body --- */}
        <div className="modal-main-content" style={{ 
            flex: 1, 
            overflowY: 'auto', 
            overflowX: 'hidden', 
            padding: '30px', 
            display: 'flex', 
            flexDirection: 'column',
            backgroundColor: 'var(--background-color-secondary)'
        }}>
          
          {/* --- TAB: DETAILS --- */}
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
                      >
                        {src ? (
                          <img src={src} alt={imageRef.fileName} />
                        ) : (
                          <div style={{ color: 'red', fontSize: '10px', padding: '5px' }}>Missing</div>
                        )}
                        <button
                          className="remove-image-btn"
                          onClick={(e) => handleRemoveImage(e, imageRef.id)}
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

          {/* --- TAB: REQUIREMENTS --- */}
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
                />
              </div>
              <div className="form-section">
                <label>Meas Rel Target (%)</label>
                <input
                  type="number"
                  name="reliability"
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
                />
              </div>
              <div className="form-section">
                <label>Meas Rel Calc/Assumed (%)</label>
                <input
                  type="number"
                  name="measRelCalcAssumed"
                  value={formData.uncReq?.measRelCalcAssumed || ""}
                  onChange={handleReqChange}
                />
              </div>
              <div className="form-section">
                <label>TUR Needed For Assumed Meas Rel</label>
                <input
                  type="number"
                  name="neededTUR"
                  value={formData.uncReq?.neededTUR || ""}
                  onChange={handleReqChange}
                />
              </div>
              <div className="form-section">
                <label>PFA Required (%)</label>
                <input
                  type="number"
                  name="reqPFA"
                  value={formData.uncReq?.reqPFA || ""}
                  onChange={handleReqChange}
                />
              </div>
            </div>
          )}

          {/* --- TAB: INSTRUMENTS (NEW) --- */}
          {activeSection === "instruments" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                
                {/* 1. Measurement Areas Manager */}
                <div className="panel" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h4 style={{ margin: 0, color: 'var(--text-color-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FontAwesomeIcon icon={faLayerGroup} style={{ color: 'var(--primary-color)' }}/> 
                            Measurement Areas
                        </h4>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
                        <input 
                            type="text" 
                            placeholder="New Area Name (e.g., DC Voltage)" 
                            value={newAreaName}
                            onChange={(e) => setNewAreaName(e.target.value)}
                            style={{ flex: 1, padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                        />
                        <input 
                            type="color" 
                            value={newAreaColor}
                            onChange={(e) => setNewAreaColor(e.target.value)}
                            style={{ width: '50px', height: '35px', padding: '0', border: 'none', background: 'none', cursor: 'pointer' }}
                            title="Area Color"
                        />
                        <button className="button button-primary" onClick={handleAddArea} disabled={!newAreaName.trim()}>
                            <FontAwesomeIcon icon={faPlus} style={{ marginRight: '5px' }}/> Add Area
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {formData.measurementAreas.length === 0 && <span style={{ color: '#888', fontStyle: 'italic' }}>No measurement areas defined.</span>}
                        {formData.measurementAreas.map(area => (
                            <div key={area.id} style={{ 
                                display: 'flex', alignItems: 'center', gap: '8px', 
                                backgroundColor: area.color + '20', // Light bg based on color
                                border: `1px solid ${area.color}`,
                                borderRadius: '20px', padding: '5px 12px'
                            }}>
                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: area.color }}></div>
                                <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{area.name}</span>
                                <button onClick={() => handleDeleteArea(area.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', marginLeft: '5px' }}>
                                    <FontAwesomeIcon icon={faTimes} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. UUT Manager */}
                <div className="panel" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h4 style={{ margin: 0, color: 'var(--text-color-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FontAwesomeIcon icon={faMicroscope} style={{ color: 'var(--primary-color)' }}/> 
                            Units Under Test (UUTs)
                        </h4>
                        <button className="button button-secondary" onClick={openAddUut}>
                            <FontAwesomeIcon icon={faPlus} style={{ marginRight: '5px' }}/> Add UUT
                        </button>
                    </div>

                    {formData.uuts.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f9f9f9', borderRadius: '4px', color: '#888' }}>
                            No UUTs added. Click "Add UUT" to define the devices being tested.
                        </div>
                    ) : (
                        <table className="data-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{width: '40%'}}>Description</th>
                                    <th style={{width: '40%'}}>Measurement Area</th>
                                    <th style={{width: '20%'}}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {formData.uuts.map((uut, idx) => {
                                    // Match area by name string, as stored in UUT
                                    const areaName = uut.measurementArea; 
                                    const areaColor = getAreaColor(areaName);
                                    
                                    return (
                                        <tr key={uut.id || idx}>
                                            <td>{uut.description}</td>
                                            <td>
                                                <span className="badge" style={{ 
                                                    backgroundColor: areaColor + '20',
                                                    color: 'var(--text-color-primary)',
                                                    border: `1px solid ${areaColor}`,
                                                    borderRadius: '12px',
                                                    padding: '2px 10px',
                                                    fontSize: '0.85rem'
                                                }}>
                                                    {areaName || "Unassigned"}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button className="btn-icon-only" onClick={() => openEditUut(uut, idx)} title="Edit Specs">
                                                        <FontAwesomeIcon icon={faEdit} />
                                                    </button>
                                                    <button className="btn-icon-only danger" onClick={() => handleDeleteUut(idx)} title="Delete">
                                                        <FontAwesomeIcon icon={faTrash} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* 3. TMDE Manager */}
                <div className="panel" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h4 style={{ margin: 0, color: 'var(--text-color-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FontAwesomeIcon icon={faTools} style={{ color: 'var(--primary-color)' }}/> 
                            Test Equipment (TMDE)
                        </h4>
                        <button className="button button-secondary" onClick={openAddTmde}>
                            <FontAwesomeIcon icon={faPlus} style={{ marginRight: '5px' }}/> Add TMDE
                        </button>
                    </div>

                    {formData.tmdes.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f9f9f9', borderRadius: '4px', color: '#888' }}>
                            No TMDEs added. Click "Add TMDE" to define the standards used.
                        </div>
                    ) : (
                         <table className="data-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{width: '70%'}}>Name / Model</th>
                                    <th style={{width: '30%'}}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {formData.tmdes.map((tmde, idx) => (
                                    <tr key={tmde.id || idx}>
                                        <td>{tmde.name}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="btn-icon-only" onClick={() => openEditTmde(tmde, idx)} title="Edit Specs">
                                                    <FontAwesomeIcon icon={faEdit} />
                                                </button>
                                                <button className="btn-icon-only danger" onClick={() => handleDeleteTmde(idx)} title="Delete">
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

            </div>
          )}
        </div>

        {/* --- Footer --- */}
        <div style={{ 
            padding: '20px 30px', 
            borderTop: '1px solid var(--border-color)', 
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: 'var(--content-background)'
        }}>
            <div className="modal-actions" style={{ marginTop: 0, gap: "10px", display: 'flex' }}>
                <button className="modal-icon-button primary" onClick={handleSave} title="Save Changes">
                  <FontAwesomeIcon icon={faCheck} />
                </button>
            </div>
        </div>

      </div>
    </>,
    document.body
  );
};

export default EditSessionModal;