import React from 'react';
import { getToleranceSummary } from '../App';

const TestPointInfoModal = ({ isOpen, onClose, testPoint }) => {
    if (!isOpen || !testPoint) return null;

    const uutToleranceDisplay = getToleranceSummary(testPoint.uutTolerance);
    const tmdeToleranceDisplay = getToleranceSummary(testPoint.tmdeTolerance);

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{textAlign: 'left'}}>
                <button onClick={onClose} className="modal-close-button">&times;</button>
                <h3>Test Point Details</h3>
                <div className="breakdown-step">
                    <h5>Identification</h5>
                    <p><strong>Section:</strong> {testPoint.section || 'N/A'}</p>
                    <p><strong>UUT:</strong> {testPoint.uutDescription || 'N/A'}</p>
                    <p><strong>TMDE:</strong> {testPoint.tmdeDescription || 'N/A'}</p>
                </div>
                <div className="breakdown-step">
                     <h5>Tolerance Expressions</h5>
                    <p><strong>UUT Tolerance:</strong> {uutToleranceDisplay}</p>
                    <p><strong>TMDE Tolerance:</strong> {tmdeToleranceDisplay}</p>
                </div>
            </div>
        </div>
    );
};

export default TestPointInfoModal;