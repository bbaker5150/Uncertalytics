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
import "./App.css";

// --- Icons ---
import appLogo from './assets/icon.svg';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faEdit,
  faTrashAlt,
  faPencilAlt,
  faSlidersH,
  faBug,
  faQuestionCircle,
  faLayerGroup,
  faCube, 
  faMicroscope
} from "@fortawesome/free-solid-svg-icons";

const ThemeContext = React.createContext(false);
export const useTheme = () => React.useContext(ThemeContext);

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
    dbPath,
    selectDatabaseFolder,
    disconnectDatabase,
    migrateToDisk,
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

  // --- SELECTION & VIRTUAL STATE ---
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  const [selectedUutId, setSelectedUutId] = useState(null);
  // NEW: Holds the transient state of a point before it is added to the DB
  const [virtualPoint, setVirtualPoint] = useState(null);

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

  // --- SELECTION HANDLERS ---
  const handleSelectSession = (newId) => {
      setSelectedSessionId(newId);
      // Reset all views
      setSelectedTestPointId(null);
      setSelectedAreaId(null);
      setSelectedUutId(null);
      setVirtualPoint(null);
  };

  const handleSelectArea = (areaId) => {
      setSelectedAreaId(areaId);
      setSelectedUutId(null);
      setSelectedTestPointId(null);
      
      // Initialize Virtual Point for this Area
      setVirtualPoint({
          ...defaultTestPoint,
          id: null, // Virtual ID
          measurementAreaId: areaId,
          associatedUutIds: [],
          tmdeTolerances: []
      });
  };

  const handleSelectUut = (uutId, areaId, uutObject) => {
      setSelectedUutId(uutId);
      setSelectedAreaId(areaId); // Implicitly select area too
      setSelectedTestPointId(null);

      // Pre-fill default tolerance from UUT if available
      let defaultTolerance = {};
      if (uutObject.instrument?.functions?.[0]?.ranges?.[0]) {
          defaultTolerance = uutObject.instrument.functions[0].ranges[0];
      } else if (uutObject.instrument?.ranges?.[0]) {
          defaultTolerance = uutObject.instrument.ranges[0];
      }

      setVirtualPoint({
          ...defaultTestPoint,
          id: null,
          measurementAreaId: areaId,
          associatedUutIds: [uutId],
          tmdeTolerances: [],
          uutTolerance: defaultTolerance
      });
  };

  const handleSelectTestPoint = (tpId) => {
      setSelectedTestPointId(tpId);
      setSelectedAreaId(null);
      setSelectedUutId(null);
      setVirtualPoint(null); // Clear virtual when selecting real
  };

  const handleAddNewSession = () => {
    const newSession = addSession();
    setEditingSession(newSession);
  };

  const handleAddNewTestPoint = (areaId = null) => {
      // If we are already in virtual mode, use the virtual point data
      const initialData = virtualPoint || (areaId ? { measurementAreaId: areaId } : null);
      
      setEditingTestPoint(initialData); 
      setIsAddModalOpen(true);
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
    
    // Fallback if null, though modal usually handles it
    if (!finalData.measurementAreaId && selectedAreaId) finalData.measurementAreaId = selectedAreaId;
    if (!finalData.associatedUutIds && selectedUutId) finalData.associatedUutIds = [selectedUutId];

    saveTestPoint(finalData, null);
    setIsAddModalOpen(false);
    setEditingTestPoint(null);
    // Keep context if desired, or reset. Let's reset to avoid confusion.
    // setSelectedAreaId(null);
    // setSelectedUutId(null);
  };

  // --- CRITICAL FIX: Handle Updates from Analysis Panel ---
  // This function decides whether to update the DB (real point) or local state (virtual point)
  const handleAnalysisDataSave = (updates) => {
      if (selectedTestPointId) {
          // Real Point: Update DB
          updateTestPointData(updates);
      } else {
          // Virtual Point: Update Local State
          setVirtualPoint(prev => {
              if (!prev) return prev;
              return { ...prev, ...updates };
          });
      }
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

  // --- DATA PROCESSING: Sidebar Hierarchy ---
  const sidebarData = useMemo(() => {
    if (!currentSessionData) return [];

    const areas = currentSessionData.measurementAreas || [];
    const uuts = currentSessionData.uuts || [];
    const points = currentTestPoints;

    return areas.map(area => {
        const areaUuts = uuts.filter(u => u.measurementAreaId === area.id);
        const areaPoints = points.filter(tp => tp.measurementAreaId === area.id);

        const uutGroups = areaUuts.map(uut => {
            const associatedPoints = areaPoints.filter(tp => tp.associatedUutIds?.includes(uut.id));
            return { ...uut, points: associatedPoints };
        });

        const unassignedPoints = areaPoints.filter(tp => 
            !tp.associatedUutIds || 
            tp.associatedUutIds.length === 0 || 
            !areaUuts.some(u => tp.associatedUutIds.includes(u.id))
        );

        return { ...area, uutGroups, unassignedPoints };
    });
  }, [currentSessionData, currentTestPoints]);

  // --- LOGIC: Compute Data to Display ---
  const displayData = useMemo(() => {
    if (!currentSessionData) return null;
    
    // Case 1: Real Point Selected
    if (selectedTestPointId) {
        const pointData = currentTestPoints.find((p) => p.id === selectedTestPointId);
        if (!pointData) return null;

        // Effective Tolerance Logic
        let effectiveUutTolerance = (pointData.uutTolerance !== null && pointData.uutTolerance !== undefined)
          ? pointData.uutTolerance
          : currentSessionData.uutTolerance;

        return {
          ...pointData,
          uutDescription: pointData.uutDescription || (
              pointData.associatedUutIds?.length > 0 
                ? currentSessionData.uuts?.find(u => u.id === pointData.associatedUutIds[0])?.description 
                : currentSessionData.uutDescription
          ),
          uutTolerance: effectiveUutTolerance,
        };
    }
    
    // Case 2: Virtual Point (Draft Mode)
    // Return the local state 'virtualPoint'
    if (virtualPoint) {
        return virtualPoint;
    }

    return null;
  }, [currentSessionData, selectedTestPointId, currentTestPoints, virtualPoint]);


  return (
    <ThemeContext.Provider value={isDarkMode}>
      <div className="App">
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
        <BugReportModal isOpen={isBugReportOpen} onClose={() => setIsBugReportOpen(false)} reports={bugReports} onSave={saveBugReport} onDelete={handleDeleteBugReport} />
        {currentSessionData && (<> <FloatingNotepad isOpen={isNotepadOpen} onClose={() => setIsNotepadOpen(false)} notes={currentSessionData.notes || ""} onSave={handleUpdateNotes} /> <UnitConverter isOpen={isConverterOpen} onClose={() => setIsConverterOpen(false)} /> <ReverseTraceabilityTool isOpen={isTraceabilityOpen} onClose={() => setIsTraceabilityOpen(false)} /> </>)}
        <UnresolvedToleranceModal isOpen={!!unresolvedToleranceModal} matches={unresolvedToleranceModal?.matches} instrumentName={unresolvedToleranceModal?.instrumentName} onSelect={(selected) => { unresolvedToleranceModal.onSelect(selected); }} onClose={() => setUnresolvedToleranceModal(null)} />
        <InstrumentBuilderModal isOpen={isInstrumentBuilderOpen} onClose={() => setIsInstrumentBuilderOpen(false)} onSave={handleSaveInstrument} onDelete={deleteInstrument} instruments={instruments} />
        {confirmationModal && (<div className="modal-overlay" style={{ zIndex: 2001 }}> <div className="modal-content"> <button onClick={() => setConfirmationModal(null)} className="modal-close-button" > &times; </button> <h3>{confirmationModal.title}</h3> <p>{confirmationModal.message}</p> <div className="modal-actions" style={{ justifyContent: "center", gap: "15px" }} > <button className="button" style={{ backgroundColor: "var(--status-bad)" }} onClick={confirmationModal.onConfirm} > Delete </button> </div> </div> </div>)}
        <AddTestPointModal isOpen={isAddModalOpen || !!editingTestPoint} onClose={() => { setIsAddModalOpen(false); setEditingTestPoint(null); }} onSave={handleSaveTestPoint} initialData={editingTestPoint || (selectedAreaId ? { measurementAreaId: selectedAreaId } : null)} hasExistingPoints={currentTestPoints.length > 0} previousTestPointData={ currentTestPoints.length > 0 ? currentTestPoints[currentTestPoints.length - 1] : null } />
        <EditSessionModal isOpen={!!editingSession} onClose={() => { setEditingSession(null); setInitialTmdeToEdit(null); setInitialSessionTab("details"); }} sessionData={editingSession} onSave={handleSessionChange} onSaveToFile={handleSaveToFile} handleLoadFromFile={handleLoadFromFile} initialSection={initialSessionTab} sessionImageCache={sessionImageCache} onImageCacheChange={setSessionImageCache} onRemoveImageFile={deleteSessionImage} instruments={instruments} />
        <OverviewModal isOpen={isOverviewOpen} onClose={() => setIsOverviewOpen(false)} sessionData={currentSessionData} onUpdateTestPoint={handleUpdateSpecificTestPoint} onDeleteTmdeDefinition={handleDeleteTmdeDefinition} onDecrementTmdeQuantity={decrementTmdeQuantity} instruments={instruments} />
        {displayData && displayData.id && (<ToleranceToolModal isOpen={isToleranceModalOpen} onClose={() => setIsToleranceModalOpen(false)} onSave={(data) => { updateTestPointData(data); }} testPointData={displayData} />)}
        <FullBreakdownModal isOpen={!!breakdownPoint} breakdownData={breakdownPoint} onClose={() => setBreakdownPoint(null)} />
        <TestPointInfoModal isOpen={!!infoModalPoint} testPoint={infoModalPoint} onClose={() => setInfoModalPoint(null)} />
        {contextMenu && (<ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />)}

        <div className="content-area uncertainty-analysis-page">
          <div className="app-pro-header">
            <div className="header-identity">
              <div className="app-logo-mark custom-logo full-bleed"><img src={appLogo} alt="App Logo" /></div>
              <div className="app-title-group"><h2>Uncertalytics</h2><div className="app-subtitle-row"><span className="app-subtitle">Risk Analysis Tool</span><span className="app-version">v1.0.0</span></div></div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="toolbox-button" style={{ width: '40px', height: '40px', border: '1px solid var(--border-color)', background: 'var(--input-background)', borderRadius: '50%', cursor: 'pointer', color: 'var(--text-color-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', }} onClick={() => setIsBugReportOpen(true)} title="Report Bug / Request Feature" > <FontAwesomeIcon icon={faBug} /> </button>
                <button className="toolbox-button" style={{ width: '40px', height: '40px', border: '1px solid var(--border-color)', background: 'var(--input-background)', borderRadius: '50%', cursor: 'pointer', color: 'var(--text-color-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', }} onClick={() => setIsHelpOpen(true)} title="Help & Tutorial" > <FontAwesomeIcon icon={faQuestionCircle} /> </button>
            </div>
            <HeaderToolbox isToolboxCollapsed={isToolboxCollapsed} setIsToolboxCollapsed={setIsToolboxCollapsed} isOverviewOpen={isOverviewOpen} setIsOverviewOpen={setIsOverviewOpen} isInstrumentBuilderOpen={isInstrumentBuilderOpen} setIsInstrumentBuilderOpen={setIsInstrumentBuilderOpen} isTraceabilityOpen={isTraceabilityOpen} setIsTraceabilityOpen={setIsTraceabilityOpen} isNotepadOpen={isNotepadOpen} setIsNotepadOpen={setIsNotepadOpen} isConverterOpen={isConverterOpen} setIsConverterOpen={setIsConverterOpen} handleSaveToFile={handleSaveToFile} handleLoadFromFile={handleLoadFromFile} isHelpOpen={isHelpOpen} setIsHelpOpen={setIsHelpOpen} currentTheme={currentTheme} setCurrentTheme={setCurrentTheme} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} dbPath={dbPath} disconnectDatabase={disconnectDatabase} selectDatabaseFolder={selectDatabaseFolder} />
          </div>

          <div className="results-workflow-container">
            <aside className="results-sidebar">
              <div className="sidebar-header" style={{ alignItems: "flex-end" }}>
                <div className="session-controls">
                  <label htmlFor="session-select">Analysis Session</label>
                  <select id="session-select" className="session-selector" value={selectedSessionId || ""} onChange={(e) => handleSelectSession(Number(e.target.value))} >
                    {sessions.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                </div>
                <div className="session-actions">
                  <button onClick={handleAddNewSession} title="Add New Session" className="sidebar-action-button"><FontAwesomeIcon icon={faPlus} /></button>
                  <button onClick={() => handleOpenSessionEditor("details")} title="Edit Session" className="sidebar-action-button"><FontAwesomeIcon icon={faEdit} /></button>
                  <button onClick={() => handleDeleteSession(selectedSessionId)} title="Delete Session" className="sidebar-action-button delete"><FontAwesomeIcon icon={faTrashAlt} /></button>
                </div>
              </div>

              <div className="measurement-point-list">
                {/* LEVEL 1: MEASUREMENT AREA */}
                {sidebarData.map((areaData) => (
                    <div key={areaData.id} className="measurement-group">
                        <div 
                            className={`group-header ${selectedAreaId === areaData.id && !selectedUutId && !selectedTestPointId ? 'active-area' : ''}`}
                            onClick={() => handleSelectArea(areaData.id)}
                            style={{ 
                               padding: '10px 12px', 
                               backgroundColor: 'var(--background-secondary)',
                               borderBottom: '1px solid var(--border-color)',
                               display: 'flex',
                               justifyContent: 'space-between',
                               alignItems: 'center',
                               cursor: 'pointer'
                            }}
                        >
                           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                               <FontAwesomeIcon icon={faLayerGroup} style={{ color: areaData.color || '#3498db' }} />
                               <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-color)' }}>
                                   {areaData.name}
                               </span>
                           </div>
                           <button className="btn-icon-only small" onClick={(e) => { e.stopPropagation(); handleAddNewTestPoint(areaData.id); }} title="Quick Add Point">
                               <FontAwesomeIcon icon={faPlus} size="xs" />
                           </button>
                        </div>

                        {/* LEVEL 2: UUTs */}
                        {areaData.uutGroups.map(group => {
                            const isUutSelected = selectedUutId === group.id && !selectedTestPointId;
                            return (
                                <div key={group.id} style={{ marginLeft: '10px', borderLeft: '2px solid var(--border-color)' }}>
                                    <div 
                                        className={`uut-header ${isUutSelected ? 'active' : ''}`}
                                        onClick={() => handleSelectUut(group.id, areaData.id, group)}
                                        style={{
                                            padding: '8px 10px',
                                            cursor: 'pointer',
                                            backgroundColor: isUutSelected ? 'var(--highlight-background)' : 'transparent',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            color: isUutSelected ? 'var(--primary-color)' : 'var(--text-color-muted)'
                                        }}
                                    >
                                        <FontAwesomeIcon icon={faCube} size="sm" />
                                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{group.description}</span>
                                    </div>

                                    {/* LEVEL 3: POINTS FOR UUT */}
                                    {group.points.map(tp => (
                                        <button
                                            key={tp.id}
                                            onClick={() => handleSelectTestPoint(tp.id)}
                                            className={`measurement-point-item nested ${selectedTestPointId === tp.id ? "active" : ""}`}
                                            style={{ marginLeft: '10px' }}
                                            onDoubleClick={() => setEditingTestPoint(tp)}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                setContextMenu({
                                                    x: e.pageX, y: e.pageY,
                                                    items: [
                                                        { label: "Edit Details", action: () => setEditingTestPoint(tp), icon: faPencilAlt },
                                                        { label: "Edit Tolerances", action: () => { setSelectedTestPointId(tp.id); setIsToleranceModalOpen(true); }, icon: faSlidersH },
                                                        { type: "divider" },
                                                        { label: "Delete Point", action: () => handleDeleteTestPoint(tp.id), icon: faTrashAlt, className: "destructive" },
                                                    ],
                                                });
                                            }}
                                        >
                                            <span className="measurement-point-content">
                                                <span className="point-main">
                                                    {tp.testPointInfo.parameter.name}: {tp.testPointInfo.parameter.value} {tp.testPointInfo.parameter.unit}
                                                </span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            );
                        })}

                        {/* ORPHAN POINTS (Unassigned) */}
                        {areaData.unassignedPoints.length > 0 && (
                            <div style={{ marginLeft: '10px', padding: '5px 0' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-color-muted)', paddingLeft: '10px', fontStyle: 'italic' }}>Unassigned to UUT</div>
                                {areaData.unassignedPoints.map(tp => (
                                    <button
                                        key={tp.id}
                                        onClick={() => handleSelectTestPoint(tp.id)}
                                        className={`measurement-point-item nested ${selectedTestPointId === tp.id ? "active" : ""}`}
                                        style={{ marginLeft: '10px' }}
                                        onDoubleClick={() => setEditingTestPoint(tp)}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            setContextMenu({
                                                x: e.pageX, y: e.pageY,
                                                items: [
                                                    { label: "Edit Details", action: () => setEditingTestPoint(tp), icon: faPencilAlt },
                                                    { label: "Delete Point", action: () => handleDeleteTestPoint(tp.id), icon: faTrashAlt, className: "destructive" },
                                                ],
                                            });
                                        }}
                                    >
                                        <span className="measurement-point-content">
                                            <span className="point-main">
                                                {tp.testPointInfo.parameter.name}: {tp.testPointInfo.parameter.value} {tp.testPointInfo.parameter.unit}
                                            </span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
              </div>
            </aside>

            <main className="results-content">
              {displayData ? (
                <TestPointDetailView
                  key={displayData.id || `virtual-${selectedAreaId}-${selectedUutId}`} // Force remount on switch
                  testPointData={displayData}
                >
                  <Analysis
                    sessionData={currentSessionData}
                    testPointData={displayData}
                    // IMPORTANT: Pass the wrapped handler that manages Virtual vs Real updates
                    onDataSave={handleAnalysisDataSave}
                    onSessionSave={updateSession}
                    onSaveTestPoint={handleSaveTestPoint} 
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
                  {currentSessionData ? (
                    <>
                      <h3>No measurement point selected.</h3>
                      <p>Select a UUT or Measurement Area from the sidebar.</p>
                       <button className="button primary" onClick={() => handleAddNewTestPoint()}>
                        <FontAwesomeIcon icon={faPlus} /> Add New Point
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