import React, { useState, useMemo } from 'react';
import ToleranceToolModal from './ToleranceToolModal';
import { Accordion } from '../App';

const TestPointDetailView = ({ testPointData, onDataSave, children }) => {
    const [isUutTolOpen, setIsUutTolOpen] = useState(false);
    const [isTmdeTolOpen, setIsTmdeTolOpen] = useState(false);

    const handleSaveTolerance = (type, toleranceData) => {
        onDataSave({ [type]: toleranceData });
        if (type === 'uutTolerance') setIsUutTolOpen(false);
        if (type === 'tmdeTolerance') setIsTmdeTolOpen(false);
    };
    
    // Helper function to create a display string from the tolerance object
    const getToleranceSummary = (toleranceData) => {
        if (!toleranceData) return 'Not Set';
        const { reading, range, floor, db } = toleranceData;
        const parts = [];
        if (parseFloat(reading?.high)) parts.push(`±${reading.high} ${reading.unit}`);
        if (parseFloat(range?.high)) parts.push(`±${range.high} ${range.unit} of FS`);
        if (parseFloat(floor?.high)) parts.push(`±${floor.high} ${floor.unit}`);
        if (parseFloat(db?.high)) parts.push(`±${db.high} dB`);
        return parts.length > 0 ? parts.join(' + ') : 'Not Set';
    };

    const uutToleranceDisplay = useMemo(() => getToleranceSummary(testPointData.uutTolerance), [testPointData.uutTolerance]);
    const tmdeToleranceDisplay = useMemo(() => getToleranceSummary(testPointData.tmdeTolerance), [testPointData.tmdeTolerance]);
    
    return (
        <div className="test-point-details-view">
            {isUutTolOpen && 
                <ToleranceToolModal 
                    isOpen={isUutTolOpen} 
                    onClose={() => setIsUutTolOpen(false)}
                    onSave={(data) => handleSaveTolerance('uutTolerance', data)}
                    initialData={testPointData.uutTolerance}
                    title="UUT Tolerance Calculator"
                    isUUT={true}
                />
            }
            {isTmdeTolOpen && 
                <ToleranceToolModal 
                    isOpen={isTmdeTolOpen} 
                    onClose={() => setIsTmdeTolOpen(false)}
                    onSave={(data) => handleSaveTolerance('tmdeTolerance', data)}
                    initialData={testPointData.tmdeTolerance}
                    title="TMDE Tolerance Calculator"
                    isUUT={false}
                />
            }

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
                        <div style={{marginTop: '10px'}}>
                            <button className="button button-small" onClick={() => setIsUutTolOpen(true)}>Edit UUT Tolerance</button>
                            <button className="button button-small" onClick={() => setIsTmdeTolOpen(true)}>Edit TMDE Tolerance</button>
                        </div>
                    </div>
                </div>
            </Accordion>
            
            {/* The full analysis component is rendered here as a child */}
            {children}
        </div>
    );
};

export default TestPointDetailView;