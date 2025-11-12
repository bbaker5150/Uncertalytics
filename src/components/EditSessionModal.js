import React, { useState, useLayoutEffect } from 'react';
import AddTmdeModal from './AddTmdeModal';
import ToleranceForm from './ToleranceForm';
import ContextMenu from './ContextMenu';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes, faSave, faPlus, faTrashAlt, faPencilAlt } from '@fortawesome/free-solid-svg-icons';
import { NotificationModal } from '../App';

const TmdeSealDisplay = ({ tmde, onEditClick, onContextMenu, instanceIndex, totalQuantity }) => (
    <div className="tmde-seal-clickable-container" onContextMenu={onContextMenu}>
        <div className="tmde-seal-clickable" onClick={onEditClick} title={`Click to edit ${tmde.name}`}>
            <div className="uut-seal-content">
                <span className="seal-label">TMDE</span>
                <h4 className="seal-title">{tmde.name}</h4>
                {totalQuantity > 1 && (
                    <span className="seal-label" style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>
                        (Device {instanceIndex + 1} of {totalQuantity})
                    </span>
                )}
            </div>
        </div>
    </div>
);

const AddTmdeSeal = ({ onClick }) => (
    <div className="add-tmde-card-small" onClick={onClick}>
        <div className="add-tmde-button-small">
            <FontAwesomeIcon icon={faPlus} />
            <span>Add TMDE</span>
        </div>
    </div>
);


