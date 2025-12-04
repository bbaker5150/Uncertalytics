import React, { useState, useMemo, useEffect } from "react";

// --- Components ---
import Analysis from "./components/Analysis";
import NotificationModal from "./components/NotificationModal";
import AddTestPointModal from "./components/AddTestPointModal";
import TestPointDetailView from "./components/TestPointDetailView";
import ToleranceToolModal from "./components/ToleranceToolModal";
import EditSessionModal from "./components/EditSessionModal";
import OverviewModal from "./components/OverviewModal";
import ContextMenu from "./components/ContextMenu";
import FullBreakdownModal from "./components/FullBreakdownModal";
import TestPointInfoModal from "./components/TestPointInfoModal";

// --- Utils & Hooks ---
import useSessionManager from "./hooks/useSessionManager";
import { saveSessionToPdf, parseSessionPdf } from "./utils/fileIo";
import "./App.css";

// --- Icons ---
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faInfoCircle,
  faPlus,
  faEdit,
  faTrashAlt,
  faPencilAlt,
  faSlidersH,
  faSave,
  faFolderOpen,
} from "@fortawesome/free-solid-svg-icons";

// --- Contexts ---
const ThemeContext = React.createContext(false);
export const useTheme = () => React.useContext(ThemeContext);

function App() {
  const {
    sessions,
    selectedSessionId,
    setSelectedSessionId,
    selectedTestPointId,
    setSelectedTestPointId,
    currentSessionData,
    currentTestPoints,
    defaultTestPoint,
    addSession,
    deleteSession,
    updateSession,
    importSession,
    saveTestPoint,
    deleteTestPoint,
    updateTestPointData,
    deleteTmdeDefinition,
    decrementTmdeQuantity,
    setSessions,
  } = useSessionManager();

  // --- UI State ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTestPoint, setEditingTestPoint] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [isToleranceModalOpen, setIsToleranceModalOpen] = useState(false);
  const [isOverviewOpen, setIsOverviewOpen] = useState(false);
  const [breakdownPoint, setBreakdownPoint] = useState(null);
  const [infoModalPoint, setInfoModalPoint] = useState(null);
  const [confirmationModal, setConfirmationModal] = useState(null);
  const [appNotification, setAppNotification] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  
  // --- Theme & Dark Mode State ---
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [currentTheme, setCurrentTheme] = useState("theme-cyberpunk");

  const [initialSessionTab, setInitialSessionTab] = useState("details");
  const [initialTmdeToEdit, setInitialTmdeToEdit] = useState(null);
  const [sessionImageCache, setSessionImageCache] = useState(new Map());
  const [riskResults, setRiskResults] = useState(null);

  // --- Theme Effect ---
  useEffect(() => {
    const body = document.body;
    
    // 1. Reset: Remove all specific theme classes
    body.classList.remove("theme-glass", "theme-cyberpunk", "theme-stranger");

    // 2. Apply the selected theme (if not default)
    if (currentTheme !== "default") {
      body.classList.add(currentTheme);
    }

    // 3. Apply Dark Mode (works on top of themes)
    if (isDarkMode) {
      body.classList.add("dark-mode");
    } else {
      body.classList.remove("dark-mode");
    }

    // 4. Electron Integration (Optional)
    if (window.require) {
      try {
        const { ipcRenderer } = window.require("electron");
        ipcRenderer.send("set-theme", isDarkMode ? "dark" : "light");
      } catch (error) {
        console.warn("Could not connect to Electron IPC", error);
      }
    }
  }, [isDarkMode, currentTheme]);

  const handleAddNewSession = () => {
    const newSession = addSession();
    setEditingSession(newSession);
  };

  const handleDeleteSession = (sessionId) => {
    setConfirmationModal({
      title: "Delete Session",
      message: "Are you sure you want to delete this session and all its measurement points?",
      onConfirm: () => {
        deleteSession(sessionId);
        setConfirmationModal(null);
      },
    });
  };

  const handleSessionChange = (updatedSession, newImageFiles = []) => {
    updateSession(updatedSession);
    if (newImageFiles.length > 0) {
      setSessionImageCache((prevCache) => {
        const newCache = new Map(prevCache);
        const sessionCache = new Map(newCache.get(updatedSession.id) || []);
        newImageFiles.forEach((img) => sessionCache.set(img.id, img.fileObject));
        newCache.set(updatedSession.id, sessionCache);
        return newCache;
      });
    }
    setEditingSession(null);
  };

  const handleOpenSessionEditor = (initialTab = "details", tmdeToEdit = null) => {
    setInitialSessionTab(initialTab);
    setInitialTmdeToEdit(tmdeToEdit);
    setEditingSession(currentSessionData);
  };

  const handleSaveTestPoint = (formData) => {
    saveTestPoint(formData);
    setIsAddModalOpen(false);
    setEditingTestPoint(null);
  };

  const handleDeleteTestPoint = (idToDelete) => {
    setConfirmationModal({
      title: "Delete Measurement Point",
      message: "Are you sure you want to delete this measurement point?",
      onConfirm: () => {
        deleteTestPoint(idToDelete);
        setConfirmationModal(null);
      },
    });
  };

  const handleDeleteTmdeDefinition = (tmdeId) => {
    setConfirmationModal({
      title: "Delete TMDE",
      message: "Are you sure you want to delete this entire TMDE definition (all instances)?",
      onConfirm: () => {
        deleteTmdeDefinition(tmdeId);
        setConfirmationModal(null);
      },
    });
  };

  const handleUpdateSpecificTestPoint = (testPointId, updatedData) => {
    setSessions((prevSessions) =>
      prevSessions.map((session) => {
        if (session.id === selectedSessionId) {
          const updatedTestPoints = session.testPoints.map((tp) =>
            tp.id === testPointId ? { ...tp, ...updatedData } : tp
          );
          return { ...session, testPoints: updatedTestPoints };
        }
        return session;
      })
    );
  };

  const handleSaveToFile = async () => {
    if (!currentSessionData) return;
    const sessionCache = sessionImageCache.get(currentSessionData.id);
    try {
      await saveSessionToPdf(currentSessionData, sessionCache);
    } catch (error) {
      console.error("PDF Save Error:", error);
      setAppNotification({ title: "Save Failed", message: `Failed to save PDF: ${error.message}` });
    }
  };

  const handleLoadFromFile = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const { session, images } = await parseSessionPdf(file);
      importSession(session);
      setSessionImageCache((prevCache) => {
        const newCache = new Map(prevCache);
        newCache.set(session.id, images);
        return newCache;
      });
      setAppNotification({ title: "Success", message: `Session "${session.name}" loaded successfully.` });
    } catch (error) {
      console.error("PDF Load Error:", error);
      setAppNotification({ title: "Load Failed", message: error.message });
    }
    event.target.value = null;
  };

  const testPointData = useMemo(() => {
    if (!currentSessionData || !selectedTestPointId) return null;
    const pointData = currentTestPoints.find((p) => p.id === selectedTestPointId);
    if (!pointData) return null;
    return {
      ...pointData,
      uutDescription: currentSessionData.uutDescription,
      uutTolerance: currentSessionData.uutTolerance,
    };
  }, [currentSessionData, selectedTestPointId, currentTestPoints]);

  return (
    <ThemeContext.Provider value={isDarkMode}>
      <div className="App">
        <NotificationModal
          isOpen={!!appNotification}
          onClose={() => setAppNotification(null)}
          title={appNotification?.title}
          message={appNotification?.message}
        />
        
        {confirmationModal && (
          <div className="modal-overlay" style={{ zIndex: 2001 }}>
            <div className="modal-content">
              <button onClick={() => setConfirmationModal(null)} className="modal-close-button">&times;</button>
              <h3>{confirmationModal.title}</h3>
              <p>{confirmationModal.message}</p>
              <div className="modal-actions" style={{ justifyContent: "center", gap: "15px" }}>
                <button className="button button-secondary" onClick={() => setConfirmationModal(null)}>Cancel</button>
                <button className="button" style={{ backgroundColor: "var(--status-bad)" }} onClick={confirmationModal.onConfirm}>Delete</button>
              </div>
            </div>
          </div>
        )}

        <AddTestPointModal
          isOpen={isAddModalOpen || !!editingTestPoint}
          onClose={() => { setIsAddModalOpen(false); setEditingTestPoint(null); }}
          onSave={handleSaveTestPoint}
          initialData={editingTestPoint}
          hasExistingPoints={currentTestPoints.length > 0}
          previousTestPointData={currentTestPoints.length > 0 ? currentTestPoints[currentTestPoints.length - 1] : null}
        />

        <EditSessionModal
          isOpen={!!editingSession}
          onClose={() => { setEditingSession(null); setInitialTmdeToEdit(null); setInitialSessionTab("details"); }}
          sessionData={editingSession}
          onSave={handleSessionChange}
          onSaveToFile={handleSaveToFile}
          handleLoadFromFile={handleLoadFromFile}
          initialSection={initialSessionTab}
          sessionImageCache={sessionImageCache}
          onImageCacheChange={setSessionImageCache}
        />

        <OverviewModal
          isOpen={isOverviewOpen}
          onClose={() => setIsOverviewOpen(false)}
          sessionData={currentSessionData}
          onUpdateTestPoint={handleUpdateSpecificTestPoint}
          onDeleteTmdeDefinition={deleteTmdeDefinition}
          onDecrementTmdeQuantity={decrementTmdeQuantity}
        />

        {testPointData && (
          <ToleranceToolModal
            isOpen={isToleranceModalOpen}
            onClose={() => setIsToleranceModalOpen(false)}
            onSave={(data) => {
              const { uutTolerance, ...testPointSpecificData } = data;
              if (uutTolerance) {
                setSessions((prev) => prev.map((s) => s.id === selectedSessionId ? { ...s, uutTolerance } : s));
              }
              updateTestPointData(testPointSpecificData);
            }}
            testPointData={testPointData}
          />
        )}

        <FullBreakdownModal isOpen={!!breakdownPoint} breakdownData={breakdownPoint} onClose={() => setBreakdownPoint(null)} />
        <TestPointInfoModal isOpen={!!infoModalPoint} testPoint={infoModalPoint} onClose={() => setInfoModalPoint(null)} />
        
        {contextMenu && <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />}

        <div className="content-area uncertainty-analysis-page">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h2>Uncertainty Analysis</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              
              {/* --- Theme Selector Dropdown --- */}
              <select 
                value={currentTheme} 
                onChange={(e) => setCurrentTheme(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--input-background)", 
                  color: "var(--text-color)",                
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  outline: "none",
                  marginRight: "5px"
                }}
              >
                <option value="default">Default Theme</option>
                <option value="theme-cyberpunk">Cyberpunk</option>
                <option value="theme-stranger">Stranger Things</option>
              </select>

              <button className="sidebar-action-button" onClick={handleSaveToFile} title="Save Session to File (.pdf)">
                <FontAwesomeIcon icon={faSave} />
              </button>
              <label className="sidebar-action-button" htmlFor="load-session-pdf-main" title="Load Session from File (.pdf)" style={{ cursor: "pointer", margin: "0" }}>
                <FontAwesomeIcon icon={faFolderOpen} />
              </label>
              <input type="file" id="load-session-pdf-main" accept=".pdf" style={{ display: "none" }} onChange={handleLoadFromFile} />
              <label className="dark-mode-toggle">
                <input type="checkbox" checked={isDarkMode} onChange={() => setIsDarkMode(!isDarkMode)} />
                <span className="slider"></span>
              </label>
            </div>
          </div>

          <div className="results-workflow-container">
            <aside className="results-sidebar">
              <div className="sidebar-header" style={{ alignItems: "flex-end" }}>
                <div className="session-controls">
                  <label htmlFor="session-select">Analysis Session</label>
                  <select
                    id="session-select"
                    className="session-selector"
                    value={selectedSessionId || ""}
                    onChange={(e) => {
                      const newId = Number(e.target.value);
                      setSelectedSessionId(newId);
                      const sess = sessions.find(s => s.id === newId);
                      setSelectedTestPointId(sess?.testPoints?.[0]?.id || null);
                    }}
                  >
                    {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="session-actions">
                  <button onClick={handleAddNewSession} title="Add New Session" className="sidebar-action-button"><FontAwesomeIcon icon={faPlus} /></button>
                  <button onClick={() => setEditingSession(currentSessionData)} title="Edit Session" className="sidebar-action-button"><FontAwesomeIcon icon={faEdit} /></button>
                  <button onClick={() => handleDeleteSession(selectedSessionId)} title="Delete Session" className="sidebar-action-button delete"><FontAwesomeIcon icon={faTrashAlt} /></button>
                </div>
              </div>

              <div className="sidebar-header">
                <h4 style={{ margin: "0" }}>Measurement Points</h4>
                <div className="add-point-controls">
                  <button className="add-point-button" onClick={() => setIsAddModalOpen(true)} title="Add New Measurement Point"><FontAwesomeIcon icon={faPlus} /></button>
                </div>
              </div>

              <div className="measurement-point-list">
                {currentTestPoints.map((tp) => (
                  <button
                    key={tp.id}
                    onClick={() => setSelectedTestPointId(tp.id)}
                    className={`measurement-point-item ${selectedTestPointId === tp.id ? "active" : ""}`}
                    // --- CHANGED: Added onDoubleClick handler ---
                    onDoubleClick={() => setEditingTestPoint(tp)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({
                        x: e.pageX,
                        y: e.pageY,
                        items: [
                          { label: "Edit Details", action: () => setEditingTestPoint(tp), icon: faPencilAlt },
                          { label: "Edit Tolerances", action: () => { setSelectedTestPointId(tp.id); setIsToleranceModalOpen(true); }, icon: faSlidersH },
                          { type: "divider" },
                          { label: "View Details", action: () => setInfoModalPoint({ ...tp, uutTolerance: currentSessionData.uutTolerance, uutDescription: currentSessionData.uutDescription }), icon: faInfoCircle },
                          { type: "divider" },
                          { label: "Delete Point", action: () => handleDeleteTestPoint(tp.id), icon: faTrashAlt, className: "destructive" },
                        ],
                      });
                    }}
                  >
                    <span className="measurement-point-content">
                      <span className="point-main">{tp.testPointInfo.parameter.name}: {tp.testPointInfo.parameter.value} {tp.testPointInfo.parameter.unit}</span>
                      {tp.testPointInfo.qualifier?.value && <span className="point-qualifier">@{tp.testPointInfo.qualifier.value}{tp.testPointInfo.qualifier.unit}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <main className="results-content">
              {testPointData ? (
                <TestPointDetailView key={selectedTestPointId} testPointData={testPointData}>
                  <Analysis
                    sessionData={currentSessionData}
                    testPointData={testPointData}
                    onDataSave={updateTestPointData}
                    defaultTestPoint={defaultTestPoint}
                    setContextMenu={setContextMenu}
                    setBreakdownPoint={setBreakdownPoint}
                    handleOpenSessionEditor={handleOpenSessionEditor}
                    riskResults={riskResults}
                    setRiskResults={setRiskResults}
                    onDeleteTmdeDefinition={handleDeleteTmdeDefinition}
                    onDecrementTmdeQuantity={decrementTmdeQuantity}
                    onOpenOverview={() => setIsOverviewOpen(true)}
                  />
                </TestPointDetailView>
              ) : (
                <div className="placeholder-content">
                  {currentSessionData && currentTestPoints.length > 0 ? (
                    <h3>Select a measurement point to see details.</h3>
                  ) : currentSessionData ? (
                    <><h3>This session has no measurement points.</h3><p>Click the '+' button in the sidebar to add one.</p></>
                  ) : (
                    <><h3>No Session Available</h3><p>Create a new session to begin your analysis.</p></>
                  )}
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}

export default App;