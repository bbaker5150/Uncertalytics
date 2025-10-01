import React, { useState, useEffect, useMemo } from "react";
import ToleranceForm from "./ToleranceForm";
import { unitSystem } from "../App";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faTimes } from "@fortawesome/free-solid-svg-icons";

const AddTmdeModal = ({ isOpen, onClose, onSave, testPointData }) => {
    const uutMeasurementPoint = testPointData.testPointInfo.parameter;

    const getInitialState = () => ({
        id: Date.now(),
        name: "New TMDE",
        measurementPoint: { ...uutMeasurementPoint },
    });

    const [tmde, setTmde] = useState(getInitialState());
    const [useUutRef, setUseUutRef] = useState(true);
    const allUnits = useMemo(() => Object.keys(unitSystem.units), []);

    useEffect(() => {
        if(isOpen) {
            setTmde(getInitialState());
            setUseUutRef(true);
        }
    }, [isOpen]);

    useEffect(() => {
        if (useUutRef) {
            setTmde(prev => ({ ...prev, measurementPoint: uutMeasurementPoint }));
        } else {
            // Keep the last unit but clear the value
            setTmde(prev => ({...prev, measurementPoint: { value: '', unit: prev.measurementPoint.unit}}))
        }
    }, [useUutRef, uutMeasurementPoint]);

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
                <h3>Add New TMDE</h3>

                <div className="modal-body-scrollable">
                    <div className="tmde-header">
                        <div className="form-section">
                            <label>TMDE Name</label>
                            <input type="text" value={tmde.name} onChange={(e) => setTmde({...tmde, name: e.target.value})} placeholder="e.g., Standard DMM" />
                        </div>
                        <div className="form-section">
                            <label>Reference Measurement Point</label>
                             <div className="symmetric-toggle" style={{ marginBottom: '10px' }}>
                                <input type="checkbox" id="useUutRef" checked={useUutRef} onChange={(e) => setUseUutRef(e.target.checked)} />
                                <label htmlFor="useUutRef">Use UUT Measurement Point ({uutMeasurementPoint.value} {uutMeasurementPoint.unit})</label>
                            </div>
                            <div className="input-with-unit">
                                <input type="text" placeholder="Value" disabled={useUutRef} value={tmde.measurementPoint?.value || ""} onChange={(e) => setTmde({...tmde, measurementPoint: {...tmde.measurementPoint, value: e.target.value}})} />
                                <select disabled={useUutRef} value={tmde.measurementPoint?.unit || ""} onChange={(e) => setTmde({...tmde, measurementPoint: {...tmde.measurementPoint, unit: e.target.value}})}>
                                    <option value="">-- Unit --</option>
                                    {allUnits.map((u) => (<option key={u} value={u}>{u}</option>))}
                                </select>
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