import React, { useState, useMemo, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes, faPlus, faTrashAlt } from '@fortawesome/free-solid-svg-icons';
import { unitSystem } from '../App';
import { NotificationModal } from '../App';

const BatchAddTestPointModal = ({ isOpen, onClose, onSave, hasExistingPoints }) => {
    const getInitialState = () => ({
        section: '',
        paramName: '',
        paramUnit: '',
        qualName: 'Frequency',
        qualValue: '',
        qualUnit: 'kHz',
        values: '', // Textarea for multiple values
        copyTmdes: true,
    });

    const [formData, setFormData] = useState(getInitialState());
    const [hasQualifier, setHasQualifier] = useState(false);
    const [notification, setNotification] = useState(null);
    const availableUnits = useMemo(() => Object.keys(unitSystem.units), []);

    useEffect(() => {
        if (isOpen) {
            setFormData(getInitialState());
            setHasQualifier(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = () => {
        const values = formData.values.split('\n').filter(Boolean);
        if (!formData.section || !formData.paramUnit || values.length === 0) {
            setNotification({ title: 'Missing Information', message: 'Please fill out the Section, Parameter Unit, and at least one Value.' });
            return;
        }

        const qualifierData = hasQualifier ? { name: formData.qualName, value: formData.qualValue, unit: formData.qualUnit } : null;

        onSave({
            ...formData,
            qualifier: qualifierData,
        });
    };

    return (
        <div className="modal-overlay">
            {notification && <NotificationModal isOpen={!!notification} onClose={() => setNotification(null)} title={notification.title} message={notification.message} />}
            <div className="modal-content" style={{ maxWidth: '800px' }}>
                <button onClick={onClose} className="modal-close-button">&times;</button>
                <h3>Add Multiple Measurement Points</h3>

                <div className="modal-form-grid">
                    <div className="modal-form-section">
                        <h4>Common Properties</h4>
                        <label>Section</label>
                        <input type="text" name="section" value={formData.section} onChange={handleChange} placeholder="e.g., 4.1.a (will auto-increment)" />

                        <label>Parameter Name</label>
                        <input type="text" name="paramName" value={formData.paramName} onChange={handleChange} placeholder="e.g., DC Voltage" />
                        
                        <label>Parameter Units</label>
                        <select name="paramUnit" value={formData.paramUnit} onChange={handleChange}>
                            <option value="">-- Select Unit --</option>
                            {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        
                        <hr />

                        {hasQualifier ? (
                            <>
                                <div className="qualifier-header">
                                    <h4>Qualifier</h4>
                                    <button onClick={() => setHasQualifier(false)} title="Remove Qualifier"><FontAwesomeIcon icon={faTrashAlt} /></button>
                                </div>
                                <label>Qualifier Name</label>
                                <input type="text" name="qualName" value={formData.qualName} onChange={handleChange} />
                                <div className="input-group">
                                    <div>
                                        <label>Value</label>
                                        <input type="text" name="qualValue" value={formData.qualValue} onChange={handleChange} />
                                    </div>
                                    <div>
                                        <label>Units</label>
                                        <select name="qualUnit" value={formData.qualUnit} onChange={handleChange}>
                                            {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <button className="add-qualifier-btn" onClick={() => setHasQualifier(true)}>
                                <FontAwesomeIcon icon={faPlus} /> Add Common Qualifier
                            </button>
                        )}
                    </div>

                    <div className="modal-form-section">
                        <h4>Values</h4>
                        <label>Parameter Values (one per line)</label>
                        <textarea
                            name="values"
                            value={formData.values}
                            onChange={handleChange}
                            rows="10"
                            placeholder="1&#10;2&#10;5&#10;10"
                            className="batch-values-textarea"
                        ></textarea>
                    </div>
                </div>

                {hasExistingPoints && (
                    <div className="copy-tmde-section">
                        <input
                            type="checkbox"
                            id="batchCopyTmdes"
                            name="copyTmdes"
                            checked={formData.copyTmdes}
                            onChange={handleChange}
                        />
                        <label htmlFor="batchCopyTmdes">Use TMDEs from previous measurement point for all new points</label>
                    </div>
                )}

                <div className="modal-actions">
                    <button className="modal-icon-button secondary" onClick={onClose} title="Cancel"><FontAwesomeIcon icon={faTimes} /></button>
                    <button className="modal-icon-button primary" onClick={handleSave} title="Add Points"><FontAwesomeIcon icon={faCheck} /></button>
                </div>
            </div>
        </div>
    );
};

export default BatchAddTestPointModal;