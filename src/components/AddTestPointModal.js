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
    const [formData, setFormData] = useState({
        section: '', uutDescription: '',
        paramName: '', paramValue: '', paramUnit: '',
        qualName: 'Frequency', qualValue: '', qualUnit: 'kHz',
    });
    const [hasQualifier, setHasQualifier] = useState(false);
    const [notification, setNotification] = useState(null);

    // FIX: Changed unitSystem.conversions to unitSystem.units to match the new structure
    const availableUnits = useMemo(() => Object.keys(unitSystem.units), []);

    useEffect(() => {
        if (initialData) {
            const qualExists = !!initialData.testPointInfo.qualifier?.value;
            setHasQualifier(qualExists);
            setFormData({
                section: initialData.section || '',
                uutDescription: initialData.uutDescription || '',
                paramName: initialData.testPointInfo.parameter.name || '',
                paramValue: initialData.testPointInfo.parameter.value || '',
                paramUnit: initialData.testPointInfo.parameter.unit || '',
                qualName: initialData.testPointInfo.qualifier?.name || 'Frequency',
                qualValue: initialData.testPointInfo.qualifier?.value || '',
                qualUnit: initialData.testPointInfo.qualifier?.unit || 'kHz',
            });
        } else {
            // Reset to blank state for a new point
            setHasQualifier(false);
            setFormData({
                section: '', uutDescription: '',
                paramName: '', paramValue: '', paramUnit: '',
                qualName: 'Frequency', qualValue: '', qualUnit: 'kHz',
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        if (!formData.section || !formData.uutDescription || !formData.paramValue || !formData.paramUnit) {
             setNotification({ title: 'Missing Information', message: 'Please fill out all Identification and Parameter fields, including units.' });
            return;
        }

        const qualifierData = hasQualifier
            ? { name: formData.qualName, value: formData.qualValue, unit: formData.qualUnit }
            : null;

        const finalData = {
            section: formData.section,
            uutDescription: formData.uutDescription,
            testPointInfo: {
                parameter: { name: formData.paramName, value: formData.paramValue, unit: formData.paramUnit },
                qualifier: qualifierData,
            },
        };

        if (initialData) {
            onSave({ id: initialData.id, testPointData: finalData });
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
                                    <button onClick={() => setHasQualifier(false)} title="Remove Qualifier">
                                        <FontAwesomeIcon icon={faTrashAlt} />
                                    </button>
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

                 <div className="modal-actions">
                    <button className="modal-icon-button secondary" onClick={onClose} title="Cancel">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                    <button className="modal-icon-button primary" onClick={handleSave} title="Save Changes">
                        <FontAwesomeIcon icon={faCheck} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddTestPointModal;