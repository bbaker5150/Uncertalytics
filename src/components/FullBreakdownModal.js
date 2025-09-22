import React from 'react';
import Latex from 'react-latex-next';
import { calculateUncertaintyFromToleranceObject } from '../App';

const BreakdownDetails = ({ type, testPoint }) => {
    const toleranceObject = type === 'UUT' ? testPoint.uutTolerance : testPoint.tmdeTolerance;
    const { standardUncertainty, breakdown } = calculateUncertaintyFromToleranceObject(
        toleranceObject,
        testPoint.testPointInfo.parameter,
        type === 'UUT'
    );

    if (breakdown.length === 0) {
        return (
            <div>
                <h4>{type} Breakdown</h4>
                <p>No tolerance components have been defined.</p>
            </div>
        );
    }

    return (
        <div className="full-breakdown-column">
            <h4>{type} Breakdown</h4>
            {breakdown.map((comp, index) => (
                <div className="breakdown-step" key={index}>
                    <h5>{comp.name} Component</h5>
                    <ul>
                        <li><strong>Input:</strong> {comp.input}</li>
                        <li><strong>Conversion:</strong> {comp.explanation}</li>
                        <li><strong>In PPM:</strong> {comp.ppm.toFixed(3)} ppm</li>
                        <li><strong>Std. Uncertainty (uᵢ):</strong> <Latex>{`$$ \\frac{${comp.ppm.toFixed(3)}}{${comp.divisor.toFixed(3)}} = ${comp.u_i.toFixed(3)} \\text{ ppm}$$`}</Latex></li>
                    </ul>
                </div>
            ))}
            <div className="breakdown-step">
                <h5>{type} Combined Uncertainty</h5>
                <Latex>{`$$ u_c = \\sqrt{\\sum u_i^2} = \\sqrt{${breakdown.map(c => `${c.u_i.toFixed(2)}^2`).join(' + ')}} = \\mathbf{${standardUncertainty.toFixed(3)}} \\text{ ppm} $$`}</Latex>
            </div>
        </div>
    );
};


const FullBreakdownModal = ({ isOpen, testPoint, onClose }) => {
    if (!isOpen || !testPoint) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content breakdown-modal-content" style={{maxWidth: '900px'}}>
                <button onClick={onClose} className="modal-close-button">&times;</button>
                <h3>Tolerance Calculation Breakdown</h3>
                <div className="breakdown-step">
                    <h5>Nominal Value</h5>
                    <p>The reference value for all calculations: <strong>{testPoint.testPointInfo.parameter.value} {testPoint.testPointInfo.parameter.unit}</strong></p>
                </div>
                <div className="full-breakdown-container">
                    <BreakdownDetails type="UUT" testPoint={testPoint} />
                    <BreakdownDetails type="TMDE" testPoint={testPoint} />
                </div>
            </div>
        </div>
    );
};

export default FullBreakdownModal;