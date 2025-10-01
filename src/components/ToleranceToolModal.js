import React, { useState, useEffect, useMemo } from "react";
import ToleranceForm from "./ToleranceForm"; // Import the refactored form
import ContextMenu from "./ContextMenu";
import { NotificationModal } from "../App";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrashAlt,
  faCheck,
  faTimes,
  faInfoCircle,
} from "@fortawesome/free-solid-svg-icons";

const ToleranceToolModal = ({ isOpen, onClose, onSave, testPointData }) => {
  const [activeTab, setActiveTab] = useState("UUT");
  const [uutTolerance, setUutTolerance] = useState({});
  const [tmdeTolerances, setTmdeTolerances] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  
  useEffect(() => {
    if (isOpen && testPointData) {
      const cleanObject = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([_, v]) => v !== undefined && v !== null));
      setUutTolerance(cleanObject(testPointData.uutTolerance));
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
      const componentKeys = ["reading", "range", "floor", "db"];
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

  const infoMessage = "• This tool is for editing complex, asymmetric, or multi-component tolerances for the UUT and any associated TMDEs.\n\n" +
                      "• To add a new TMDE, close this editor and use the 'Add TMDE' button in the main analysis view.\n\n" +
                      "• To delete a TMDE, right-click on its tab.";

  const activeTmde = tmdeTolerances.find((t) => t.id === activeTab);

  return (
    <div className="modal-overlay">
      {contextMenu && (<ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />)}
      <NotificationModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} title="Using the Tolerance Editor" message={infoMessage} />
      <div className="modal-content" style={{ maxWidth: "600px" }}>
        <FontAwesomeIcon icon={faInfoCircle} className="info-icon-modal" onClick={() => setIsInfoModalOpen(true)} title="How to use this editor" />
        <button onClick={onClose} className="modal-close-button">&times;</button>
        <h3>Tolerance Editor</h3>
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
          {/* The "+" button to add a TMDE from here has been removed */}
        </div>

        <div className="modal-body-scrollable">
          {activeTab === "UUT" && (
            <ToleranceForm tolerance={uutTolerance} setTolerance={setUutTolerance} isUUT={true} referencePoint={testPointData.testPointInfo.parameter} />
          )}
          {activeTmde && (
            <ToleranceForm tolerance={activeTmde} setTolerance={(setter) => handleTmdeToleranceChange(activeTmde.id, setter)} isUUT={false} referencePoint={activeTmde.measurementPoint} />
          )}
        </div>

        <div className="modal-actions">
          <button className="modal-icon-button secondary" onClick={onClose} title="Cancel"><FontAwesomeIcon icon={faTimes} /></button>
          <button className="modal-icon-button primary" onClick={handleSave} title="Store and Return"><FontAwesomeIcon icon={faCheck} /></button>
        </div>
      </div>
    </div>
  );
};

export default ToleranceToolModal;