import React, { useState, useEffect } from 'react';

const NotificationModal = ({ isOpen, onClose, title, message }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <button onClick={onClose} className="modal-close-button">&times;</button>
                <h3>{title}</h3>
                <p style={{ textAlign: 'center' }}>{message}</p>
                <div className="modal-actions" style={{ justifyContent: 'center' }}>
                    <button className="button" onClick={onClose}>OK</button>
                </div>
            </div>
        </div>
    );
};

const AddTestPointModal = ({ isOpen, onClose, onSave, initialData }) => {
    const [formData, setFormData] = useState({
        section: '',
        uutDescription: '',
        tmdeDescription: '',
        paramName: 'DC Voltage',
        paramValue: '10',
        paramUnit: 'V',
        qualName: 'Frequency',
        qualValue: '1',
        qualUnit: 'kHz',
    });
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        if (initialData) {
            setFormData({
                section: initialData.section || '',
                uutDescription: initialData.uutDescription || '',
                tmdeDescription: initialData.tmdeDescription || '',
                paramName: initialData.testPointInfo.parameter.name || 'DC Voltage',
                paramValue: initialData.testPointInfo.parameter.value || '10',
                paramUnit: initialData.testPointInfo.parameter.unit || 'V',
                qualName: initialData.testPointInfo.qualifier.name || 'Frequency',
                qualValue: initialData.testPointInfo.qualifier.value || '1',
                qualUnit: initialData.testPointInfo.qualifier.unit || 'kHz',
            });
        } else {
            setFormData({
                section: '', uutDescription: '', tmdeDescription: '', paramName: 'DC Voltage',
                paramValue: '10', paramUnit: 'V', qualName: 'Frequency', qualValue: '1', qualUnit: 'kHz'
            });
        }
    }, [initialData]);


    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        if (!formData.section || !formData.uutDescription || !formData.tmdeDescription || !formData.paramValue) {
             setNotification({ title: 'Missing Information', message: 'Please fill out Section, UUT, TMDE, and Parameter Value fields.' });
            return;
        }

        if (initialData) {
            // It's an edit, package data differently
            onSave({
                id: initialData.id,
                testPointData: {
                    section: formData.section,
                    uutDescription: formData.uutDescription,
                    tmdeDescription: formData.tmdeDescription,
                    testPointInfo: {
                        parameter: { name: formData.paramName, value: formData.paramValue, unit: formData.paramUnit },
                        qualifier: { name: formData.qualName, value: formData.qualValue, unit: formData.qualUnit },
                        uut: formData.uutDescription,
                        tmde: formData.tmdeDescription,
                        section: formData.section
                    }
                }
            });
        } else {
            // It's a new point
            onSave(formData);
        }
    };

    const isEditing = !!initialData;

    return (
        <div className="modal-overlay">
            {notification && <NotificationModal isOpen={!!notification} onClose={() => setNotification(null)} title={notification.title} message={notification.message} />}
            <div className="modal-content" style={{maxWidth: '800px'}}>
                <button onClick={onClose} className="modal-close-button">&times;</button>
                <h3>{isEditing ? 'Edit Measurement Point' : 'Add New Measurement Point'}</h3>
                <div className="config-grid" style={{borderTop: 'none', paddingTop: '0'}}>
                    <div className='form-section'>
                        <label>Section</label>
                        <input type="text" name="section" value={formData.section} onChange={handleChange} placeholder="e.g., 4.1.a" />
                        <label>UUT – Unit Under Test</label>
                        <input type="text" name="uutDescription" value={formData.uutDescription} onChange={handleChange} placeholder="UUT model or ID" />
                        <label>TMDE – Test Equipment</label>
                        <input type="text" name="tmdeDescription" value={formData.tmdeDescription} onChange={handleChange} placeholder="Test Equipment model or ID" />
                    </div>
                    <div className='form-section'>
                        <label>Parameter Name</label>
                        <input type="text" name="paramName" value={formData.paramName} onChange={handleChange} />
                        <label>Measurement Point (Value)</label>
                        <input type="text" name="paramValue" value={formData.paramValue} onChange={handleChange} />
                        <label>Measurement Units</label>
                        <input type="text" name="paramUnit" value={formData.paramUnit} onChange={handleChange} />
                    </div>
                     <div className='form-section'>
                        <label>Qualifier Name</label>
                        <input type="text" name="qualName" value={formData.qualName} onChange={handleChange} />
                        <label>Qualifier Value</label>
                        <input type="text" name="qualValue" value={formData.qualValue} onChange={handleChange} />
                        <label>Qualifier Units</label>
                        <input type="text" name="qualUnit" value={formData.qualUnit} onChange={handleChange} />
                    </div>
                </div>
                 <div className="modal-actions">
                    <button className="button button-secondary" onClick={onClose}>Cancel</button>
                    <button className="button" onClick={handleSave}>Save Changes</button>
                </div>
            </div>
        </div>
    );
};

export default AddTestPointModal;