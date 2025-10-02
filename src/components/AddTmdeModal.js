import React, { useState, useEffect, useMemo, useCallback } from "react";
import ToleranceForm from "./ToleranceForm";
import { unitSystem } from "../App";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faTimes } from "@fortawesome/free-solid-svg-icons";

const AddTmdeModal = ({ isOpen, onClose, onSave, testPointData, initialTmdeData = null }) => {
    const uutMeasurementPoint = testPointData.testPointInfo.parameter;

    const getInitialState = useCallback(() => {
        if (initialTmdeData) {
            return JSON.parse(JSON.stringify(initialTmdeData));
        }
        return {
            id: Date.now(),
            name: "New TMDE",
            measurementPoint: { ...uutMeasurementPoint },
        };
    }, [uutMeasurementPoint, initialTmdeData]);

    const [tmde, setTmde] = useState(getInitialState());
    
    const [useUutRef, setUseUutRef] = useState(() => {
        if (!initialTmdeData) return true;
        const tmdePoint = initialTmdeData.measurementPoint;
        return uutMeasurementPoint.value === tmdePoint.value && uutMeasurementPoint.unit === tmdePoint.unit;
    });

    const allUnits = useMemo(() => Object.keys(unitSystem.units), []);

    useEffect(() => {
        if(isOpen) {
            const initialState = getInitialState();
            setTmde(initialState);
            if (initialTmdeData) {
                 const tmdePoint = initialTmdeData.measurementPoint;
                 const refsMatch = uutMeasurementPoint.value === tmdePoint.value && uutMeasurementPoint.unit === tmdePoint.unit;
                 setUseUutRef(refsMatch);
            } else {
                 setUseUutRef(true);
            }
        }
    }, [isOpen, getInitialState, initialTmdeData, uutMeasurementPoint]);

    useEffect(() => {
        if (useUutRef) {
            setTmde(prev => ({ ...prev, measurementPoint: uutMeasurementPoint }));
        } else {
            if (!initialTmdeData) { 
                setTmde(prev => ({...prev, measurementPoint: { value: '', unit: prev.measurementPoint.unit}}))
            }
        }
    }, [useUutRef, uutMeasurementPoint, initialTmdeData]);

    const handleSave = () => {
        const cleanupTolerance = (tol) => {
            const cleaned = { ...tol };
            const componentKeys = ["reading", "range", "floor", "db"];
            componentKeys.forEach((key) => {
                if (cleaned[key] && (cleaned[key].high === "" || isNaN(parseFloat(cleaned[key].high)))) {
                    delete cleaned[key];
                }
            });
            return cleaned;
        };
        onSave(cleanupTolerance(tmde));
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: "600px" }}>
                <button onClick={onClose} className="modal-close-button">&times;</button>
                <h3>{initialTmdeData ? 'Edit TMDE' : 'Add New TMDE'}</h3>

                <div className="modal-body-scrollable">
                    <div className="tmde-header">
                        <div className="form-section">
                            <label>TMDE Name</label>
                            <input type="text" value={tmde.name} onChange={(e) => setTmde({...tmde, name: e.target.value})} placeholder="e.g., Standard DMM" />
                        </div>
                        <div className="form-section">
                            <label>Reference Measurement Point</label>
                            <div className="reference-point-control">
                                <div className="toggle-switch-container">
                                    <input 
                                        type="checkbox" 
                                        id="useUutRef" 
                                        className="toggle-switch-checkbox"
                                        checked={useUutRef} 
                                        onChange={(e) => setUseUutRef(e.target.checked)} 
                                    />
                                    <label className="toggle-switch-label" htmlFor="useUutRef">
                                        <span className="toggle-switch-switch" />
                                    </label>
                                    <label htmlFor="useUutRef" className="toggle-option-label">
                                        Use UUT Measurement Point
                                        <span className="uut-point-display">({uutMeasurementPoint.value} {uutMeasurementPoint.unit})</span>
                                    </label>
                                </div>
                                <div className={`manual-input-container ${useUutRef ? 'disabled' : ''}`}>
                                    <div className="input-with-unit">
                                        <input 
                                            type="text" 
                                            placeholder="Value" 
                                            disabled={useUutRef} 
                                            value={tmde.measurementPoint?.value || ""} 
                                            onChange={(e) => setTmde({...tmde, measurementPoint: {...tmde.measurementPoint, value: e.target.value}})} 
                                        />
                                        <select 
                                            disabled={useUutRef} 
                                            value={tmde.measurementPoint?.unit || ""} 
                                            onChange={(e) => setTmde({...tmde, measurementPoint: {...tmde.measurementPoint, unit: e.target.value}})}
                                        >
                                            <option value="">-- Unit --</option>
                                            {allUnits.map((u) => (<option key={u} value={u}>{u}</option>))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <ToleranceForm tolerance={tmde} setTolerance={setTmde} isUUT={false} referencePoint={tmde.measurementPoint} />
                </div>
                
                <div className="modal-actions">
                    <button className="modal-icon-button secondary" onClick={onClose} title="Cancel">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                    <button className="modal-icon-button primary" onClick={handleSave} title="Save TMDE">
                        <FontAwesomeIcon icon={faCheck} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddTmdeModal;