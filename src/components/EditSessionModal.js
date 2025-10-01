import React, { useState, useEffect } from 'react';
import ToleranceForm from './ToleranceForm';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes, faSave } from '@fortawesome/free-solid-svg-icons';

const EditSessionModal = ({ isOpen, onClose, sessionData, onSave, onSaveToFile }) => {
    const [formData, setFormData] = useState({});
    const [activeSection, setActiveSection] = useState('details');

    useEffect(() => {
        if (isOpen && sessionData) {
            setFormData({ ...sessionData });
            setActiveSection('details'); // Reset to the first section on open
        }
    }, [isOpen, sessionData]);

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

    return (
        <div className="modal-overlay">
            <div className="modal-content edit-session-modal">
                <button onClick={onClose} className="modal-close-button">&times;</button>
                
                {/* --- Side Navigation Panel --- */}
                <div className="modal-nav">
                    <h3>Session Settings</h3>
                    <button 
                        className={`modal-nav-button ${activeSection === 'details' ? 'active' : ''}`} 
                        onClick={() => setActiveSection('details')}>
                        Session Details
                    </button>
                    <button 
                        className={`modal-nav-button ${activeSection === 'uut' ? 'active' : ''}`} 
                        onClick={() => setActiveSection('uut')}>
                        UUT Specification
                    </button>
                </div>

                {/* --- Main Content Panel --- */}
                <div className="modal-main-content">
                    {activeSection === 'details' && (
                        <>
                            <h4>Session Details</h4>
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
                        </>
                    )}

                    {activeSection === 'uut' && (
                        <>
                            <h4>UUT Specification</h4>
                            <div className='form-section'>
                                <label>UUT Name / Model</label>
                                <input type="text" name="uutDescription" value={formData.uutDescription || ''} onChange={handleChange} placeholder="e.g., Fluke 8588A" />
                            </div>
                            <div className='form-section'>
                                <h5 style={{marginBottom: '10px'}}>UUT Tolerance & Resolution</h5>
                                <ToleranceForm 
                                    tolerance={formData.uutTolerance || {}}
                                    setTolerance={handleToleranceChange}
                                    isUUT={true}
                                    referencePoint={null}
                                />
                            </div>
                        </>
                    )}
                    
                    {/* --- Action Bar with Icons (Updated) --- */}
                    <div className="modal-actions" style={{justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '20px'}}>
                        {/* "Save to File" is now an icon button on the left */}
                        <button className="modal-icon-button secondary" onClick={onSaveToFile} title="Save Session to File (.json)">
                           <FontAwesomeIcon icon={faSave} />
                        </button>
                        
                        {/* "Cancel" and "Save" icon buttons are side-by-side on the right */}
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