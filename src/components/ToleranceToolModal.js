import React, { useState, useEffect } from 'react';

const ToleranceToolModal = ({ isOpen, onClose, onSave, initialData, title, isUUT }) => {
    const [data, setData] = useState(initialData);

    useEffect(() => {
        setData(initialData);
    }, [initialData]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const [group, field] = name.split('.');
        
        if (type === 'checkbox') {
            setData(prev => ({ ...prev, [name]: checked }));
        } else if (group && field) {
            setData(prev => ({ ...prev, [group]: { ...prev[group], [field]: value } }));
        } else {
            setData(prev => ({ ...prev, [name]: value }));
        }
    };
    
    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{maxWidth: '900px'}}>
                <button onClick={onClose} className="modal-close-button">&times;</button>
                <h3>{title}</h3>

                <div className="config-grid">
                    <div className="form-section">
                        <h5>Reading Component (IV)</h5>
                        <label>Tolerance (±)</label>
                        <div style={{display: 'flex', gap: '10px'}}>
                            <input type="number" name="reading.low" value={data.reading.low} onChange={handleChange} placeholder="Low"/>
                            <input type="number" name="reading.high" value={data.reading.high} onChange={handleChange} placeholder="High"/>
                        </div>
                        <label>Units</label>
                        <select name="reading.unit" value={data.reading.unit} onChange={handleChange}>
                            <option value="%">% of Reading</option>
                            <option value="V">Value (V)</option>
                            <option value="A">Value (A)</option>
                            {/* ... more units */}
                        </select>
                    </div>
                     <div className="form-section">
                        <h5>Range Component (FS)</h5>
                        <label>Range (FS) Value</label>
                        <input type="number" name="range.value" value={data.range.value} onChange={handleChange} placeholder="e.g., 100"/>
                         <label>Tolerance (±)</label>
                        <div style={{display: 'flex', gap: '10px'}}>
                            <input type="number" name="range.low" value={data.range.low} onChange={handleChange} placeholder="Low"/>
                            <input type="number" name="range.high" value={data.range.high} onChange={handleChange} placeholder="High"/>
                        </div>
                        <label>Units</label>
                         <select name="range.unit" value={data.range.unit} onChange={handleChange}>
                            <option value="%">% of Range</option>
                            <option value="V">Value (V)</option>
                            {/* ... more units */}
                        </select>
                    </div>
                     <div className="form-section">
                        <h5>Floor Component</h5>
                        <label>Tolerance (±)</label>
                         <div style={{display: 'flex', gap: '10px'}}>
                            <input type="number" name="floor.low" value={data.floor.low} onChange={handleChange} placeholder="Low"/>
                            <input type="number" name="floor.high" value={data.floor.high} onChange={handleChange} placeholder="High"/>
                        </div>
                        <label>Units</label>
                         <select name="floor.unit" value={data.floor.unit} onChange={handleChange}>
                            <option value="V">Value (V)</option>
                            <option value="mV">Value (mV)</option>
                            {/* ... more units */}
                        </select>
                    </div>
                     <div className="form-section">
                        <h5>dB Component</h5>
                        <label>Tolerance (± dB)</label>
                         <div style={{display: 'flex', gap: '10px'}}>
                            <input type="number" name="db.low" value={data.db.low} onChange={handleChange} placeholder="Low dB"/>
                            <input type="number" name="db.high" value={data.db.high} onChange={handleChange} placeholder="High dB"/>
                        </div>
                        <label>dB Equation Multiplier</label>
                        <input type="number" name="db.multiplier" value={data.db.multiplier} onChange={handleChange} />
                         <label>dB Reference Value</label>
                        <input type="number" name="db.ref" value={data.db.ref} onChange={handleChange} />
                    </div>
                </div>

                {isUUT && 
                    <div className="form-section" style={{marginTop: '20px'}}>
                        <label>Measuring Resolution (Least Significant Digit)</label>
                        <input type="number" step="any" name="measuringResolution" value={data.measuringResolution} onChange={handleChange} placeholder="e.g., 0.001"/>
                    </div>
                }

                <div className="modal-actions">
                    <button className="button button-secondary" onClick={onClose}>Cancel</button>
                    <button className="button" onClick={() => onSave(data)}>Store and Return</button>
                </div>
            </div>
        </div>
    );
};

export default ToleranceToolModal;