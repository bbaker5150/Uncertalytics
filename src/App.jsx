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
import HelpModal from "./components/common/HelpModal";
import BugReportModal from "./components/modals/BugReportModal";

// --- Floating Tools ---
import FloatingNotepad from "./components/tools/FloatingNotepad";
import UnitConverter from "./components/tools/UnitConverter";
import ReverseTraceabilityTool from "./components/tools/ReverseTraceabilityTool";
import HeaderToolbox from "./components/HeaderToolbox";

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
  faBug,
  faQuestionCircle
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
              <div style={{ alignSelf: "center", fontWeight: "500" }}>{c.name}</div>
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
    bugReports, 
    saveInstrument,
    saveBugReport, 
    deleteBugReport,
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
  
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentTheme, setCurrentTheme] = useState("default");
  const [isToolboxCollapsed, setIsToolboxCollapsed] = useState(false);

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
    const body = document.body;
    body.classList.remove("theme-orbital", "theme-cyberpunk");
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

  useEffect(() => {
    const handleZoom = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (window.require) {
          try {
            const { webFrame } = window.require("electron");
            const currentZoom = webFrame.getZoomFactor();
            let newZoom = currentZoom;
            if (e.deltaY < 0) {
               newZoom += 0.1;
            } else {
               newZoom -= 0.1;
            }
            newZoom = Math.max(0.5, Math.min(newZoom, 3.0));
            webFrame.setZoomFactor(newZoom);
          } catch (error) {
            console.warn("Zoom adjustment failed", error);
          }
        }
      }
    };
    
    window.addEventListener("wheel", handleZoom, { passive: false });
    return () => window.removeEventListener("wheel", handleZoom);
  }, []);

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

  const handleDeleteBugReport = (reportId) => {
      setAppNotification({
          title: "Delete Report",
          message: "Are you sure you want to delete this report? This action cannot be undone.",
          confirmText: "Delete",
          cancelText: "Cancel",
          isIconConfirm: false,
          onConfirm: () => {
              deleteBugReport(reportId);
              setAppNotification(null);
          }
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

  const handleSaveTestPoint = (formData) => {
    const finalData = { ...formData };
    const checks = []; 
    const targetValue = finalData.testPointInfo.parameter.value;
    const targetUnit = finalData.testPointInfo.parameter.unit;

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

          const checkId = tmde.id || `tmde-check-${idx}`;
          checks.push({
            type: 'tmde',
            id: checkId,
            originalTmde: tmde,
            instrument: tmde.sourceInstrument || null, 
            name: tmde.name, 
            targetValue: tmdeVal,
            targetUnit: tmdeUnit
          });
        });
      }
    }

    const processNextCheck = (index, resolvedSpecsMap) => {
      if (index >= checks.length) {
        performFinalSave(resolvedSpecsMap, checks);
        return;
      }

      const check = checks[index];
      const { instrument, targetValue, targetUnit, name } = check;
      const matches = findMatchingTolerances(instrument, targetValue, targetUnit);
      const mapKey = check.type === 'uut' ? 'uut' : check.id;

      if (matches && matches.length > 1) {
        setUnresolvedToleranceModal({
          instrumentName: name,
          matches: matches,
          onSelect: (selectedSpec) => {
            setUnresolvedToleranceModal(null);
            processNextCheck(index + 1, { ...resolvedSpecsMap, [mapKey]: selectedSpec });
          }
        });
        return;
      } else if (matches && matches.length === 1) {
        processNextCheck(index + 1, { ...resolvedSpecsMap, [mapKey]: matches[0] });
      } else {
        processNextCheck(index + 1, { ...resolvedSpecsMap, [mapKey]: null });
      }
    };

    const performFinalSave = (resolvedMap, checksProcessed) => {
      const changes = [];
      const missing = [];
      let uutFinal = null;

      const uutCheck = checksProcessed.find(c => c.type === 'uut');
      if (uutCheck) {
        const resolved = resolvedMap['uut'];
        if (resolved) {
          const newSpecs = recalculateTolerance(uutCheck.instrument, uutCheck.targetValue, uutCheck.targetUnit, resolved);
          if (newSpecs) {
            const oldSummary = getToleranceSummary(uutCheck.existingSpec);
            const newSummary = getToleranceSummary(newSpecs);

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
          missing.push({
            name: uutCheck.name,
            target: `${uutCheck.targetValue} ${uutCheck.targetUnit}`
          });
          finalData.uutTolerance = {};
        }
      }

      if (uutFinal) {
        finalData.uutTolerance = uutFinal;
      }

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

              const tmdeObj = {
                ...newSpecs,
                measurementPoint: { value: check.targetValue, unit: check.targetUnit },
                id: Date.now() + Math.random() + i,
                name: check.name || check.originalTmde?.name || `${check.instrument.manufacturer} ${check.instrument.model}`,
                isTmde: true
              };
              delete tmdeObj.measuringResolution;
              return tmdeObj;
            }
          }

          if (!resolved) {
            missing.push({
              name: check.name,
              target: `${check.targetValue} ${check.targetUnit}`
            });
          }

          const fallbackObj = {
            id: Date.now() + Math.random() + i, 
            name: check.name || check.originalTmde?.name || "TMDE",
            sourceInstrument: check.originalTmde?.sourceInstrument, 
            measurementPoint: { value: check.targetValue, unit: check.targetUnit },
            isTmde: true,
            rangeMax: "" 
          };
          return fallbackObj;
        });

        finalData.tmdeTolerances = newTmdes;
      }

      if (changes.length > 0 || missing.length > 0) {
        setAppNotification({
          title: missing.length > 0 ? "Manual Entry Required" : "Update Tolerances?",
          message: generateDiffMessage(changes, missing),
          confirmText: missing.length > 0 ? "Save & Edit Specs" : "Update & Save",
          cancelText: null,
          isIconConfirm: missing.length === 0,
          onConfirm: () => {
            saveTestPoint(finalData, null);
            setAppNotification(null);
            setIsAddModalOpen(false); 
            setEditingTestPoint(null); 

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

    let effectiveUutTolerance = (pointData.uutTolerance !== null && pointData.uutTolerance !== undefined)
      ? pointData.uutTolerance
      : currentSessionData.uutTolerance;

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
        {/* CONDITIONAL RENDER: Force remount to reset position */}
        {appNotification && (
          <NotificationModal
            isOpen={true}
            onClose={() => {
              if (appNotification?.onClose) appNotification.onClose();
              setAppNotification(null);
            }}
            title={appNotification.title}
            message={appNotification.message}
            confirmText={appNotification.confirmText}
            cancelText={appNotification.cancelText}
            isIconConfirm={appNotification.isIconConfirm}
            onConfirm={appNotification.onConfirm}
          />
        )}
        
        <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
        
        <BugReportModal 
          isOpen={isBugReportOpen}
          onClose={() => setIsBugReportOpen(false)}
          reports={bugReports} 
          onSave={saveBugReport}
          onDelete={handleDeleteBugReport} 
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
              updateTestPointData(data);
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

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                   className="toolbox-button"
                   style={{ 
                     width: '40px', 
                     height: '40px', 
                     border: '1px solid var(--border-color)', 
                     background: 'var(--input-background)',
                     borderRadius: '50%',
                     cursor: 'pointer',
                     color: 'var(--text-color-muted)',
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     transition: 'all 0.2s ease',
                   }}
                   onClick={() => setIsBugReportOpen(true)}
                   title="Report Bug / Request Feature"
                   onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--status-warning)';
                      e.currentTarget.style.borderColor = 'var(--status-warning)';
                      e.currentTarget.style.backgroundColor = 'var(--status-warning-bg)';
                   }}
                   onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--text-color-muted)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.backgroundColor = 'var(--input-background)';
                   }}
                >
                  <FontAwesomeIcon icon={faBug} />
                </button>

                <button
                   className="toolbox-button" 
                   style={{ 
                     width: '40px', 
                     height: '40px', 
                     border: '1px solid var(--border-color)', 
                     background: 'var(--input-background)',
                     borderRadius: '50%',
                     cursor: 'pointer',
                     color: 'var(--text-color-muted)',
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     transition: 'all 0.2s ease',
                   }}
                   onClick={() => setIsHelpOpen(true)}
                   title="Help & Tutorial"
                   onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--primary-color)';
                      e.currentTarget.style.borderColor = 'var(--primary-color)';
                      e.currentTarget.style.backgroundColor = 'var(--primary-color-light)';
                   }}
                   onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--text-color-muted)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.backgroundColor = 'var(--input-background)';
                   }}
                >
                  <FontAwesomeIcon icon={faQuestionCircle} />
                </button>
            </div>

            <HeaderToolbox 
              isToolboxCollapsed={isToolboxCollapsed}
              setIsToolboxCollapsed={setIsToolboxCollapsed}
              isOverviewOpen={isOverviewOpen}
              setIsOverviewOpen={setIsOverviewOpen}
              isInstrumentBuilderOpen={isInstrumentBuilderOpen}
              setIsInstrumentBuilderOpen={setIsInstrumentBuilderOpen}
              isTraceabilityOpen={isTraceabilityOpen}
              setIsTraceabilityOpen={setIsTraceabilityOpen}
              isNotepadOpen={isNotepadOpen}
              setIsNotepadOpen={setIsNotepadOpen}
              isConverterOpen={isConverterOpen}
              setIsConverterOpen={setIsConverterOpen}
              handleSaveToFile={handleSaveToFile}
              handleLoadFromFile={handleLoadFromFile}
              isHelpOpen={isHelpOpen}
              setIsHelpOpen={setIsHelpOpen}
              currentTheme={currentTheme}
              setCurrentTheme={setCurrentTheme}
              isDarkMode={isDarkMode}
              setIsDarkMode={setIsDarkMode}
              dbPath={dbPath}
              disconnectDatabase={disconnectDatabase}
              selectDatabaseFolder={selectDatabaseFolder}
            />
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
                {/* REMOVED THE ADD POINT BUTTON FROM HERE */}
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
                      <button className="button primary" onClick={() => setIsAddModalOpen(true)}>
                        <FontAwesomeIcon icon={faPlus} /> Add Measurement Point
                      </button>
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