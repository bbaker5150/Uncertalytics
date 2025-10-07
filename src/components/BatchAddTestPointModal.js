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
        <label htmlFor={id} className="toggle-option-label">
            {label}
        </label>
    </div>
);

const BatchAddTestPointModal = ({ isOpen, onClose, onSave, lastTestPoint }) => {
    const getInitialState = () => ({
        section: '',
        paramName: '',
        paramUnit: '',
        qualName: 'Frequency',
        qualValue: '',
        qualUnit: 'kHz',
        copyTmdes: true,
        updateTmdeRefs: true,
    });

    const [formData, setFormData] = useState(getInitialState());
    const [valuesData, setValuesData] = useState({ uut: '', tmdeValues: {} });
    const [tmdesRequiringInput, setTmdesRequiringInput] = useState([]);
    const [hasQualifier, setHasQualifier] = useState(false);
    const [notification, setNotification] = useState(null);
    const availableUnits = useMemo(() => Object.keys(unitSystem.units), []);

    // Effect to auto-populate fields and reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData(getInitialState());
            setValuesData({ uut: '', tmdeValues: {} });
            setHasQualifier(false);
            if (lastTestPoint) {
                setFormData(prev => ({
                    ...prev,
                    paramName: lastTestPoint.testPointInfo.parameter.name || '',
                    paramUnit: lastTestPoint.testPointInfo.parameter.unit || '',
                }));
            }
        }
    }, [isOpen, lastTestPoint]);
    
    // Effect to determine which TMDEs need new values
    useEffect(() => {
        if (formData.copyTmdes && lastTestPoint?.tmdeTolerances) {
            const sourceUutParam = lastTestPoint.testPointInfo.parameter;
            const tmdesToUpdate = lastTestPoint.tmdeTolerances.filter(tmde =>
                // A TMDE needs new input if its unit type is different from the UUT's
                unitSystem.getQuantity(tmde.measurementPoint.unit) !== unitSystem.getQuantity(sourceUutParam.unit)
            );
            setTmdesRequiringInput(tmdesToUpdate);
        } else {
            setTmdesRequiringInput([]);
        }
    }, [formData.copyTmdes, lastTestPoint]);


    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleValuesChange = (e) => {
        const { name, value } = e.target;
        setValuesData(prev => ({ ...prev, [name]: value }));
    };

    const handleTmdeValueChange = (tmdeId, value) => {
        setValuesData(prev => ({
            ...prev,
            tmdeValues: { ...prev.tmdeValues, [tmdeId]: value }
        }));
    };

    const handleSave = () => {
        const uutValues = valuesData.uut.split('\n').filter(Boolean);
        if (!formData.section || !formData.paramUnit || uutValues.length === 0) {
            setNotification({ title: 'Missing Information', message: 'Please fill out the Section, Parameter Unit, and at least one UUT Value.' });
            return;
        }

        // Validate that all required TMDE textareas have the same number of lines as the UUT
        for (const tmde of tmdesRequiringInput) {
            const tmdeValueLines = (valuesData.tmdeValues[tmde.id] || '').split('\n').filter(Boolean);
            if (tmdeValueLines.length !== uutValues.length) {
                setNotification({ title: 'Value Mismatch', message: `The number of values for "${tmde.name}" (${tmdeValueLines.length}) does not match the number of UUT values (${uutValues.length}).` });
                return;
            }
        }

        const qualifierData = hasQualifier ? { name: formData.qualName, value: formData.qualValue, unit: formData.qualUnit } : null;

        onSave({
            formData,
            valuesData,
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
                                    <div><label>Value</label><input type="text" name="qualValue" value={formData.qualValue} onChange={handleChange} /></div>
                                    <div><label>Units</label><select name="qualUnit" value={formData.qualUnit} onChange={handleChange}>{availableUnits.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
                                </div>
                            </>
                        ) : (
                            <button className="add-qualifier-btn" onClick={() => setHasQualifier(true)}><FontAwesomeIcon icon={faPlus} /> Add Common Qualifier</button>
                        )}
                        <hr/>
                        <h4>TMDE Copy Options</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <ToggleSwitch id="batchCopyTmdes" name="copyTmdes" checked={formData.copyTmdes} onChange={handleChange} label="Copy TMDEs from previous point" />
                            {formData.copyTmdes && (
                                <div style={{paddingLeft: '25px'}}>
                                    <ToggleSwitch id="batchUpdateTmdeRefs" name="updateTmdeRefs" checked={formData.updateTmdeRefs} onChange={handleChange} label="Dynamically update TMDE references" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="modal-form-section">
                        <h4>Unique Values</h4>
                        <label>Starting Section</label>
                        <input type="text" name="section" value={formData.section} onChange={handleChange} placeholder="e.g., 4.1.a (will auto-increment)" />
                        
                        <label>UUT Parameter Values (one per line)</label>
                        <textarea name="uut" value={valuesData.uut} onChange={handleValuesChange} rows="6" placeholder="1&#10;2&#10;5&#10;10" className="batch-values-textarea"></textarea>
                        
                        {tmdesRequiringInput.map(tmde => (
                            <div key={tmde.id}>
                                <label>Values for {tmde.name} ({tmde.measurementPoint.unit})</label>
                                <textarea
                                    value={valuesData.tmdeValues[tmde.id] || ''}
                                    onChange={(e) => handleTmdeValueChange(tmde.id, e.target.value)}
                                    rows="6"
                                    placeholder={`Enter one ${tmde.measurementPoint.unit} value for each UUT value`}
                                    className="batch-values-textarea"
                                ></textarea>
                            </div>
                        ))}
                    </div>
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