const EditSessionModal = ({ isOpen, onClose, sessionData, onSave, onSaveToFile, initialSection, initialTmdeToEdit }) => {
    const [formData, setFormData] = useState({});
    const [activeSection, setActiveSection] = useState('details');
    const [editingTmde, setEditingTmde] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [notification, setNotification] = useState(null);

    const handleEditTmdeClick = (tmde, testPoint) => {
        setEditingTmde({ tmde, testPoint });
    };
    
    useLayoutEffect(() => {
    if (isOpen && sessionData) {
        setFormData({ ...sessionData });
        setActiveSection(initialSection || 'details');

        if (initialTmdeToEdit) {
            handleEditTmdeClick(initialTmdeToEdit.tmde, initialTmdeToEdit.testPoint);
        } else {
            // Explicitly clear the nested modal state when not needed
            setEditingTmde(null);
        }
    }
}, [isOpen, sessionData, initialSection, initialTmdeToEdit]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        const updatedFormData = { ...formData, [name]: value };

        if (name === 'uutDescription' && value) {
            updatedFormData.name = `MUA: ${value}`;
        } else if (name === 'uutDescription' && !value) {
            updatedFormData.name = 'New Session';
        }
        setFormData(updatedFormData);
    };
    
    const handleReqChange = (e) => {
        const { name, value } = e.target;

        setFormData((formData) => ({
        ...formData,
        uncReq: {
            ...formData.uncReq,
            [name]: value
        }
        }));

    };

    const handleToleranceChange = (updater) => {
        setFormData(prev => {
            const currentTolerance = prev.uutTolerance || {};
            const newTolerance = typeof updater === 'function'
                ? updater(currentTolerance)
                : updater;
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
            guardBandMultiplier: "Default Guard Band Multiplier"
        };

        for (const key in formData.uncReq) {
            if (formData.uncReq[key] === ""){
                setNotification({
                title: uncReqLabel[key],
                message: "Enter valid " + uncReqLabel[key] + ".",
            });
            break;
            } else {
                onSave(formData);
            }
        }
    };
    
    const handleAddTmdeClick = (testPoint) => {
        setEditingTmde({ tmde: null, testPoint });
    };

    const handleSaveTmde = (savedTmde) => {
    const updatedTestPoints = formData.testPoints.map(tp => {
        if (tp.id === editingTmde.testPoint.id) {
            const tolerances = tp.tmdeTolerances || [];
            const existingIndex = tolerances.findIndex(t => t.id === savedTmde.id);
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

    if (initialTmdeToEdit) {
        onSave(newFormData);
    } else {
        setFormData(newFormData);
        setEditingTmde(null);
    }
};

    // This function deletes the *entire* TMDE definition
    const handleDeleteTmde = (testPointId, tmdeId) => {
        setFormData(prev => {
            const updatedTestPoints = prev.testPoints.map(tp => {
                if (tp.id === testPointId) {
                    const newTolerances = tp.tmdeTolerances.filter(t => t.id !== tmdeId);
                    return { ...tp, tmdeTolerances: newTolerances };
                }
                return tp;
            });
            return { ...prev, testPoints: updatedTestPoints };
        });
    };

    // This function decrements the quantity or deletes if quantity becomes 0
    const handleDecrementQuantity = (testPointId, tmdeId) => {
      setFormData(prev => {
          const updatedTestPoints = prev.testPoints.map(tp => {
              if (tp.id === testPointId) {
                  const newTolerances = tp.tmdeTolerances.map(t => {
                    if (t.id === tmdeId) {
                      const newQuantity = (t.quantity || 1) - 1;
                      return { ...t, quantity: newQuantity };
                    }
                    return t;
                  }).filter(t => t.quantity > 0); // Filter out if quantity becomes 0

                  return { ...tp, tmdeTolerances: newTolerances };
              }
              return tp;
          });
          return { ...prev, testPoints: updatedTestPoints };
      });
    };

    return (
        <div className="modal-overlay">
            {notification && <NotificationModal isOpen={!!notification} onClose={() => setNotification(null)} title={notification.title} message={notification.message} />}
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
            <div className={`modal-content edit-session-modal ${editingTmde ? 'modal-content-hidden' : ''}`}>
                <button onClick={onClose} className="modal-close-button">&times;</button>
                
                <div className="modal-main-content">
                    <h3>Session Settings</h3>
                    <div className="modal-tabs">
                        <button
                            className={`modal-tab ${activeSection === 'details' ? 'active' : ''}`}
                            onClick={() => setActiveSection('details')}>
                            Session Details
                        </button>
                        <button
                            className={`modal-tab ${activeSection === 'uut' ? 'active' : ''}`}
                            onClick={() => setActiveSection('uut')}>
                            UUT Specification
                        </button>
                         <button
                            className={`modal-tab ${activeSection === 'tmdes' ? 'active' : ''}`}
                            onClick={() => setActiveSection('tmdes')}>
                            TMDE Specifications
                        </button>
                        <button
                            className={`modal-tab ${activeSection === 'requirements' ? 'active' : ''}`}
                            onClick={() => setActiveSection('requirements')}>
                            Uncertainty Requirements
                        </button>
                    </div>

                    {activeSection === 'details' && (
                        <div className="details-grid">
                            <div className="form-section">
                                <label>Analyst</label>
                                <input type="text" name="analyst" value={formData.analyst || ''} onChange={handleChange} placeholder="Your Name"/>
                            </div>
                            <div className="form-section">
                                <label>Organization</label>
                                <input type="text" name="organization" value={formData.organization || ''} onChange={handleChange} placeholder="Your Organization"/>
                            </div>
                            <div className="form-section">
                                <label>Document</label>
                                <input type="text" name="document" value={formData.document || ''} onChange={handleChange} placeholder="Document ID or Name" />
                            </div>
                            <div className="form-section">
                                <label>Document Date</label>
                                <input type="date" name="documentDate" value={formData.documentDate || ''} onChange={handleChange} />
                            </div>
                            <div className="form-section full-span">
                                <label>Analysis Notes</label>
                                <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows="8" placeholder="Record analysis notes here..."></textarea>
                            </div>
                        </div>
                    )}

                    {activeSection === 'uut' && (
                        <>
                            <div className='form-section'>
                                <label>UUT Name / Model</label>
                                <input type="text" name="uutDescription" value={formData.uutDescription || ''} onChange={handleChange} placeholder="e.g., Fluke 8588A" />
                            </div>
                            <ToleranceForm 
                                tolerance={formData.uutTolerance || {}}
                                setTolerance={handleToleranceChange}
                                isUUT={true}
                                referencePoint={null}
                            />
                        </>
                    )}

                    {activeSection === 'tmdes' && (
                         <div className="tmde-management-container">
                            {formData.testPoints && formData.testPoints.length > 0 ? (
                                formData.testPoints.map(tp => (
                                    <div className="tmde-test-point-group" key={tp.id}>
                                        <div className="tmde-seals-grid">
                                            {(tp.tmdeTolerances || []).flatMap((tmde) => {
                                                const quantity = tmde.quantity || 1;
                                                return Array.from({ length: quantity }, (_, i) => (
                                                    <TmdeSealDisplay
                                                        key={`${tmde.id}-${i}`}
                                                        tmde={tmde}
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
                                                                }
                                                            ];

                                                            if (quantity > 1) {
                                                              menuItems.push({
                                                                label: `Delete This Instance`,
                                                                action: () => handleDecrementQuantity(tp.id, tmde.id),
                                                                icon: faTrashAlt,
                                                                className: 'destructive'
                                                              });
                                                            }

                                                            menuItems.push({
                                                                label: `Delete All "${tmde.name}"`,
                                                                action: () => handleDeleteTmde(tp.id, tmde.id),
                                                                icon: faTrashAlt,
                                                                className: 'destructive'
                                                            });

                                                            setContextMenu({
                                                                x: e.pageX,
                                                                y: e.pageY,
                                                                items: menuItems
                                                            });
                                                        }}
                                                    />
                                                ));
                                            })}
                                            <AddTmdeSeal onClick={() => handleAddTmdeClick(tp)} />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="placeholder-content" style={{minHeight: '200px'}}>
                                    <p>This session has no measurement points. <br/> Add measurement points from the main screen to manage their TMDEs here.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeSection === 'requirements' && (
                        <div className="details-grid">
                            <div className="form-section">
                                <label>Uncertainty Confidence (%)</label>
                                <input 
                                    type="number" 
                                    name="uncertaintyConfidence" 
                                    value={formData.uncReq.uncertaintyConfidence} 
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
                                  value={formData.uncReq.reliability}
                                  onChange={handleReqChange}
                                />
                            </div>
                            <div className="form-section">
                                <label>Calibration Interval</label>
                                <input 
                                    type="number" 
                                    name="calInt" 
                                    value={formData.uncReq.calInt} 
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
                                    value={formData.uncReq.measRelCalcAssumed} 
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
                                    value={formData.uncReq.neededTUR} 
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
                                    value={formData.uncReq.reqPFA} 
                                    onChange={handleReqChange} 
                                    placeholder="e.g., 2"
                                    min="1"
                                    max="99.999"
                                    step="0.01"
                                />
                            </div>
                             <div className="form-section">
                                <label>Default Guard Band Multiplier</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  max="1"
                                  min="0"
                                  name="guardBandMultiplier"
                                  value={formData.uncReq.guardBandMultiplier}
                                  onChange={handleReqChange}
                                />
                            </div>
                        </div>
                    )}
                    
                    <div className="modal-actions" style={{justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '20px'}}>
                        <button className="modal-icon-button secondary" onClick={onSaveToFile} title="Save Session to File (.pdf)">
                           <FontAwesomeIcon icon={faSave} />
                        </button>
                        
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="modal-icon-button secondary" onClick={onClose} title="Cancel">
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
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