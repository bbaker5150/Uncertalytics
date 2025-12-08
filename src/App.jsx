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
import InstrumentBuilderModal from "./components/InstrumentBuilderModal";

// --- Floating Tools ---
import FloatingNotepad from "./components/FloatingNotepad";
import UnitConverter from "./components/UnitConverter";

// --- Utils & Hooks ---
import useSessionManager from "./hooks/useSessionManager";
import { saveSessionToPdf, parseSessionPdf } from "./utils/fileIo";
import "./App.css";

// --- Icons ---
import appLogo from './assets/icon.svg';
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
  faPalette,
  faStickyNote,
  faRightLeft,
  faRadio,
} from "@fortawesome/free-solid-svg-icons";

// --- Contexts ---
const ThemeContext = React.createContext(false);
export const useTheme = () => React.useContext(ThemeContext);

function App() {
  const {
    sessions,
    instruments, // <--- Access instruments
    saveInstrument,
    deleteInstrument,
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
    dbPath,
    selectDatabaseFolder,
    disconnectDatabase,
    migrateToDisk,
    saveSessionImage,
    loadSessionImages,
    deleteSessionImage
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
  
  // --- Floating Tools State ---
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [isConverterOpen, setIsConverterOpen] = useState(false);
  const [isInstrumentBuilderOpen, setIsInstrumentBuilderOpen] = useState(false);

  // --- Theme & Dark Mode State ---
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentTheme, setCurrentTheme] = useState("default");
  // Easter egg state to hide/show the theme selector
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  const [initialSessionTab, setInitialSessionTab] = useState("details");
  const [initialTmdeToEdit, setInitialTmdeToEdit] = useState(null);
  const [sessionImageCache, setSessionImageCache] = useState(new Map());
  const [riskResults, setRiskResults] = useState(null);

  // --- Hotkey Listener for Migration (Ctrl + Shift + M) ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        console.log("Migration Hotkey Triggered");
        migrateToDisk();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [migrateToDisk]);

  // --- Hotkey Listener for Theme Easter Egg (Ctrl + Shift + T) ---
  useEffect(() => {
    const handleThemeKey = (e) => {
      // Check for Ctrl + Shift + T (case insensitive)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        console.log("Theme Easter Egg Triggered");
        setShowThemeSelector(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleThemeKey);
    return () => window.removeEventListener('keydown', handleThemeKey);
  }, []);

  // --- Theme Effect ---
  useEffect(() => {
    const body = document.body;
    body.classList.remove("theme-glass", "theme-cyberpunk", "theme-stranger");

    if (currentTheme !== "default") {
      body.classList.add(currentTheme);
    }

    if (isDarkMode) {
      body.classList.add("dark-mode");
    } else {
      body.classList.remove("dark-mode");
    }

    if (window.require) {
      try {
        const { ipcRenderer } = window.require("electron");
        ipcRenderer.send("set-theme", isDarkMode ? "dark" : "light");
      } catch (error) {
        console.warn("Could not connect to Electron IPC", error);
      }
    }
  }, [isDarkMode, currentTheme]);

  // --- Handlers ---

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

  const handleSessionChange = async (updatedSession, newImageFiles = []) => {
    updateSession(updatedSession, newImageFiles);
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

  // --- Sync Notepad to Session Data ---
  const handleUpdateNotes = (newNotes) => {
    if (!currentSessionData) return;
    const updatedSession = { ...currentSessionData, notes: newNotes };
    updateSession(updatedSession);
  };

  // --- Instrument Saver ---
  const handleSaveInstrument = (instrument) => {
      saveInstrument(instrument);
      setIsInstrumentBuilderOpen(false);
      setAppNotification({ title: "Success", message: `Instrument "${instrument.model}" saved.` });
  };

  const handleOpenSessionEditor = async (initialTab = "details", tmdeToEdit = null) => {
    setInitialSessionTab(initialTab);
    setInitialTmdeToEdit(tmdeToEdit);
    
    if (currentSessionData) {
        setEditingSession(currentSessionData);
        const cachedMap = sessionImageCache.get(currentSessionData.id);
        if (!cachedMap || cachedMap.size === 0) {
            try {
                const imagesFromDb = await loadSessionImages(currentSessionData.id);
                if (imagesFromDb && imagesFromDb.length > 0) {
                    setSessionImageCache(prev => {
                        const newCache = new Map(prev);
                        const sessionMap = new Map();
                        imagesFromDb.forEach(img => sessionMap.set(img.id, img.data));
                        newCache.set(currentSessionData.id, sessionMap);
                        return newCache;
                    });
                }
            } catch (e) {
                console.error("Failed to load images", e);
            }
        }
    }
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

        {/* --- FLOATING TOOLS --- */}
        {currentSessionData && (
          <>
            <FloatingNotepad 
              isOpen={isNotepadOpen}
              onClose={() => setIsNotepadOpen(false)}
              notes={currentSessionData.notes || ""}
              onSave={handleUpdateNotes}
            />
            <UnitConverter 
                isOpen={isConverterOpen} 
                onClose={() => setIsConverterOpen(false)} 
            />
          </>
        )}

        {/* --- INSTRUMENT BUILDER MODAL --- */}
        <InstrumentBuilderModal 
            isOpen={isInstrumentBuilderOpen}
            onClose={() => setIsInstrumentBuilderOpen(false)}
            onSave={handleSaveInstrument}
            onDelete={deleteInstrument}
            instruments={instruments} 
        />

        {confirmationModal && (
          <div className="modal-overlay" style={{ zIndex: 2001 }}>
            <div className="modal-content">
              <button
                onClick={() => setConfirmationModal(null)}
                className="modal-close-button"
              >
                &times;
              </button>
              <h3>{confirmationModal.title}</h3>
              <p>{confirmationModal.message}</p>
              <div
                className="modal-actions"
                style={{ justifyContent: "center", gap: "15px" }}
              >
                <button
                  className="button"
                  style={{ backgroundColor: "var(--status-bad)" }}
                  onClick={confirmationModal.onConfirm}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
        <AddTestPointModal
          isOpen={isAddModalOpen || !!editingTestPoint}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingTestPoint(null);
          }}
          onSave={handleSaveTestPoint}
          initialData={editingTestPoint}
          hasExistingPoints={currentTestPoints.length > 0}
          previousTestPointData={
            currentTestPoints.length > 0
              ? currentTestPoints[currentTestPoints.length - 1]
              : null
          }
        />
        <EditSessionModal
          isOpen={!!editingSession}
          onClose={() => {
            setEditingSession(null);
            setInitialTmdeToEdit(null);
            setInitialSessionTab("details");
          }}
          sessionData={editingSession}
          onSave={handleSessionChange}
          onSaveToFile={handleSaveToFile}
          handleLoadFromFile={handleLoadFromFile}
          initialSection={initialSessionTab}
          sessionImageCache={sessionImageCache}
          onImageCacheChange={setSessionImageCache}
          onRemoveImageFile={deleteSessionImage}
          instruments={instruments} // <--- Pass Instruments Here
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
                setSessions((prev) =>
                  prev.map((s) =>
                    s.id === selectedSessionId ? { ...s, uutTolerance } : s
                  )
                );
              }
              updateTestPointData(testPointSpecificData);
            }}
            testPointData={testPointData}
          />
        )}
        <FullBreakdownModal
          isOpen={!!breakdownPoint}
          breakdownData={breakdownPoint}
          onClose={() => setBreakdownPoint(null)}
        />
        <TestPointInfoModal
          isOpen={!!infoModalPoint}
          testPoint={infoModalPoint}
          onClose={() => setInfoModalPoint(null)}
        />
        {contextMenu && (
          <ContextMenu
            menu={contextMenu}
            onClose={() => setContextMenu(null)}
          />
        )}

        <div className="content-area uncertainty-analysis-page">
          {/* ======================================================= */}
          {/* PROFESSIONAL HEADER BAR                                 */}
          {/* ======================================================= */}
          <div className="app-pro-header">
            {/* 1. LEFT: IDENTITY */}
            <div className="header-identity">
              <div className="app-logo-mark custom-logo full-bleed">
                <img src={appLogo} alt="App Logo" />
              </div>
              <div className="app-title-group">
                <h2>Uncertalytics</h2>
                <div className="app-subtitle-row">
                  <span className="app-subtitle">Risk Analysis Tool</span>
                  <span className="app-version">v1.0.0</span>
                </div>
              </div>
            </div>

            {/* 2. RIGHT: ACTION RIBBON */}
            <div className="header-actions">
              {/* STATUS INDICATOR (Primary Context) */}
              <button
                className={`status-pill ${
                  dbPath ? "connected" : "disconnected"
                }`}
                onClick={dbPath ? disconnectDatabase : selectDatabaseFolder}
                title={dbPath ? `Connected: ${dbPath}` : "Connect to Database"}
              >
                <span className="status-dot"></span>
                <span className="status-text">
                  {dbPath ? "Database Connected" : "Local Mode"}
                </span>
              </button>

              <div className="header-divider"></div>

              {/* FLOATING TOOLS ACTIONS */}
              <div className="action-group">
                <button
                  className={`icon-action-btn ${isNotepadOpen ? "active" : ""}`}
                  onClick={() => setIsNotepadOpen(!isNotepadOpen)}
                  title="Session Notes"
                >
                  <FontAwesomeIcon icon={faStickyNote} />
                </button>

                <button
                  className={`icon-action-btn ${isConverterOpen ? "active" : ""}`}
                  onClick={() => setIsConverterOpen(!isConverterOpen)}
                  title="Unit Converter"
                >
                  <FontAwesomeIcon icon={faRightLeft} />
                </button>

                {/* --- INSTRUMENT BUILDER --- */}
                <button
                  className={`icon-action-btn ${isInstrumentBuilderOpen ? "active" : ""}`}
                  onClick={() => setIsInstrumentBuilderOpen(true)}
                  title="Instrument Builder"
                >
                  <FontAwesomeIcon icon={faRadio} />
                </button>
              </div>

              <div className="header-divider"></div>

              {/* FILE ACTIONS */}
              <div className="action-group">
                <button
                  className="icon-action-btn"
                  onClick={handleSaveToFile}
                  title="Export to PDF"
                >
                  <FontAwesomeIcon icon={faSave} />
                </button>

                <label
                  className="icon-action-btn"
                  htmlFor="load-session-pdf-main"
                  title="Import PDF"
                >
                  <FontAwesomeIcon icon={faFolderOpen} />
                </label>
                <input
                  type="file"
                  id="load-session-pdf-main"
                  accept=".pdf"
                  style={{ display: "none" }}
                  onChange={handleLoadFromFile}
                />
              </div>

              <div className="header-divider"></div>

              {/* SETTINGS GROUP */}
              <div className="action-group">
                {/* --- THEME SELECTOR (HIDDEN BY DEFAULT - Ctrl+Shift+T) --- */}
                {showThemeSelector && (
                  <div className="theme-selector-minimal">
                    <FontAwesomeIcon icon={faPalette} className="theme-icon" />
                    <select 
                      value={currentTheme} 
                      onChange={(e) => setCurrentTheme(e.target.value)}
                      className="theme-select-input"
                      title="Change Theme"
                    >
                      <option value="default">Default</option>
                      <option value="theme-cyberpunk">Cyberpunk</option>
                      <option value="theme-stranger">Stranger Things</option>
                      <option value="theme-glass">Aero Glass</option>
                    </select>
                  </div>
                )}

                {/* --- DARK MODE TOGGLE LOGIC --- */}
                {currentTheme === 'theme-stranger' && !isDarkMode ? (
                  /* CASE 1: Stranger Things Light Mode -> Show EASTER EGG ONLY */
                  <div 
                    className="stranger-hint" 
                    onClick={() => setIsDarkMode(true)}
                    title="Enter the Upside Down"
                  >
                    <span>ENTER THE UPSIDE DOWN</span>
                  </div>
                ) : (
                  /* CASE 2: All Other Modes -> Show Standard Toggle */
                  <button 
                    className={`icon-action-btn ${isDarkMode ? "active" : ""}`}
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    title="Toggle Dark Mode"
                  >
                    <div className={`moon-toggle ${isDarkMode ? "is-dark" : ""}`}></div>
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* ======================================================= */}

          <div className="results-workflow-container">
            <aside className="results-sidebar">
              {/* ... Sidebar Content ... */}
              <div
                className="sidebar-header"
                style={{ alignItems: "flex-end" }}
              >
                <div className="session-controls">
                  <label htmlFor="session-select">Analysis Session</label>
                  <select
                    id="session-select"
                    className="session-selector"
                    value={selectedSessionId || ""}
                    onChange={(e) => {
                      const newId = Number(e.target.value);
                      setSelectedSessionId(newId);
                      const sess = sessions.find((s) => s.id === newId);
                      setSelectedTestPointId(sess?.testPoints?.[0]?.id || null);
                    }}
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="session-actions">
                  <button
                    onClick={handleAddNewSession}
                    title="Add New Session"
                    className="sidebar-action-button"
                  >
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                  <button
                    onClick={() => handleOpenSessionEditor("details")}
                    title="Edit Session"
                    className="sidebar-action-button"
                  >
                    <FontAwesomeIcon icon={faEdit} />
                  </button>
                  <button
                    onClick={() => handleDeleteSession(selectedSessionId)}
                    title="Delete Session"
                    className="sidebar-action-button delete"
                  >
                    <FontAwesomeIcon icon={faTrashAlt} />
                  </button>
                </div>
              </div>

              <div className="sidebar-header">
                <h4 style={{ margin: "0" }}>Measurement Points</h4>
                <div className="add-point-controls">
                  <button
                    className="add-point-button"
                    onClick={() => setIsAddModalOpen(true)}
                    title="Add New Measurement Point"
                  >
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                </div>
              </div>

              <div className="measurement-point-list">
                {currentTestPoints.map((tp) => (
                  <button
                    key={tp.id}
                    onClick={() => setSelectedTestPointId(tp.id)}
                    className={`measurement-point-item ${
                      selectedTestPointId === tp.id ? "active" : ""
                    }`}
                    onDoubleClick={() => setEditingTestPoint(tp)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({
                        x: e.pageX,
                        y: e.pageY,
                        items: [
                          {
                            label: "Edit Details",
                            action: () => setEditingTestPoint(tp),
                            icon: faPencilAlt,
                          },
                          {
                            label: "Edit Tolerances",
                            action: () => {
                              setSelectedTestPointId(tp.id);
                              setIsToleranceModalOpen(true);
                            },
                            icon: faSlidersH,
                          },
                          { type: "divider" },
                          {
                            label: "View Details",
                            action: () =>
                              setInfoModalPoint({
                                ...tp,
                                uutTolerance: currentSessionData.uutTolerance,
                                uutDescription:
                                  currentSessionData.uutDescription,
                              }),
                            icon: faInfoCircle,
                          },
                          { type: "divider" },
                          {
                            label: "Delete Point",
                            action: () => handleDeleteTestPoint(tp.id),
                            icon: faTrashAlt,
                            className: "destructive",
                          },
                        ],
                      });
                    }}
                  >
                    <span className="measurement-point-content">
                      <span className="point-main">
                        {tp.testPointInfo.parameter.name}:{" "}
                        {tp.testPointInfo.parameter.value}{" "}
                        {tp.testPointInfo.parameter.unit}
                      </span>
                      {tp.testPointInfo.qualifier?.value && (
                        <span className="point-qualifier">
                          @{tp.testPointInfo.qualifier.value}
                          {tp.testPointInfo.qualifier.unit}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <main className="results-content">
              {testPointData ? (
                <TestPointDetailView
                  key={selectedTestPointId}
                  testPointData={testPointData}
                >
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
                    instruments={instruments} // <--- Pass Instruments Here
                  />
                </TestPointDetailView>
              ) : (
                <div className="placeholder-content">
                  {currentSessionData && currentTestPoints.length > 0 ? (
                    <h3>Select a measurement point to see details.</h3>
                  ) : currentSessionData ? (
                    <>
                      <h3>This session has no measurement points.</h3>
                      <p>Click the '+' button in the sidebar to add one.</p>
                    </>
                  ) : (
                    <>
                      <h3>No Session Available</h3>
                      <p>Create a new session to begin your analysis.</p>
                    </>
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