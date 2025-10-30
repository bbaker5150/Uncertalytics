/* global math */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes, faPlus, faTrashAlt } from '@fortawesome/free-solid-svg-icons';
import { unitSystem } from '../App';
import { NotificationModal } from '../App';

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


const AddTestPointModal = ({ isOpen, onClose, onSave, initialData, hasExistingPoints }) => {
    const getInitialFormData = () => ({
        section: '',
        paramName: '', paramValue: '', paramUnit: '',
        qualName: 'Frequency', qualValue: '', qualUnit: 'kHz',
        copyTmdes: true,
        measurementType: 'direct',
        equationString: '',
        variableMappings: {},
    });

    const [formData, setFormData] = useState(getInitialFormData());
    const [hasQualifier, setHasQualifier] = useState(false);
    const [notification, setNotification] = useState(null);
    const [equationVariables, setEquationVariables] = useState([]);

    const availableUnits = useMemo(() => Object.keys(unitSystem.units), []);

    const updateEquationVariables = (equation) => {
        if (!equation) {
            setEquationVariables([]);
            setFormData(prev => ({ ...prev, variableMappings: {} }));
            return;
        }

        let expressionToParse = equation.trim(); // Trim whitespace

        const equalsIndex = expressionToParse.indexOf('=');
        if (equalsIndex !== -1) {
             // Check if there's content *after* the '='
             if (equalsIndex < expressionToParse.length - 1) {
                 expressionToParse = expressionToParse.substring(equalsIndex + 1).trim();
                 // Optionally, you could try to extract the variable name on the left (e.g., 'T')
                 // const targetVariable = equation.substring(0, equalsIndex).trim();
                 // You might want to store or validate this targetVariable if needed elsewhere.
             } else {
                 // Equation ends with '=', invalid expression part
                 expressionToParse = ''; // Treat as empty if only 'T =' was entered
             }
        }

        // Proceed with parsing only the expression part
        if (!expressionToParse) { // Handle empty expression after stripping assignment
            setEquationVariables([]);
            setFormData(prev => ({ ...prev, variableMappings: {} }));
            return;
        }

        try {
            const node = math.parse(expressionToParse); // Parse only the right-hand side
            const variables = new Set();
            node.traverse(function (node, path, parent) {
                if (node.isSymbolNode && !math[node.name] && !['e', 'pi', 'i'].includes(node.name.toLowerCase())) {
                    variables.add(node.name);
                }
            });
            const sortedVars = Array.from(variables).sort();
            setEquationVariables(sortedVars);

            setFormData(prev => {
                const newMappings = {};
                sortedVars.forEach(v => {
                    newMappings[v] = prev.variableMappings[v] || '';
                });
                return { ...prev, variableMappings: newMappings };
            });

        } catch (error) {
            console.error("Error parsing equation expression:", error);
            setEquationVariables([]);
            setFormData(prev => ({ ...prev, variableMappings: {} }));
        }
    }

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                const qualExists = !!initialData.testPointInfo.qualifier?.value;
                setHasQualifier(qualExists);
                const initialMappings = initialData.variableMappings || {};
                setFormData({
                    section: initialData.section || '',
                    paramName: initialData.testPointInfo.parameter.name || '',
                    paramValue: initialData.testPointInfo.parameter.value || '',
                    paramUnit: initialData.testPointInfo.parameter.unit || '',
                    qualName: initialData.testPointInfo.qualifier?.name || 'Frequency',
                    qualValue: initialData.testPointInfo.qualifier?.value || '',
                    qualUnit: initialData.testPointInfo.qualifier?.unit || 'kHz',
                    copyTmdes: false,
                    measurementType: initialData.measurementType || 'direct',
                    equationString: initialData.equationString || '',
                    variableMappings: initialMappings,
                });
                if (initialData.measurementType === 'derived') {
                    updateEquationVariables(initialData.equationString);
                } else {
                    setEquationVariables([]);
                }
            } else {
                setHasQualifier(false);
                setFormData(getInitialFormData());
                setEquationVariables([]);
            }
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;

        setFormData(prev => ({
            ...prev,
            [name]: newValue
        }));

        if (name === 'equationString') {
            updateEquationVariables(newValue);
        }
    };

    const handleMappingChange = (variableSymbol, userFriendlyName) => {
        setFormData(prev => ({
            ...prev,
            variableMappings: {
                ...prev.variableMappings,
                [variableSymbol]: userFriendlyName
            }
        }));
    };

    const handleSave = () => {
        if (!formData.section || !formData.paramUnit || !formData.paramValue ||
            (formData.measurementType === 'derived' && !formData.equationString) ||
            (formData.measurementType === 'derived' && equationVariables.some(v => !formData.variableMappings[v] || formData.variableMappings[v].trim() === ''))
        ) {
             setNotification({
                 title: 'Missing Information',
                 message: 'Please fill out all required (*) fields:\n' +
                          '- Section\n' +
                          '- Parameter Value (Nominal/Reference for derived)\n' +
                          '- Parameter Unit\n' +
                          (formData.measurementType === 'derived' ? '- Equation\n' : '') +
                          (formData.measurementType === 'derived' && equationVariables.some(v => !formData.variableMappings[v] || formData.variableMappings[v].trim() === '') ? '- All Variable Mappings must be named' : '')
                });
            return;
        }

        const qualifierData = hasQualifier ? { name: formData.qualName, value: formData.qualValue, unit: formData.qualUnit } : null;

        const finalData = {
            section: formData.section,
            testPointInfo: {
                parameter: { name: formData.paramName, value: formData.paramValue, unit: formData.paramUnit },
                qualifier: qualifierData,
            },
            copyTmdes: formData.copyTmdes,
            measurementType: formData.measurementType,
            equationString: formData.equationString,
            variableMappings: formData.variableMappings,
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
                        <label>Section *</label>
                        <input type="text" name="section" value={formData.section} onChange={handleChange} placeholder="e.g., 4.1.a" />

                        <label style={{marginTop: '15px'}}>Measurement Type *</label>
                         <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
                            <label style={{ fontWeight: 'normal', display: 'flex', alignItems: 'center', gap: '5px'}}>
                                <input
                                    type="radio"
                                    name="measurementType"
                                    value="direct"
                                    checked={formData.measurementType === 'direct'}
                                    onChange={handleChange}
                                    style={{width: 'auto', height: 'auto', margin: 0}}
                                /> Direct
                            </label>
                            <label style={{ fontWeight: 'normal', display: 'flex', alignItems: 'center', gap: '5px'}}>
                                <input
                                    type="radio"
                                    name="measurementType"
                                    value="derived"
                                    checked={formData.measurementType === 'derived'}
                                    onChange={handleChange}
                                     style={{width: 'auto', height: 'auto', margin: 0}}
                                /> Derived
                            </label>
                        </div>
                    </div>

                    <div className="modal-form-section">
                        <h4>Parameter</h4>
                        <label>Parameter Name</label>
                        <input type="text" name="paramName" value={formData.paramName} onChange={handleChange} placeholder="e.g., DC Voltage, Resistance, Power"/>

                        <div className="input-group">
                            <div>
                                <label>Value {formData.measurementType === 'derived' ? '(Nominal/Reference)' : ''} *</label>
                                <input
                                    type="text"
                                    name="paramValue"
                                    value={formData.paramValue}
                                    onChange={handleChange}
                                    placeholder={formData.measurementType === 'derived' ? "Nominal result (e.g., 1)" : "e.g., 10"}
                                />
                            </div>
                            <div>
                                <label>Units *</label>
                                <SearchableDropdown name="paramUnit" value={formData.paramUnit} onChange={handleChange} options={availableUnits} />
                            </div>
                        </div>

                         {formData.measurementType === 'derived' && (
                            <>
                                <label style={{marginTop: '15px'}}>Equation *</label>
                                <input
                                    type="text"
                                    name="equationString"
                                    value={formData.equationString}
                                    onChange={handleChange}
                                    placeholder="e.g., V / I or W * L"
                                    style={{ fontFamily: 'monospace' }}
                                />
                                {equationVariables.length > 0 && (
                                    <div style={{marginTop: '15px', paddingLeft: '10px', borderLeft: '3px solid var(--border-color)'}}>
                                        <label style={{fontSize: '0.9em', color: 'var(--text-color-muted)', marginBottom: '5px'}}>Map Variables (*required):</label>
                                        {equationVariables.map(variable => (
                                            <div key={variable} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                                                <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{variable} =</span>
                                                <input
                                                    type="text"
                                                    value={formData.variableMappings[variable] || ''}
                                                    onChange={(e) => handleMappingChange(variable, e.target.value)}
                                                    placeholder={`Enter Name (e.g., Voltage, Current, Weight)`}
                                                    style={{ margin: 0 }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

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

                {!isEditing && hasExistingPoints && (
                    <div className="copy-tmde-section">
                        <input
                            type="checkbox"
                            id="copyTmdes"
                            name="copyTmdes"
                            checked={formData.copyTmdes}
                            onChange={handleChange}
                        />
                        <label htmlFor="copyTmdes">Use TMDEs from previous measurement point</label>
                    </div>
                )}
                 <div className="modal-actions">
                    <button className="modal-icon-button secondary" onClick={onClose} title="Cancel"><FontAwesomeIcon icon={faTimes} /></button>
                    <button className="modal-icon-button primary" onClick={handleSave} title="Save Changes"><FontAwesomeIcon icon={faCheck} /></button>
                </div>
            </div>
        </div>
    );
};

export default AddTestPointModal;