import React, { useState, useEffect } from 'react';

const EditSessionModal = ({ isOpen, onClose, sessionData, onSave, onSaveToFile }) => {
    const [formData, setFormData] = useState({});

    useEffect(() => {
        if (sessionData) {
            setFormData({ ...sessionData });
        }
    }, [sessionData]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        const updatedFormData = { ...formData, [name]: value };

        if (name === 'equipmentName' && value) {
            updatedFormData.name = `MUA: ${value}`;
        } else if (name === 'equipmentName' && !value) {
            updatedFormData.name = 'New Session';
        }

        setFormData(updatedFormData);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{maxWidth: '800px'}}>
                <button onClick={onClose} className="modal-close-button">&times;</button>
                <h3>Edit Session Information</h3>
                
                <div className="config-grid" style={{borderTop: 'none', paddingTop: '0'}}>
                    <div className='form-section'>
                        <label>Equipment Name</label>
                        <input type="text" name="equipmentName" value={formData.equipmentName || ''} onChange={handleChange} placeholder="e.g., Fluke 8588A" />
                        
                        <label>Analyst</label>
                        <input type="text" name="analyst" value={formData.analyst || ''} onChange={handleChange} placeholder="Your Name"/>
                        
                        <label>Organization</label>
                        <input type="text" name="organization" value={formData.organization || ''} onChange={handleChange} placeholder="Your Organization"/>
                    </div>
                    <div className='form-section'>
                        <label>Document</label>
                        <input type="text" name="document" value={formData.document || ''} onChange={handleChange} placeholder="Document ID or Name" />
                        
                        <label>Document Date</label>
                        <input type="date" name="documentDate" value={formData.documentDate || ''} onChange={handleChange} />
                    </div>
                </div>

                <div className='form-section'>
                    <label>Analysis Notes</label>
                    <textarea 
                        name="notes" 
                        value={formData.notes || ''} 
                        onChange={handleChange} 
                        rows="6"
                        placeholder="Record analysis notes here..."
                    ></textarea>
                </div>

                <div className="modal-actions" style={{justifyContent: 'space-between'}}>
                    <button className="button button-secondary" onClick={onSaveToFile}>
                        Save Session to File (.json)
                    </button>
                    <div>
                        <button className="button button-secondary" onClick={onClose}>Cancel</button>
                        <button className="button" onClick={() => onSave(formData)}>Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditSessionModal;