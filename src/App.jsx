import React, { useState, useMemo, useEffect } from "react";

// --- Components ---
import Analysis from "./features/analysis/Analysis";
import NotificationModal from "./components/modals/NotificationModal";
import AddTestPointModal from "./features/testPoints/components/AddTestPointModal";
import TestPointDetailView from "./features/testPoints/components/TestPointDetailView";
import ToleranceToolModal from "./features/testPoints/components/ToleranceToolModal";
import EditSessionModal from "./features/session/components/EditSessionModal";
import OverviewModal from "./features/session/components/OverviewModal";
import ContextMenu from "./components/common/ContextMenu";
import FullBreakdownModal from "./features/analysis/components/BreakdownModals/FullBreakdownModal";
import TestPointInfoModal from "./features/testPoints/components/TestPointInfoModal";
import InstrumentBuilderModal from "./features/instruments/components/InstrumentBuilderModal";
import UnresolvedToleranceModal from "./features/testPoints/components/UnresolvedToleranceModal";

// --- Floating Tools ---
import FloatingNotepad from "./components/tools/FloatingNotepad";
import UnitConverter from "./components/tools/UnitConverter";
import ReverseTraceabilityTool from "./components/tools/ReverseTraceabilityTool";

// --- Utils & Hooks ---
import useSessionManager from "./hooks/useSessionManager";
import { saveSessionToPdf, parseSessionPdf } from "./utils/fileIo";
import { findInstrumentTolerance, findMatchingTolerances, getToleranceSummary, recalculateTolerance } from "./utils/uncertaintyMath"; 
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
  faHistory
} from "@fortawesome/free-solid-svg-icons";

const ThemeContext = React.createContext(false);
export const useTheme = () => React.useContext(ThemeContext);


const generateDiffMessage = (changes, missing) => (
  <div>
    {changes.length > 0 && (
      <>
        <p style={{ marginBottom: "10px", color: "var(--text-color)" }}>
          The following instruments were updated based on the library:
        </p>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "1.5fr 1fr 1fr", 
          gap: "10px", 
          fontSize: "0.85rem",
          background: "var(--background-secondary)",
          padding: "10px",
          borderRadius: "4px",
          marginBottom: "15px"
        }}>
          <div style={{ fontWeight: "bold", borderBottom: "1px solid var(--border-color)", paddingBottom: "5px" }}>Instrument</div>
          <div style={{ fontWeight: "bold", borderBottom: "1px solid var(--border-color)", paddingBottom: "5px" }}>Old Spec</div>
          <div style={{ fontWeight: "bold", borderBottom: "1px solid var(--border-color)", paddingBottom: "5px" }}>New Spec</div>
          {changes.map((c, i) => (
            <React.Fragment key={i}>
              <div style={{alignSelf: "center", fontWeight: "500"}}>{c.name}</div>
              <div style={{ color: "var(--text-color-muted)" }}>{c.oldSpec}</div>
              <div style={{ color: "var(--primary-color)", fontWeight: "500" }}>{c.newSpec}</div>
            </React.Fragment>
          ))}
        </div>
      </>
    )}

    {missing.length > 0 && (
      <>
        <p style={{ marginBottom: "10px", color: "var(--status-warning)" }}>
          <strong>Attention Needed:</strong> No library data found for the following instruments at the new value.
          <br />They will be created with <u>empty specifications</u> for you to fill in manually.
        </p>
        <ul style={{ 
          fontSize: "0.9rem", 
          background: "rgba(255, 193, 7, 0.1)", 
          border: "1px solid var(--status-warning)",
          borderRadius: "4px",
          padding: "10px 10px 10px 30px",
          margin: 0
        }}>
          {missing.map((m, i) => (
            <li key={i} style={{ marginBottom: "4px" }}>
              <strong>{m.name}</strong>: No spec found for {m.target}
            </li>
          ))}
        </ul>
      </>
    )}
  </div>
);


