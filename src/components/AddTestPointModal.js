import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes, faPlus, faTrashAlt } from '@fortawesome/free-solid-svg-icons';
import { unitSystem } from '../App';
import { NotificationModal } from '../App';

// A reusable component for searchable unit dropdowns
const SearchableDropdown = ({ name, value, onChange, options }) => {
    const [searchTerm, setSearchTerm] = useState(value);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        setSearchTerm(value);
    }, [value]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);
    
    const filteredOptions = options.filter(option => 
        option.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelect = (option) => {
        setSearchTerm(option);
        onChange({ target: { name, value: option } });
        setIsOpen(false);
    };

    const handleChange = (e) => {
        setSearchTerm(e.target.value);
        onChange(e);
        if (!isOpen) setIsOpen(true);
    }

    return (
        <div className="searchable-dropdown" ref={wrapperRef}>
            <input 
                type="text"
                name={name}
                value={searchTerm}
                onChange={handleChange}
                onFocus={() => setIsOpen(true)}
                autoComplete="off"
            />
            {isOpen && filteredOptions.length > 0 && (
                <div className="dropdown-list">
                    {filteredOptions.map(option => (
                        <div key={option} className="dropdown-item" onClick={() => handleSelect(option)}>
                            {option}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


const AddTestPointModal = ({ isOpen, onClose, onSave, initialData }) => {
    const getInitialFormData = () => ({
        section: '', uutDescription: '',
        paramName: '', paramValue: '', paramUnit: '',
        qualName: 'Frequency', qualValue: '', qualUnit: 'kHz',
        uutTolerance: {
            reading: { value: '', unit: '%' },
            floor: { value: '', unit: '' },
            resolution: { value: '', unit: '' },
        }
    });

    const [formData, setFormData] = useState(getInitialFormData());
    const [hasQualifier, setHasQualifier] = useState(false);
    const [notification, setNotification] = useState(null);

    const availableUnits = useMemo(() => Object.keys(unitSystem.units), []);
    const physicalUnits = useMemo(() => availableUnits.filter(u => !['%', 'ppm', 'dB'].includes(u)), [availableUnits]);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                const qualExists = !!initialData.testPointInfo.qualifier?.value;
                const paramUnit = initialData.testPointInfo.parameter.unit || '';
                setHasQualifier(qualExists);
                setFormData({
                    section: initialData.section || '',
                    uutDescription: initialData.uutDescription || '',
                    paramName: initialData.testPointInfo.parameter.name || '',
                    paramValue: initialData.testPointInfo.parameter.value || '',
                    paramUnit: paramUnit,
                    qualName: initialData.testPointInfo.qualifier?.name || 'Frequency',
                    qualValue: initialData.testPointInfo.qualifier?.value || '',
                    qualUnit: initialData.testPointInfo.qualifier?.unit || 'kHz',
                    uutTolerance: {
                        reading: {
                            value: initialData.uutTolerance?.reading?.high || '',
                            unit: initialData.uutTolerance?.reading?.unit || '%'
                        },
                        floor: {
                            value: initialData.uutTolerance?.floor?.high || '',
                            unit: initialData.uutTolerance?.floor?.unit || paramUnit
                        },
                        resolution: {
                            value: initialData.uutTolerance?.measuringResolution || '',
                            unit: initialData.uutTolerance?.measuringResolutionUnit || paramUnit
                        }
                    }
                });
            } else {
                setHasQualifier(false);
                setFormData(getInitialFormData());
            }
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleToleranceChange = (e) => {
        const { name, value } = e.target;
        const [component, field] = name.split('.'); 
        setFormData(prev => ({
            ...prev,
            uutTolerance: {
                ...prev.uutTolerance,
                [component]: {
                    ...prev.uutTolerance[component],
                    [field]: value
                }
            }
        }));
    };

    const handleSave = () => {
        if (!formData.section || !formData.uutDescription || !formData.paramValue || !formData.paramUnit) {
             setNotification({ title: 'Missing Information', message: 'Please fill out all Identification and Parameter fields.' });
            return;
        }

        const { reading, floor, resolution } = formData.uutTolerance;
        if (!reading.value && !floor.value && !resolution.value) {
            setNotification({
                title: 'Missing Tolerance',
                message: 'Please define at least one UUT tolerance component (Reading, Floor, or Resolution) before saving.'
            });
            return;
        }

        const qualifierData = hasQualifier ? { name: formData.qualName, value: formData.qualValue, unit: formData.qualUnit } : null;
        const newUutTolerance = {};

        const addComponentIfValid = (key, data, unit) => {
            const numValue = parseFloat(data.value);
            if (!isNaN(numValue) && data.value !== '') {
                newUutTolerance[key] = {
                    high: String(numValue), low: String(-numValue),
                    unit: data.unit || unit, distribution: '1.960', symmetric: true,
                };
            }
        };

        addComponentIfValid('reading', reading, '%');
        addComponentIfValid('floor', floor, formData.paramUnit);
        
        const resValue = parseFloat(resolution.value);
        if (!isNaN(resValue) && resolution.value !== '') {
            newUutTolerance.measuringResolution = String(resValue);
            newUutTolerance.measuringResolutionUnit = resolution.unit || formData.paramUnit;
        }

        const finalData = {
            section: formData.section,
            uutDescription: formData.uutDescription,
            testPointInfo: {
                parameter: { name: formData.paramName, value: formData.paramValue, unit: formData.paramUnit },
                qualifier: qualifierData,
            },
            uutTolerance: newUutTolerance,
        };

        if (initialData) {
            onSave({ id: initialData.id, ...finalData });
        } else {
            onSave(finalData);
        }
    };

    const isEditing = !!initialData;

    return (
        <div className="modal-overlay">
            {notification && <NotificationModal isOpen={!!notification} onClose={() => setNotification(null)} title={notification.title} message={notification.message} />}
            <div className="modal-content" style={{maxWidth: '800px'}}>
                <button onClick={onClose} className="modal-close-button">&times;</button>
                <h3>{isEditing ? 'Edit Measurement Point' : 'Add New Measurement Point'}</h3>
                
                <div className="modal-form-grid">
                    <div className="modal-form-section">
                        <h4>Identification</h4>
                        <label>Section</label>
                        <input type="text" name="section" value={formData.section} onChange={handleChange} placeholder="e.g., 4.1.a" />
                        <label>UUT – Unit Under Test</label>
                        <input type="text" name="uutDescription" value={formData.uutDescription} onChange={handleChange} placeholder="UUT model or ID" />
                    </div>
                    <div className="modal-form-section">
                        <h4>Parameter</h4>
                        <label>Parameter Name</label>
                        <input type="text" name="paramName" value={formData.paramName} onChange={handleChange} placeholder="e.g., DC Voltage"/>
                        <div className="input-group">
                            <div>
                                <label>Value</label>
                                <input type="text" name="paramValue" value={formData.paramValue} onChange={handleChange} placeholder="e.g., 10"/>
                            </div>
                            <div>
                                <label>Units</label>
                                <SearchableDropdown name="paramUnit" value={formData.paramUnit} onChange={handleChange} options={availableUnits} />
                            </div>
                        </div>
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
                                        <SearchableDropdown name="qualUnit" value={formData.qualUnit} onChange={handleChange} options={availableUnits} />
                                    </div>
                                </div>
                            </>
                        ) : (
                             <button className="add-qualifier-btn" onClick={() => setHasQualifier(true)}>
                                <FontAwesomeIcon icon={faPlus} /> Add Qualifier
                            </button>
                        )}
                    </div>
                </div>
                <div className="modal-form-section" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                    <h4 style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '15px' }}>UUT Tolerance Specification</h4>
                    <div className="modal-form-grid">
                        <div className="modal-form-section" style={{paddingTop: 0}}>
                             <label>Reading Tolerance (±)</label>
                            <div className="input-group">
                                <div>
                                    <input type="number" step="any" name="reading.value" value={formData.uutTolerance.reading.value} onChange={handleToleranceChange} placeholder="Value"/>
                                </div>
                                <div>
                                    <select name="reading.unit" value={formData.uutTolerance.reading.unit} onChange={handleToleranceChange}>
                                        <option value="%">%</option>
                                        <option value="ppm">ppm</option>
                                    </select>
                                </div>
                            </div>
                            <label>Floor Tolerance (±)</label>
                            <div className="input-group">
                                <div>
                                    <input type="number" step="any" name="floor.value" value={formData.uutTolerance.floor.value} onChange={handleToleranceChange} placeholder="Value"/>
                                </div>
                                <div>
                                    <SearchableDropdown name="floor.unit" value={formData.uutTolerance.floor.unit || formData.paramUnit} onChange={handleToleranceChange} options={physicalUnits} />
                                </div>
                            </div>
                        </div>
                         <div className="modal-form-section" style={{paddingTop: 0}}>
                            <label>Measuring Resolution (LSD)</label>
                             <div className="input-group">
                                <div>
                                    <input type="number" step="any" name="resolution.value" value={formData.uutTolerance.resolution.value} onChange={handleToleranceChange} placeholder="Value"/>
                                </div>
                                <div>
                                    <SearchableDropdown name="resolution.unit" value={formData.uutTolerance.resolution.unit || formData.paramUnit} onChange={handleToleranceChange} options={physicalUnits} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                 <div className="modal-actions">
                    <button className="modal-icon-button secondary" onClick={onClose} title="Cancel"><FontAwesomeIcon icon={faTimes} /></button>
                    <button className="modal-icon-button primary" onClick={handleSave} title="Save Changes"><FontAwesomeIcon icon={faCheck} /></button>
                </div>
            </div>
        </div>
    );
};

export default AddTestPointModal;