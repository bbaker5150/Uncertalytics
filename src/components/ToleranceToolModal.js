import React, { useState, useEffect, useMemo } from 'react';
import { unitSystem } from '../App'; 

const ToleranceToolModal = ({ isOpen, onClose, onSave, initialData, title, isUUT, nominal }) => {
    const [components, setComponents] = useState([]);
    const [miscData, setMiscData] = useState({});
    const [componentToAdd, setComponentToAdd] = useState('reading');

    const componentTypes = useMemo(() => ({
        reading: { name: 'Reading (% of Reading)', defaults: { low: '', high: '', unit: '%' } },
        range: { name: 'Range (% of Full Scale)', defaults: { value: '', low: '', high: '', unit: '%' } },
        floor: { name: 'Floor (Absolute)', defaults: { low: '', high: '', unit: nominal?.unit || 'V' } },
        db: { name: 'dB Component', defaults: { low: '', high: '', multiplier: 20, ref: 1 } },
    }), [nominal]);

    const availableComponents = useMemo(() => {
        const activeTypes = components.map(c => c.type);
        return Object.entries(componentTypes)
            .filter(([type]) => !activeTypes.includes(type))
            .map(([type, { name }]) => ({ type, name }));
    }, [components, componentTypes]);
    
    useEffect(() => {
        const { reading, range, floor, db, ...rest } = initialData;
        const active = [];
        if (reading && (parseFloat(reading.high) || parseFloat(reading.low))) active.push({ id: 1, type: 'reading', ...reading });
        if (range && (parseFloat(range.high) || parseFloat(range.low))) active.push({ id: 2, type: 'range', ...range });
        if (floor && (parseFloat(floor.high) || parseFloat(floor.low))) active.push({ id: 3, type: 'floor', ...floor });
        if (db && (parseFloat(db.high) || parseFloat(db.low))) active.push({ id: 4, type: 'db', ...db });
        
        setComponents(active);
        setMiscData(rest);

        // Set the default component to add
        const activeTypes = active.map(c => c.type);
        const firstAvailable = Object.keys(componentTypes).find(t => !activeTypes.includes(t));
        setComponentToAdd(firstAvailable || '');

    }, [initialData, componentTypes]);
    
    const unitOptions = useMemo(() => {
        return nominal?.unit ? unitSystem.getRelevantUnits(nominal.unit) : ['%', 'ppm'];
    }, [nominal]);

    if (!isOpen) return null;

    const handleAddComponent = () => {
        if (!componentToAdd) return;
        const newComponent = {
            id: Date.now(),
            type: componentToAdd,
            ...componentTypes[componentToAdd].defaults,
        };
        setComponents(prev => [...prev, newComponent]);
        
        const nextAvailable = availableComponents.filter(c => c.type !== componentToAdd)[0];
        setComponentToAdd(nextAvailable ? nextAvailable.type : '');
    };

    const handleRemoveComponent = (id) => {
        setComponents(prev => prev.filter(c => c.id !== id));
    };

    const handleChange = (e, id) => {
        const { name, value } = e.target;
        
        if (id === 'misc') {
            setMiscData(prev => ({ ...prev, [name]: value }));
            return;
        }

        setComponents(prev => prev.map(c => 
            c.id === id ? { ...c, [name]: value } : c
        ));
    };

    const handleSave = () => {
        const finalData = { ...miscData };
        // Ensure all component types exist in the final object
        Object.keys(componentTypes).forEach(type => {
            finalData[type] = componentTypes[type].defaults;
        });
        // Populate with active component data
        components.forEach(comp => {
            const { id, type, ...compData } = comp;
            finalData[type] = { ...finalData[type], ...compData };
        });
        onSave(finalData);
    };

    const renderComponentInputs = (comp) => {
        switch (comp.type) {
            case 'reading':
                return <div className="config-stack">
                    <label>Tolerance (±)</label>
                    <input type="number" step="any" name="high" value={comp.high} onChange={(e) => handleChange(e, comp.id)} placeholder="e.g., 0.1"/>
                    <label>Units</label>
                    <select name="unit" value={comp.unit} onChange={(e) => handleChange(e, comp.id)}>
                        {['%', 'ppm'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                </div>;
            case 'range':
                return <div className="config-stack">
                    <label>Range (FS) Value</label>
                    <input type="number" step="any" name="value" value={comp.value} onChange={(e) => handleChange(e, comp.id)} placeholder="e.g., 100"/>
                    <label>Tolerance (±)</label>
                    <input type="number" step="any" name="high" value={comp.high} onChange={(e) => handleChange(e, comp.id)} placeholder="e.g., 0.05"/>
                     <label>Units</label>
                    <select name="unit" value={comp.unit} onChange={(e) => handleChange(e, comp.id)}>
                        {['%'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                </div>;
            case 'floor':
                return <div className="config-stack">
                     <label>Tolerance (±)</label>
                    <input type="number" step="any" name="high" value={comp.high} onChange={(e) => handleChange(e, comp.id)} placeholder="e.g., 0.001"/>
                     <label>Units</label>
                    <select name="unit" value={comp.unit} onChange={(e) => handleChange(e, comp.id)}>
                        {unitOptions.filter(u => u !== '%' && u !== 'ppm').map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                </div>;
            case 'db':
                 return <div className="config-stack">
                    <label>Tolerance (± dB)</label>
                    <input type="number" step="any" name="high" value={comp.high} onChange={(e) => handleChange(e, comp.id)} placeholder="e.g., 0.5"/>
                    <label>dB Equation Multiplier</label>
                    <input type="number" step="any" name="multiplier" value={comp.multiplier} onChange={(e) => handleChange(e, comp.id)} />
                    <label>dB Reference Value</label>
                    <input type="number" step="any" name="ref" value={comp.ref} onChange={(e) => handleChange(e, comp.id)} />
                </div>;
            default:
                return null;
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{maxWidth: '600px'}}>
                <button onClick={onClose} className="modal-close-button">&times;</button>
                <h3>{title}</h3>

                <div className="components-container">
                    {components.map(comp => (
                        <div key={comp.id} className="component-card">
                            <div className="component-header">
                                <h5>{componentTypes[comp.type].name}</h5>
                                <button onClick={() => handleRemoveComponent(comp.id)} className="remove-component-btn">&times;</button>
                            </div>
                            <div className="component-body">
                                {renderComponentInputs(comp)}
                            </div>
                        </div>
                    ))}
                </div>
                
                {availableComponents.length > 0 && (
                    <div className="add-component-section">
                        <select value={componentToAdd} onChange={(e) => setComponentToAdd(e.target.value)}>
                            {availableComponents.map(({ type, name }) => (
                                <option key={type} value={type}>{name}</option>
                            ))}
                        </select>
                        <button className="button button-small" onClick={handleAddComponent}>Add Component</button>
                    </div>
                )}

                {isUUT && 
                    <div className="form-section" style={{marginTop: '20px'}}>
                        <label>Measuring Resolution (Least Significant Digit)</label>
                        <input type="number" step="any" name="measuringResolution" value={miscData.measuringResolution || ''} onChange={(e) => handleChange(e, 'misc')} placeholder="e.g., 0.001"/>
                    </div>
                }

                <div className="modal-actions">
                    <button className="button button-secondary" onClick={onClose}>Cancel</button>
                    <button className="button" onClick={handleSave}>Store and Return</button>
                </div>
            </div>
        </div>
    );
};

export default ToleranceToolModal;