function App() {
  const {
    sessions,
    instruments, 
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
  const [unresolvedToleranceModal, setUnresolvedToleranceModal] = useState(null);

  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [isConverterOpen, setIsConverterOpen] = useState(false);
  const [isTraceabilityOpen, setIsTraceabilityOpen] = useState(false);
  const [isInstrumentBuilderOpen, setIsInstrumentBuilderOpen] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentTheme, setCurrentTheme] = useState("default");
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  const [initialSessionTab, setInitialSessionTab] = useState("details");
  const [initialTmdeToEdit, setInitialTmdeToEdit] = useState(null);
  const [sessionImageCache, setSessionImageCache] = useState(new Map());
  const [riskResults, setRiskResults] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        migrateToDisk();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [migrateToDisk]);

  useEffect(() => {
    const handleThemeKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setShowThemeSelector(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleThemeKey);
    return () => window.removeEventListener('keydown', handleThemeKey);
  }, []);

  useEffect(() => {
    const body = document.body;
    body.classList.remove("theme-orbital", "theme-cyberpunk", "theme-stranger");
    if (currentTheme !== "default") body.classList.add(currentTheme);
    if (isDarkMode) body.classList.add("dark-mode");
    else body.classList.remove("dark-mode");
    if (window.require) {
      try {
        const { ipcRenderer } = window.require("electron");
        ipcRenderer.send("set-theme", isDarkMode ? "dark" : "light");
      } catch (error) { console.warn("Could not connect to Electron IPC", error); }
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

  const handleUpdateNotes = (newNotes) => {
    if (!currentSessionData) return;
    const updatedSession = { ...currentSessionData, notes: newNotes };
    updateSession(updatedSession);
  };

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

  // --- UPDATED: Handle Save Test Point with Confirmation Logic ---
  const handleSaveTestPoint = (formData) => {
    const finalData = { ...formData };
    
    // 1. Identify what needs to be checked (UUT, TMDEs)
    const checks = []; // Queue of items to resolve { type: 'uut'|'tmde', ... }
    
    // - Check UUT
    const targetValue = finalData.testPointInfo.parameter.value;
    const targetUnit = finalData.testPointInfo.parameter.unit;
    
    // Determine if we need to check UUT (only if uutInstrument exists and we have a value)
    if (currentSessionData.uutInstrument && targetValue) {
        checks.push({
            type: 'uut',
            instrument: currentSessionData.uutInstrument,
            name: currentSessionData.uutDescription || "Unit Under Test",
            targetValue,
            targetUnit,
            existingSpec: finalData.uutTolerance || currentSessionData.uutTolerance
        });
    }

    // - Check TMDEs (Only if copying from previous or explicitly needed)
    // Logic: If new point (no ID) and copyTmdes is true, we look at previous point's TMDEs
    if (!formData.id && currentTestPoints.length > 0 && finalData.copyTmdes) {
        const previousPoint = currentTestPoints[currentTestPoints.length - 1];
        if ((!finalData.tmdeTolerances || finalData.tmdeTolerances.length === 0) && previousPoint.tmdeTolerances) {
             previousPoint.tmdeTolerances.forEach((tmde, idx) => {
                 let tmdeVal = targetValue;
                 let tmdeUnit = targetUnit;
                 
                 if (finalData.measurementType === 'derived') {
                     tmdeVal = tmde.measurementPoint?.value;
                     tmdeUnit = tmde.measurementPoint?.unit;
                 }
                 
                 // Reuse ID if available, or generate a check ID
                 const checkId = tmde.id || `tmde-check-${idx}`;

                 if (tmde.sourceInstrument && tmdeVal) {
                      checks.push({
                          type: 'tmde',
                          id: checkId, 
                          originalTmde: tmde,
                          instrument: tmde.sourceInstrument,
                          name: tmde.name,
                          targetValue: tmdeVal,
                          targetUnit: tmdeUnit
                      });
                 }
             });
        }
    }
    
    // 2. Recursive function to process the queue
    const processNextCheck = (index, resolvedSpecsMap) => { 
        if (index >= checks.length) {
            // ALL DONE -> Final Save
            performFinalSave(resolvedSpecsMap, checks);
            return;
        }

        const check = checks[index];
        const { instrument, targetValue, targetUnit, name } = check;

        // Find matches
        const matches = findMatchingTolerances(instrument, targetValue, targetUnit);

        const mapKey = check.type === 'uut' ? 'uut' : check.id;

        if (matches && matches.length > 1) {
            // AMBIGUITY -> Prompt User
            setUnresolvedToleranceModal({
                instrumentName: name,
                matches: matches,
                onSelect: (selectedSpec) => {
                     setUnresolvedToleranceModal(null);
                     // Recursive call with resolved spec
                     processNextCheck(index + 1, { ...resolvedSpecsMap, [mapKey]: selectedSpec });
                }
            });
            // Stop execution here. Modal callback handles the rest.
            return; 

        } else if (matches && matches.length === 1) {
            // SINGLE MATCH -> Auto-select
            processNextCheck(index + 1, { ...resolvedSpecsMap, [mapKey]: matches[0] });

        } else {
             // NO MATCH -> Record as missing
             processNextCheck(index + 1, { ...resolvedSpecsMap, [mapKey]: null });
        }
    };

    // 3. Final Save Logic
    const performFinalSave = (resolvedMap, checksProcessed) => {
         const changes = [];
         const missing = [];
         let uutFinal = null;
         
         // Apply UUT Results
         const uutCheck = checksProcessed.find(c => c.type === 'uut');
         if (uutCheck) {
             const resolved = resolvedMap['uut'];
             if (resolved) {
                 const newSpecs = recalculateTolerance(uutCheck.instrument, uutCheck.targetValue, uutCheck.targetUnit, resolved);
                 if (newSpecs) {
                     const oldSummary = getToleranceSummary(uutCheck.existingSpec);
                     const newSummary = getToleranceSummary(newSpecs);
                     
                     // Only register change if actually different (and valid)
                     if (oldSummary && newSummary && oldSummary !== newSummary) {
                         changes.push({ 
                             name: uutCheck.name, 
                             oldSpec: oldSummary, 
                             newSpec: newSummary 
                         });
                     }
                     uutFinal = newSpecs;
                 }
             } else {
                 // Missing
                 missing.push({ 
                     name: uutCheck.name, 
                     target: `${uutCheck.targetValue} ${uutCheck.targetUnit}` 
                 });
                 // Reset if missing
                 finalData.uutTolerance = {};
             }
         }
         
         if (uutFinal) {
             finalData.uutTolerance = uutFinal;
         }

         // Apply TMDE Results
         const tmdeChecks = checksProcessed.filter(c => c.type === 'tmde');
         if (tmdeChecks.length > 0) {
              const newTmdes = tmdeChecks.map((check, i) => {
                  const resolved = resolvedMap[check.id];
                  
                  if (resolved) {
                       const newSpecs = recalculateTolerance(check.instrument, check.targetValue, check.targetUnit, resolved);
                       if (newSpecs) {
                           const oldSummary = getToleranceSummary(check.originalTmde);
                           const newSummary = getToleranceSummary(newSpecs);
                           
                           if (oldSummary && newSummary && oldSummary !== newSummary) {
                                changes.push({ 
                                    name: check.name, 
                                    oldSpec: oldSummary, 
                                    newSpec: newSummary 
                                });
                           }
                           
                           return {
                               ...newSpecs,
                               measurementPoint: { value: check.targetValue, unit: check.targetUnit },
                               id: Date.now() + Math.random() + i,
                               name: check.name, // FIX: Ensure Name is preserved
                               isTmde: true      // FIX: Flag as TMDE to suppress resolution in budget
                           };
                       }
                  } 
                  
                  // If resolved is null OR recalculate failed
                  if (!resolved && check.instrument) {
                       missing.push({ 
                           name: check.name, 
                           target: `${check.targetValue} ${check.targetUnit}` 
                       });
                  }
                  
                  // Clean fallback for missing/failed
                  const cleanTmde = { ...check.originalTmde };
                  ['reading', 'range', 'floor', 'readings_iv', 'db', 'tolerance', 'tolerances', 'measuringResolution', 'uncertainty', 'k'].forEach(k => delete cleanTmde[k]);
                  return {
                     ...cleanTmde,
                     measurementPoint: { value: check.targetValue, unit: check.targetUnit },
                     id: Date.now() + Math.random() + i,
                     rangeMax: "",
                     isTmde: true // Ensure flag exists on fallback too
                  };
              });
              
              finalData.tmdeTolerances = newTmdes;
         }

         // Notification / Final Save Logic
         if (changes.length > 0 || missing.length > 0) {
            setAppNotification({
                title: missing.length > 0 ? "Manual Entry Required" : "Update Tolerances?",
                message: generateDiffMessage(changes, missing),
                confirmText: missing.length > 0 ? "Save & Edit Specs" : "Update & Save",
                cancelText: "Cancel",
                onConfirm: () => {
                   saveTestPoint(finalData, null);
                   setAppNotification(null);
                   setIsAddModalOpen(false); // Close the Add Modal
                   setEditingTestPoint(null); // Clear editing state
                   
                   if (missing.length > 0) {
                       setTimeout(() => {
                           setIsToleranceModalOpen(true);
                       }, 200);
                   }
                },
                onClose: () => setAppNotification(null)
            });
         } else {
             saveTestPoint(finalData, null);
             setAppNotification(null);
             setIsAddModalOpen(false);
             setEditingTestPoint(null);
         }
    };

    // Kick off the queue processing
    processNextCheck(0, {});
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
  
  const handleDeleteUut = () => {
    setConfirmationModal({
      title: "Delete UUT",
      message: "Are you sure you want to delete the UUT definition? This will remove the UUT specifications from this session.",
      onConfirm: () => {
        if (currentSessionData) {
            updateSession({
                ...currentSessionData,
                uutDescription: "",
                uutTolerance: {},
                uutInstrument: null 
            });
        }
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

    // FIX: Prioritize point-specific tolerance if it exists (even if empty)
    // Only fall back to session/auto-calc if pointData.uutTolerance is explicitly null/undefined (Legacy/Default)
    let effectiveUutTolerance = (pointData.uutTolerance !== null && pointData.uutTolerance !== undefined)
        ? pointData.uutTolerance 
        : currentSessionData.uutTolerance;

    // Only attempt auto-calculation/inheritance if we are using session defaults (i.e., pointData.uutTolerance was null)
    if ((pointData.uutTolerance === null || pointData.uutTolerance === undefined) && currentSessionData.uutInstrument && pointData.testPointInfo?.parameter?.value) {
        const autoSpecs = recalculateTolerance(
            currentSessionData.uutInstrument, 
            pointData.testPointInfo.parameter.value, 
            pointData.testPointInfo.parameter.unit,
            currentSessionData.uutTolerance
        );
        if (autoSpecs) {
            effectiveUutTolerance = autoSpecs;
        }
    }

    return {
      ...pointData,
      uutDescription: currentSessionData.uutDescription,
      uutTolerance: effectiveUutTolerance,
    };
  }, [currentSessionData, selectedTestPointId, currentTestPoints]);

  return (
    <ThemeContext.Provider value={isDarkMode}>
      <div className="App">
        <NotificationModal
          isOpen={!!appNotification}
          onClose={() => {
              if (appNotification?.onClose) appNotification.onClose();
              setAppNotification(null);
          }}
          title={appNotification?.title}
          message={appNotification?.message}
          confirmText={appNotification?.confirmText}
          cancelText={appNotification?.cancelText}
          onConfirm={appNotification?.onConfirm}
        />

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
            <ReverseTraceabilityTool
              isOpen={isTraceabilityOpen}
              onClose={() => setIsTraceabilityOpen(false)}
            />
          </>
        )}

        <UnresolvedToleranceModal
            isOpen={!!unresolvedToleranceModal}
            matches={unresolvedToleranceModal?.matches}
            instrumentName={unresolvedToleranceModal?.instrumentName}
            onSelect={(selected) => {
                unresolvedToleranceModal.onSelect(selected);
            }}
            onClose={() => setUnresolvedToleranceModal(null)}
        />

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
          instruments={instruments} 
        />
        <OverviewModal
          isOpen={isOverviewOpen}
          onClose={() => setIsOverviewOpen(false)}
          sessionData={currentSessionData}
          onUpdateTestPoint={handleUpdateSpecificTestPoint}
          onDeleteTmdeDefinition={deleteTmdeDefinition}
          onDecrementTmdeQuantity={decrementTmdeQuantity}
          instruments={instruments} 
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
          <div className="app-pro-header">
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

            <div className="header-actions">
                <button
                  className={`icon-action-btn ${isInstrumentBuilderOpen ? "active" : ""}`}
                  onClick={() => setIsInstrumentBuilderOpen(!isInstrumentBuilderOpen)}
                  title="Instrument Builder"
                >
                  <FontAwesomeIcon icon={faRadio} />
                </button>
              <div className="header-divider"></div>

              <div className="action-group">
                <button
                  className={`icon-action-btn ${isTraceabilityOpen ? "active" : ""}`}
                  onClick={() => setIsTraceabilityOpen(!isTraceabilityOpen)}
                  title="Reverse Traceability Tool"
                >
                  <FontAwesomeIcon icon={faHistory} />
                </button>

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
              </div>

              <div className="header-divider"></div>

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

              <div className="action-group">
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
                      <option value="theme-orbital">Orbit</option>
                    </select>
                  </div>
                )}
                {currentTheme === 'theme-stranger' && !isDarkMode ? (
                  <div
                    className="stranger-hint"
                    onClick={() => setIsDarkMode(true)}
                    title="Enter the Upside Down"
                  >
                    <span>ENTER THE UPSIDE DOWN</span>
                  </div>
                ) : (
                  <button
                    className={`icon-action-btn ${isDarkMode ? "active" : ""}`}
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    title="Toggle Dark Mode"
                  >
                    <div className={`moon-toggle ${isDarkMode ? "is-dark" : ""}`}></div>
                  </button>
                )}
              </div>
              <button
                className={`status-pill ${dbPath ? "connected" : "disconnected"
                  }`}
                onClick={dbPath ? disconnectDatabase : selectDatabaseFolder}
                title={dbPath ? `Connected: ${dbPath}` : "Connect to Database"}
              >
                <span className="status-dot"></span>
                <span className="status-text">
                  {dbPath ? "Database Connected" : "Local Mode"}
                </span>
              </button>
            </div>
          </div>

          <div className="results-workflow-container">
            <aside className="results-sidebar">
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
                    className={`measurement-point-item ${selectedTestPointId === tp.id ? "active" : ""
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
                    onSessionSave={updateSession} 
                    defaultTestPoint={defaultTestPoint}
                    setContextMenu={setContextMenu}
                    setBreakdownPoint={setBreakdownPoint}
                    handleOpenSessionEditor={handleOpenSessionEditor}
                    riskResults={riskResults}
                    setRiskResults={setRiskResults}
                    onDeleteTmdeDefinition={handleDeleteTmdeDefinition}
                    onDecrementTmdeQuantity={decrementTmdeQuantity}
                    onDeleteUut={handleDeleteUut} 
                    onOpenOverview={() => setIsOverviewOpen(true)}
                    instruments={instruments} 
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