import React, { useState, useEffect } from 'react';
import AddTmdeModal from './AddTmdeModal';
import ToleranceForm from './ToleranceForm';
import ContextMenu from './ContextMenu';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes, faSave, faPlus, faTrashAlt } from '@fortawesome/free-solid-svg-icons';

const TmdeSealDisplay = ({ tmde, onEditClick, onContextMenu }) => (
    // The onContextMenu handler is now attached here
    <div className="tmde-seal-clickable-container" onContextMenu={onContextMenu}>
        <div className="tmde-seal-clickable" onClick={onEditClick} title={`Click to edit ${tmde.name}`}>
            <div className="uut-seal-content">
                <span className="seal-label">TMDE</span>
                <h4 className="seal-title">{tmde.name}</h4>
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
    const [contextMenu, setContextMenu] = useState(null); // State for context menu

    const handleEditTmdeClick = (tmde, testPoint) => {
        setEditingTmde({ tmde, testPoint });
    };
    
    useEffect(() => {
    if (isOpen && sessionData) {
        setFormData({ ...sessionData });
        setActiveSection(initialSection || 'details');

        if (initialTmdeToEdit) {
            setTimeout(() => {
                handleEditTmdeClick(initialTmdeToEdit.tmde, initialTmdeToEdit.testPoint);
            }, 100);
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
        onSave(formData);
    };
    
    const handleAddTmdeClick = (testPoint) => {
        setEditingTmde({ tmde: null, testPoint });
    };

    const handleSaveTmde = (savedTmde) => {
        setFormData(prev => {
            const updatedTestPoints = prev.testPoints.map(tp => {
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
            return { ...prev, testPoints: updatedTestPoints };
        });
        setEditingTmde(null);
    };

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

    return (
        <div className="modal-overlay">
            <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
            {editingTmde && (
                <AddTmdeModal 
                    isOpen={!!editingTmde}
                    onClose={() => setEditingTmde(null)}
                    onSave={handleSaveTmde}
                    testPointData={editingTmde.testPoint}
                    initialTmdeData={editingTmde.tmde}
                />
            )}
            <div className="modal-content edit-session-modal">
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
                                            {(tp.tmdeTolerances || []).map(tmde => (
                                                <TmdeSealDisplay
                                                    key={tmde.id}
                                                    tmde={tmde}
                                                    onEditClick={() => handleEditTmdeClick(tmde, tp)}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        setContextMenu(null);
                                                        setContextMenu({
                                                            x: e.pageX,
                                                            y: e.pageY,
                                                            items: [
                                                                {
                                                                    label: `Delete "${tmde.name}"`,
                                                                    action: () => handleDeleteTmde(tp.id, tmde.id),
                                                                    icon: faTrashAlt,
                                                                    className: 'destructive'
                                                                }
                                                            ]
                                                        });
                                                    }}
                                                />
                                            ))}
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
                    
                    <div className="modal-actions" style={{justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '20px'}}>
                        <button className="modal-icon-button secondary" onClick={onSaveToFile} title="Save Session to File (.json)">
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