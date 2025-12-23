import React, { useState, useEffect, useLayoutEffect } from "react";
import ReactDOM from "react-dom";
import ToleranceForm from "../../../components/common/ToleranceForm";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faBookOpen, faEdit, faTimes } from "@fortawesome/free-solid-svg-icons";
import InstrumentLookupModal from "./InstrumentLookupModal";
import NotificationModal from "../../../components/modals/NotificationModal"; //
import { findInstrumentTolerance, findMatchingTolerances, getToleranceSummary } from "../../../utils/uncertaintyMath";
import { useFloatingWindow } from "../../../hooks/useFloatingWindow";
import UnresolvedToleranceModal from "../../testPoints/components/UnresolvedToleranceModal";

const EditUutModal = ({
    isOpen,
    onClose,
    onSave,
    initialDescription = "",
    initialTolerance = {},
    instruments = [],
    uutNominal = null,
    hasParentOverlay = false
}) => {
    const [description, setDescription] = useState("");
    const [tolerance, setTolerance] = useState({});
    const [selectedInstrument, setSelectedInstrument] = useState(null);
    const [notification, setNotification] = useState(null); // Local notification state

    const [isLookupOpen, setIsLookupOpen] = useState(false);
    const [pendingInstrument, setPendingInstrument] = useState(null);
    const [showRangePrompt, setShowRangePrompt] = useState(false);
    const [rangePromptData, setRangePromptData] = useState({ value: "", unit: "" });
    const [unresolvedToleranceModal, setUnresolvedToleranceModal] = useState(null);

    // Floating Window Logic
    const { position, handleMouseDown } = useFloatingWindow({
        isOpen,
        defaultWidth: 600,
        defaultHeight: 700
    });

    useLayoutEffect(() => {
        if (isOpen) {
            setDescription(initialDescription || "");
            setTolerance(initialTolerance || {});
            setSelectedInstrument(null);
            setNotification(null);
        }
    }, [isOpen, initialDescription, initialTolerance]);


    const applySpecs = (matchedData, rangeValue, rangeUnit) => {
        const specs = JSON.parse(JSON.stringify(matchedData.tolerances || matchedData.tolerance || {}));

        let calculatedRangeMax = matchedData.rangeMax;
        if (!calculatedRangeMax) {
            const promptVal = parseFloat(rangeValue);
            if (!isNaN(promptVal)) calculatedRangeMax = promptVal;
        }

        const compKeys = ['reading', 'range', 'floor', 'readings_iv', 'db'];

        compKeys.forEach(key => {
            if (specs[key]) {
                if (!specs[key].unit) {
                    if (key === 'reading' || key === 'range') specs[key].unit = '%';
                    else if (key === 'floor' || key === 'readings_iv') specs[key].unit = rangeUnit;
                }
                if (key === 'range') {
                    specs[key].value = calculatedRangeMax;
                }
                if (specs[key].high) {
                    const highVal = parseFloat(specs[key].high);
                    if (!isNaN(highVal)) {
                        specs[key].low = String(-Math.abs(highVal));
                    }
                    specs[key].symmetric = true;
                }
            }
        });

        // Use Custom Notification Modal
        const summary = getToleranceSummary(specs);
        setNotification({
            title: "Confirm Specifications",
            message: `Found specifications for ${matchedData.model || "Instrument"}:\n\n` +
                `Tolerance: ${summary}\n\n` +
                `Do you want to apply these tolerances?`,
            confirmText: "Apply Specs",
            cancelText: "Cancel",
            onConfirm: () => {
                setTolerance({
                    ...specs,
                    measuringResolution: matchedData.resolution
                });
                setShowRangePrompt(false);
                setPendingInstrument(null);
                setNotification(null);
            }
        });
    };

    const handleInstrumentSelect = (instrument) => {
        setDescription(`${instrument.manufacturer} ${instrument.model} ${instrument.description}`);
        setSelectedInstrument(instrument);

        if (uutNominal && uutNominal.value && uutNominal.unit) {
            const matches = findMatchingTolerances(
                instrument,
                uutNominal.value,
                uutNominal.unit
            );

            if (matches && matches.length > 1) {
                setUnresolvedToleranceModal({
                    instrumentName: instrument.model,
                    matches: matches,
                    onSelect: (selected) => {
                        applySpecs(selected, uutNominal.value, uutNominal.unit);
                        setUnresolvedToleranceModal(null);
                    }
                });
                return;
            } else if (matches && matches.length === 1) {
                applySpecs(matches[0], uutNominal.value, uutNominal.unit);
                return;
            }
        }

        setPendingInstrument(instrument);
        setRangePromptData({
            value: uutNominal?.value || "",
            unit: uutNominal?.unit || instrument.functions[0]?.unit || "V"
        });
        setShowRangePrompt(true);
    };

    const confirmRangeSelection = () => {
        if (!pendingInstrument) return;

        const matchedData = findInstrumentTolerance(
            pendingInstrument,
            rangePromptData.value,
            rangePromptData.unit
        );

        if (matchedData) {
            applySpecs(matchedData, rangePromptData.value, rangePromptData.unit);
        } else {
            alert("No matching range found for the values entered. Specs were not imported.");
        }
    };

    const handleSave = () => {
        onSave({ description, tolerance, instrument: selectedInstrument });
        onClose();
    };

    if (!isOpen) return null;

    const modalZIndex = hasParentOverlay ? 2100 : 2000;
    const overlayZIndex = modalZIndex + 100;

    // PORTAL
    return ReactDOM.createPortal(
        <>
            <InstrumentLookupModal
                isOpen={isLookupOpen}
                onClose={() => setIsLookupOpen(false)}
                instruments={instruments}
                onSelect={handleInstrumentSelect}
            />

            <NotificationModal
                isOpen={!!notification}
                onClose={() => setNotification(null)}
                title={notification?.title}
                message={notification?.message}
                onConfirm={notification?.onConfirm}
                confirmText={notification?.confirmText}
                cancelText={notification?.cancelText}
            />

            <UnresolvedToleranceModal
                isOpen={!!unresolvedToleranceModal}
                matches={unresolvedToleranceModal?.matches}
                instrumentName={unresolvedToleranceModal?.instrumentName}
                onSelect={unresolvedToleranceModal?.onSelect}
                onClose={() => setUnresolvedToleranceModal(null)}
            />

            {showRangePrompt && (
                <div className="modal-overlay" style={{ zIndex: overlayZIndex, backgroundColor: 'rgba(0,0,0,0.7)' }}>
                    <div className="modal-content" style={{ maxWidth: '400px' }}>
                        <h4 style={{ marginTop: 0 }}>Set Baseline Tolerance</h4>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-color-muted)' }}>
                            Please enter a representative measurement value (e.g., 10 V).
                            This is required to import the correct range specifications from the library.
                        </p>
                        <div className="input-group" style={{ marginBottom: '20px' }}>
                            <input
                                type="number"
                                placeholder="Value"
                                value={rangePromptData.value}
                                onChange={e => setRangePromptData({ ...rangePromptData, value: e.target.value })}
                                autoFocus
                            />
                            <input
                                type="text"
                                placeholder="Unit"
                                value={rangePromptData.unit}
                                onChange={e => setRangePromptData({ ...rangePromptData, unit: e.target.value })}
                            />
                        </div>
                        <div className="modal-actions">
                            <button className="button button-secondary" onClick={() => { setShowRangePrompt(false); setPendingInstrument(null); }}>Skip Spec Import</button>
                            <button className="button button-primary" onClick={confirmRangeSelection} disabled={!rangePromptData.value}>Import Specs</button>
                        </div>
                    </div>
                </div>
            )}

            <div
                className="modal-content floating-window-content"
                style={{
                    position: 'fixed',
                    top: position.y,
                    left: position.x,
                    margin: 0,
                    width: '600px',
                    maxWidth: '90vw',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: modalZIndex,
                    overflow: 'hidden'
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingBottom: '10px',
                        marginBottom: '10px',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'move',
                        userSelect: 'none'
                    }}
                    onMouseDown={handleMouseDown}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
                            Edit UUT Specifications
                        </h3>
                    </div>
                    <button onClick={onClose} className="modal-close-button" style={{ position: 'static' }}>&times;</button>
                </div>

                <div className="modal-main-content" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingRight: '5px' }}>
                    <div className="form-section">
                        <label>UUT Name / Model</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="e.g., Fluke 8588A"
                                style={{ flex: 1 }}
                            />
                            <button
                                className="btn-icon-only"
                                onClick={() => setIsLookupOpen(true)}
                                title="Import from Instrument Library"
                                style={{ width: '42px', height: '42px', fontSize: '1rem' }}
                            >
                                <FontAwesomeIcon icon={faBookOpen} />
                            </button>
                        </div>
                    </div>

                    <ToleranceForm
                        tolerance={tolerance}
                        setTolerance={setTolerance}
                        isUUT={true}
                        referencePoint={null}
                        hideDistribution={true}
                    />
                </div>

                <div
                    className="modal-actions"
                    style={{ justifyContent: "flex-end", alignItems: "center" }}
                >
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <button
                            className="modal-icon-button primary"
                            onClick={handleSave}
                            title="Save Changes"
                        >
                            <FontAwesomeIcon icon={faCheck} />
                        </button>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
};

export default EditUutModal;