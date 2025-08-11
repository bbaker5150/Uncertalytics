import React, { useMemo } from 'react';
import { Accordion, getToleranceSummary } from '../App';

const TestPointDetailView = ({ testPointData, onDataSave, children }) => {
    // The useMemo hooks now use the imported getToleranceSummary function
    const uutToleranceDisplay = useMemo(() => getToleranceSummary(testPointData.uutTolerance), [testPointData.uutTolerance]);
    const tmdeToleranceDisplay = useMemo(() => getToleranceSummary(testPointData.tmdeTolerance), [testPointData.tmdeTolerance]);
    
    return (
        <div className="test-point-details-view">
            {/* All modal logic and state has been removed from this component */}
            <Accordion title="Test Point Details & Tolerances" startOpen={true}>
                <div className="spec-input-container">
                    <div className="spec-input-column">
                        <h5>Identification</h5>
                        <p><strong>Section:</strong> {testPointData.section}</p>
                        <p><strong>UUT:</strong> {testPointData.uutDescription}</p>
                        <p><strong>TMDE:</strong> {testPointData.tmdeDescription}</p>
                    </div>
                    <div className="spec-input-column">
                        <h5>Tolerance Expressions</h5>
                        <p><strong>UUT Tolerance:</strong> {uutToleranceDisplay}</p>
                        <p><strong>TMDE Tolerance:</strong> {tmdeToleranceDisplay}</p>
                        {/* The "Edit" buttons have been removed from here */}
                    </div>
                </div>
            </Accordion>
            
            {/* The full analysis component is rendered here as a child */}
            {children}
        </div>
    );
};

export default TestPointDetailView;