// BatchAddTestPointModal.js

import React, { useState, useMemo, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes, faPlus, faTrashAlt } from '@fortawesome/free-solid-svg-icons';
import { unitSystem } from '../App';
import { NotificationModal } from '../App';

// Reusable Toggle Switch Component
const ToggleSwitch = ({ id, name, checked, onChange, label }) => (
    <div className="toggle-switch-container">
        <input
            type="checkbox"
            id={id}
            name={name}
            className="toggle-switch-checkbox"
            checked={checked}
            onChange={onChange}
        />
        <label className="toggle-switch-label" htmlFor={id}>
            <span className="toggle-switch-switch" />
        </label>
        <label htmlFor={id} className="toggle-option-label" style={{ fontWeight: '600' }}>
            {label}
        </label>
    </div>
);


const BatchAddTestPointModal = ({ isOpen, onClose, onSave, lastTestPoint }) => {
    const getInitialFormData = () => ({
        paramName: '',
        paramUnit: '',
        qualName: 'Frequency',
        qualValue: '',
        qualUnit: 'kHz',
        usePreviousTmdes: true,
        tmdeRefMatchesUut: true,
    });

    const [formData, setFormData] = useState(getInitialFormData());
    const [measurementPoints, setMeasurementPoints] = useState([]);
    const [newPointInput, setNewPointInput] = useState({ section: '', uutValue: '', tmdeValue: '', tmdeUnit: '' });
    const [hasQualifier, setHasQualifier] = useState(false);
    const [notification, setNotification] = useState(null);
    const availableUnits = useMemo(() => Object.keys(unitSystem.units), []);

    useEffect(() => {
        if (isOpen) {
            const initialState = getInitialFormData();
            if (lastTestPoint) {
                initialState.paramName = lastTestPoint.testPointInfo.parameter.name || '';
                initialState.paramUnit = lastTestPoint.testPointInfo.parameter.unit || '';
            }
            setFormData(initialState);
            setMeasurementPoints([]);
            setNewPointInput({ section: '', uutValue: '', tmdeValue: '', tmdeUnit: '' });
            setHasQualifier(false);
        }
    }, [isOpen, lastTestPoint]);

    if (!isOpen) return null;

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleNewPointInputChange = (e) => {
        const { name, value } = e.target;
        setNewPointInput(prev => ({ ...prev, [name]: value }));
    };

    const handleAddPoint = () => {
        if (!newPointInput.section || !newPointInput.uutValue) {
            setNotification({ title: "Missing Input", message: "Please provide both a Section and a Value for the new point." });
            return;
        }
        setMeasurementPoints(prev => [...prev, {
            id: Date.now(),
            section: newPointInput.section,
            uutValue: newPointInput.uutValue,
            tmdeValue: newPointInput.tmdeValue,
            tmdeUnit: newPointInput.tmdeUnit || formData.paramUnit,
        }]);
        setNewPointInput({ section: '', uutValue: '', tmdeValue: '', tmdeUnit: '' });
    };

    const handlePointDataChange = (id, field, value) => {
        setMeasurementPoints(prevPoints => prevPoints.map(p =>
            p.id === id ? { ...p, [field]: value } : p
        ));
    };

    const handleRemovePoint = (id) => {
        setMeasurementPoints(prev => prev.filter(p => p.id !== id));
    };

    const handleSave = () => {
        if (measurementPoints.length === 0) {
            setNotification({ title: 'No Points Added', message: 'Please add at least one measurement point before saving.' });
            return;
        }
        const qualifierData = hasQualifier ? { name: formData.qualName, value: formData.qualValue, unit: formData.qualUnit } : null;
        onSave({ formData, measurementPoints, qualifier: qualifierData });
    };

    const showTmdeInputs = formData.usePreviousTmdes && !formData.tmdeRefMatchesUut;

    return (
        <div className="modal-overlay">
            {notification && <NotificationModal isOpen={!!notification} onClose={() => setNotification(null)} title={notification.title} message={notification.message} />}
            <div className="modal-content" style={{ maxWidth: '950px' }}>
                <button onClick={onClose} className="modal-close-button">&times;</button>
                <h3>Add Multiple Measurement Points</h3>
                <div className="modal-form-grid">
                    <div className="modal-form-section">
                        <label>Parameter Name</label>
                        <input type="text" name="paramName" value={formData.paramName} onChange={handleFormChange} placeholder="e.g., DC Voltage" />
                        <label>Parameter Units</label>
                        <select name="paramUnit" value={formData.paramUnit} onChange={handleFormChange}>
                            <option value="">-- Select Unit --</option>
                            {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <hr />
                        {hasQualifier ? (
                             <>
                                <div className="qualifier-header"><h4>Qualifier</h4><button onClick={() => setHasQualifier(false)} title="Remove Qualifier"><FontAwesomeIcon icon={faTrashAlt} /></button></div>
                                <label>Qualifier Name</label>
                                <input type="text" name="qualName" value={formData.qualName} onChange={handleFormChange} />
                                <div className="input-group">
                                    <div><label>Value</label><input type="text" name="qualValue" value={formData.qualValue} onChange={handleFormChange} /></div>
                                    <div><label>Units</label><select name="qualUnit" value={formData.qualUnit} onChange={handleFormChange}>{availableUnits.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
                                </div>
                            </>
                        ) : (
                            <button className="add-qualifier-btn" onClick={() => setHasQualifier(true)}><FontAwesomeIcon icon={faPlus} /> Add Common Qualifier</button>
                        )}
                    </div>
                    <div className="modal-form-section">
                        <div className="measurement-points-container">
                             <div className={`points-table-header ${showTmdeInputs ? 'expanded' : ''}`}>
                                <span>Section</span>
                                <span>UUT Value</span>
                                {showTmdeInputs && (
                                    <>
                                        <span>TMDE Value</span>
                                        <span>TMDE Unit</span>
                                    </>
                                )}
                            </div>
                            <div className="measurement-points-list">
                                {measurementPoints.map(point => (
                                    <div key={point.id} className={`points-table-row ${showTmdeInputs ? 'expanded' : ''}`}>
                                        <input type="text" value={point.section} onChange={(e) => handlePointDataChange(point.id, 'section', e.target.value)} placeholder="Section" />
                                        <input type="text" value={point.uutValue} onChange={(e) => handlePointDataChange(point.id, 'uutValue', e.target.value)} placeholder="UUT Value" />
                                        {showTmdeInputs && (
                                            <>
                                                <input type="text" value={point.tmdeValue} onChange={(e) => handlePointDataChange(point.id, 'tmdeValue', e.target.value)} placeholder="TMDE Value" />
                                                <select value={point.tmdeUnit} onChange={(e) => handlePointDataChange(point.id, 'tmdeUnit', e.target.value)}>
                                                    <option value="">Unit</option>
                                                    {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                                                </select>
                                            </>
                                        )}
                                        <button onClick={() => handleRemovePoint(point.id)} className="remove-component-btn" title="Remove Point"><FontAwesomeIcon icon={faTrashAlt} /></button>
                                    </div>
                                ))}
                            </div>
                             <div className={`add-point-form ${showTmdeInputs ? 'expanded' : ''}`}>
                                <input type="text" name="section" value={newPointInput.section} onChange={handleNewPointInputChange} placeholder="Section (e.g., 4.2.c)" />
                                <input type="text" name="uutValue" value={newPointInput.uutValue} onChange={handleNewPointInputChange} placeholder="UUT Value" />

                                {showTmdeInputs && (
                                    <>
                                        <input
                                            type="text"
                                            name="tmdeValue"
                                            value={newPointInput.tmdeValue}
                                            onChange={handleNewPointInputChange}
                                            placeholder="TMDE Value"
                                        />
                                        <select
                                            name="tmdeUnit"
                                            value={newPointInput.tmdeUnit}
                                            onChange={handleNewPointInputChange}
                                        >
                                            <option value="">-- Unit --</option>
                                            {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </>
                                )}

                                <button onClick={handleAddPoint} className="button button-small" title="Add Point to List"><FontAwesomeIcon icon={faPlus} /></button>
                            </div>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                    <ToggleSwitch id="batchCopyTmdes" name="usePreviousTmdes" checked={formData.usePreviousTmdes} onChange={handleFormChange} label="Utilize Previous TMDE/s" />
                    {formData.usePreviousTmdes && (
                        <ToggleSwitch id="batchUpdateTmdeRefs" name="tmdeRefMatchesUut" checked={formData.tmdeRefMatchesUut} onChange={handleFormChange} label="TMDE/s Same Unit As UUT" />
                    )}
                </div>
                <div className="modal-actions">
                    <button className="modal-icon-button secondary" onClick={onClose} title="Cancel"><FontAwesomeIcon icon={faTimes} /></button>
                    <button className="modal-icon-button primary" onClick={handleSave} title="Add Points"><FontAwesomeIcon icon={faCheck} /></button>
                </div>
            </div>
        </div>
    );
};

export default BatchAddTestPointModal;