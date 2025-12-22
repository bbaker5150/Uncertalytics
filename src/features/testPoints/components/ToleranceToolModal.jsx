import React, { useState, useEffect } from "react";
import ToleranceForm from "../../../components/common/ToleranceForm"; 
import ContextMenu from "../../../components/common/ContextMenu";
import NotificationModal from '../../../components/modals/NotificationModal';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrashAlt,
  faCheck,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";

const ToleranceToolModal = ({ isOpen, onClose, onSave, testPointData }) => {
  const [activeTab, setActiveTab] = useState("UUT");
  const [uutTolerance, setUutTolerance] = useState({});
  const [tmdeTolerances, setTmdeTolerances] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  
  useEffect(() => {
    if (isOpen && testPointData) {
      const cleanObject = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([_, v]) => v !== undefined && v !== null));
      
      let initialUut = cleanObject(testPointData.uutTolerance);
      
      if (initialUut.floor && !initialUut.floor.unit && testPointData.testPointInfo?.parameter?.unit) {
        initialUut = {
            ...initialUut,
            floor: { ...initialUut.floor, unit: testPointData.testPointInfo.parameter.unit }
        };
      }

      if (initialUut.readings_iv && !initialUut.readings_iv.unit && testPointData.testPointInfo?.parameter?.unit) {
        initialUut = {
            ...initialUut,
            readings_iv: { ...initialUut.readings_iv, unit: testPointData.testPointInfo.parameter.unit }
        };
      }

      setUutTolerance(initialUut);
      setTmdeTolerances((testPointData.tmdeTolerances || []).map(t => cleanObject(t)));
      setActiveTab("UUT");
    }
  }, [isOpen, testPointData]);

  const handleRemoveTmde = (idToRemove) => {
    setTmdeTolerances((prev) => prev.filter((t) => t.id !== idToRemove));
    if (activeTab === idToRemove) setActiveTab("UUT");
  };

  const handleTmdeToleranceChange = (id, setter) => {
    setTmdeTolerances((prev) => prev.map((t) => (t.id === id ? setter(t) : t)));
  };

  if (!isOpen) return null;

  const handleSave = () => {
    const cleanupTolerance = (tol, isUut = false) => {
      const cleaned = { ...tol };
      
      const componentKeys = ["reading", "readings_iv", "range", "floor", "db"];
      
      componentKeys.forEach((key) => {
        if (cleaned[key] && (cleaned[key].high === "" || isNaN(parseFloat(cleaned[key].high)))) {
          delete cleaned[key];
        }
      });

      if (isUut) {
        if (!parseFloat(cleaned.measuringResolution)) {
          delete cleaned.measuringResolution;
          delete cleaned.measuringResolutionUnit;
        }
      }
      return cleaned;
    };

    onSave({
      uutTolerance: cleanupTolerance(uutTolerance, true),
      tmdeTolerances: tmdeTolerances.map((t) => cleanupTolerance(t)),
    });
    onClose();
  };

  const activeTmde = tmdeTolerances.find((t) => t.id === activeTab);

  return (
    <div className="modal-overlay">
      {contextMenu && (<ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />)}
      
      <div className="modal-content" style={{ maxWidth: "600px" }}>
        
        {/* Modal Header */}
        <div className="modal-header" style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '15px' 
        }}>
            <h3 style={{ margin: 0 }}>Tolerance Editor</h3>
            <button 
                onClick={onClose} 
                className="modal-close-button"
                title="Close"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  color: 'var(--text-color)'
                }}
            >
                <FontAwesomeIcon icon={faTimes} />
            </button>
        </div>
        
        <div className="modal-tabs">
          <button className={`modal-tab ${activeTab === "UUT" ? "active" : ""}`} onClick={() => setActiveTab("UUT")}>
            {testPointData.uutDescription || "UUT"}
          </button>
          {tmdeTolerances.map((tmde) => (
            <button key={tmde.id} className={`modal-tab ${activeTab === tmde.id ? "active" : ""}`} onClick={() => setActiveTab(tmde.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.pageX, y: e.pageY, items: [{ label: `Delete "${tmde.name}"`, action: () => handleRemoveTmde(tmde.id), icon: faTrashAlt, className: "destructive" }] });
              }}>
              {tmde.name}
            </button>
          ))}
        </div>

        <div className="modal-body-scrollable">
          {activeTab === "UUT" && (
            <ToleranceForm tolerance={uutTolerance} setTolerance={setUutTolerance} isUUT={true} referencePoint={testPointData.testPointInfo.parameter} />
          )}
          {activeTmde && (
            <ToleranceForm tolerance={activeTmde} setTolerance={(setter) => handleTmdeToleranceChange(activeTmde.id, setter)} isUUT={false} referencePoint={activeTmde.measurementPoint} />
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-actions" style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '15px', justifyContent: 'flex-end' }}>
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
  );
};

export default ToleranceToolModal;