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
  faBug,
  faQuestionCircle,
  faLayerGroup,
  faCube,
  faMicroscope,
  faRulerCombined, // Icon for Ranges
  faEye,
  faEyeSlash
} from "@fortawesome/free-solid-svg-icons";

const ThemeContext = React.createContext(false);
export const useTheme = () => React.useContext(ThemeContext);

// --- HELPER: Extract All Ranges from UUT ---
const getAllUutRanges = (uut) => {
  if (!uut) return [];

  let ranges = [];

  // 1. Custom defined ranges on the UUT instance
  if (Array.isArray(uut.ranges) && uut.ranges.length > 0) {
    ranges = uut.ranges.map(r => ({ ...r, source: 'custom' }));
  }
  // 2. Instrument Library: Functions (e.g. "DC Voltage", "Resistance")
  else if (uut.instrument?.functions) {
    ranges = uut.instrument.functions.flatMap(fn =>
      (fn.ranges || []).map(r => ({
        ...r,
        functionName: fn.name,
        unit: fn.unit || r.unit,
        source: 'function'
      }))
    );
  }
  // 3. Instrument Library: Flat Ranges
  else if (uut.instrument?.ranges) {
    ranges = uut.instrument.ranges.map(r => ({ ...r, source: 'simple' }));
  }
  // 4. Single Tolerance
  else if (uut.tolerance) {
    ranges = [{ ...uut.tolerance, source: 'single', isSingle: true }];
  }

  // Add a display label for the sidebar
  const finalRanges = ranges.map((r, index) => {
    let label = r.range || "Range";
    if (!r.range && r.min !== undefined && r.max !== undefined) {
      label = `${r.min} to ${r.max}`;
    }

    // Add Unit to label if not present
    if (r.unit && !label.includes(r.unit)) {
      label += ` ${r.unit}`;
    }

    // Prepend Function Name if available
    if (r.functionName) {
      label = `${r.functionName}: ${label}`;
    }

    return { ...r, _id: index, label };
  });

  return finalRanges;
};

// --- HELPER: Find & Normalize Matching Range (Used for selection logic) ---
const findMatchingRange = (uut, value, unit) => {
  if (!uut || value === null || value === undefined) return null;
  const allRanges = getAllUutRanges(uut);
  const numericValue = parseFloat(value);
  if (isNaN(numericValue)) return allRanges[0] || null;

  const match = allRanges.find(r => {
    const min = parseFloat(r.min);
    const max = parseFloat(r.max);
    // Case-insensitive unit check
    const unitMatch = !unit || !r.unit || unit.toLowerCase() === r.unit.toLowerCase();

    if (!isNaN(min) && !isNaN(max)) {
      return unitMatch && numericValue >= min && numericValue <= max;
    }
    return unitMatch;
  });

  return match || allRanges[0] || null;
};

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
  const [virtualPoint, setVirtualPoint] = useState(null);
  const [activeRangeIndices, setActiveRangeIndices] = useState({});

  // Replaced global boolean with a Set for per-UUT hiding
  const [uutsHidingEmptyRanges, setUutsHidingEmptyRanges] = useState(new Set());

  // Tracks which UUT "folder" was clicked in the sidebar to enforce context
  const [selectedTestPointContextUutId, setSelectedTestPointContextUutId] = useState(null);

  // --- Global UUT Selection State ---
  const [currentUutSelection, setCurrentUutSelection] = useState([]);

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
    setSelectedTestPointId(null);
    setSelectedAreaId(null);
    setSelectedUutId(null);
    setVirtualPoint(null);
    setSelectedTestPointContextUutId(null);
    setCurrentUutSelection([]);
  };

  const handleSelectArea = (areaId) => {
    setSelectedAreaId(areaId);
    setSelectedUutId(null);
    setSelectedTestPointId(null);
    setSelectedTestPointContextUutId(null);
    setCurrentUutSelection([]);

    setVirtualPoint({
      ...defaultTestPoint,
      id: null,
      measurementAreaId: areaId,
      associatedUutIds: [],
      tmdeTolerances: []
    });
  };

  const handleSelectUut = (uutId, areaId, uutObject) => {
    setSelectedUutId(uutId);
    setSelectedAreaId(areaId);
    setSelectedTestPointId(null);
    setSelectedTestPointContextUutId(null);
    setCurrentUutSelection([uutId]);

    let defaultTolerance = {};
    if (uutObject.instrument?.functions?.[0]?.ranges?.[0]) {
      defaultTolerance = uutObject.instrument.functions[0].ranges[0];
    } else if (uutObject.instrument?.ranges?.[0]) {
      defaultTolerance = uutObject.instrument.ranges[0];
    } else if (uutObject.tolerance) {
      defaultTolerance = uutObject.tolerance;
    }

    setVirtualPoint({
      ...defaultTestPoint,
      id: null,
      measurementAreaId: areaId,
      associatedUutIds: [uutId],
      uutTolerance: defaultTolerance,
      tmdeTolerances: []
    });
  };

  const handleSelectTestPoint = (tpId, contextUutId = null) => {
    setSelectedTestPointId(tpId);
    setSelectedAreaId(null);
    setSelectedUutId(null);
    setVirtualPoint(null);
    setSelectedTestPointContextUutId(contextUutId);
    setCurrentUutSelection([]);
  };

  const handleAddNewSession = () => {
    const newSession = addSession();
    setEditingSession(newSession);
  };

  const toggleUutEmptyRanges = (uutId) => {
    const newSet = new Set(uutsHidingEmptyRanges);
    if (newSet.has(uutId)) {
      newSet.delete(uutId);
    } else {
      newSet.add(uutId);
    }
    setUutsHidingEmptyRanges(newSet);
  };

  // Enhanced to support direct Range/UUT adds from sidebar
  const handleAddNewTestPoint = (areaId = null, specificUutId = null, specificRange = null) => {
    let initialData = {};

    // 1. Direct Add from Sidebar Range (Priority)
    if (specificUutId && specificRange) {
      initialData = {
        measurementAreaId: areaId,
        associatedUutIds: [specificUutId],
        uutTolerance: specificRange,
        testPointInfo: {
          parameter: {
            value: '',
            unit: specificRange.unit || '' // Auto-fill unit if available
          }
        }
      };
      // Update context so UI highlights the correct parent
      setSelectedTestPointContextUutId(specificUutId);
      // Ensure the Analysis panel dropdown matches the clicked range
      setActiveRangeIndices(prev => ({ ...prev, [specificUutId]: specificRange._id || 0 }));
    }
    // 2. Add via Header Button (Uses active selection)
    else if (specificUutId) {
      // Logic for adding to UUT without specific range (auto-sort logic handles it)
      initialData = {
        measurementAreaId: areaId,
        associatedUutIds: [specificUutId],
      };
      setSelectedTestPointContextUutId(specificUutId);
    }
    else if (currentUutSelection.length > 0) {
      initialData = {
        measurementAreaId: areaId || selectedAreaId,
        associatedUutIds: currentUutSelection,
      };

      const primaryUutId = currentUutSelection[0];
      const primaryUut = currentSessionData?.uuts?.find(u => u.id === primaryUutId);

      if (primaryUut) {
        const availableRanges = getAllUutRanges(primaryUut);
        const selectedIndex = activeRangeIndices[primaryUutId];

        if (selectedIndex !== undefined && availableRanges[selectedIndex]) {
          initialData.uutTolerance = availableRanges[selectedIndex];
        } else if (availableRanges.length > 0) {
          initialData.uutTolerance = availableRanges[0];
        }
      }
    }
    // 3. Fallback / Blank Add
    else {
      initialData = virtualPoint || (areaId ? { measurementAreaId: areaId, associatedUutIds: [] } : null);
    }

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
    if (!finalData.measurementAreaId && selectedAreaId) finalData.measurementAreaId = selectedAreaId;

    if ((!finalData.associatedUutIds || finalData.associatedUutIds.length === 0) && currentUutSelection.length > 0) {
      finalData.associatedUutIds = currentUutSelection;
    }

    saveTestPoint(finalData, null);
    setIsAddModalOpen(false);
    setEditingTestPoint(null);
    setCurrentUutSelection([]);

    if (finalData.associatedUutIds && finalData.associatedUutIds.length > 0) {
      setSelectedTestPointContextUutId(finalData.associatedUutIds[0]);
    }
  };

  const handleAnalysisDataSave = (updates) => {
    if (selectedTestPointId) {
      updateTestPointData(updates);
    } else {
      setVirtualPoint(prev => {
        if (!prev) return prev;
        return { ...prev, ...updates };
      });
    }
  };

  const handleDeleteTestPoint = (idToDelete) => {
    setAppNotification({
      title: "Delete Measurement Point",
      message: "Are you sure you want to delete this measurement point?",
      confirmText: "Delete",
      isIconConfirm: true,
      onConfirm: () => {
        deleteTestPoint(idToDelete);
        setAppNotification(null);
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
      const areaUuts = uuts.filter(u =>
        u.measurementAreaId === area.id ||
        (u.measurementArea && u.measurementArea === area.name)
      );

      const uutGroups = areaUuts.map(uut => {
        const associatedPoints = points.filter(tp =>
          tp.associatedUutIds &&
          tp.associatedUutIds.some(id => String(id) === String(uut.id))
        );

        // Logic to Sort Points into Ranges
        const availableRanges = getAllUutRanges(uut);

        const categorizedPoints = new Set();
        const rangesWithPoints = availableRanges.map(range => {
          const pointsInRange = associatedPoints.filter(tp => {
            if (categorizedPoints.has(tp.id)) return false;

            const val = parseFloat(tp.testPointInfo?.parameter?.value);
            const unit = tp.testPointInfo?.parameter?.unit;

            if (isNaN(val)) return false;

            const min = parseFloat(range.min);
            const max = parseFloat(range.max);

            const unitMatch = !unit || !range.unit || unit.toLowerCase() === range.unit.toLowerCase();
            const inRange = !isNaN(min) && !isNaN(max) && unitMatch && val >= min && val <= max;

            if (inRange) categorizedPoints.add(tp.id);
            return inRange;
          });

          return { ...range, points: pointsInRange };
        });

        const uncategorizedPoints = associatedPoints.filter(tp => !categorizedPoints.has(tp.id));

        return {
          ...uut,
          rangeGroups: rangesWithPoints,
          uncategorizedPoints
        };
      });

      const unassignedPoints = points.filter(tp => {
        if (tp.measurementAreaId !== area.id) return false;
        const hasParent = tp.associatedUutIds && tp.associatedUutIds.length > 0;
        const parentExistsInArea = hasParent && areaUuts.some(u =>
          tp.associatedUutIds.some(id => String(id) === String(u.id))
        );
        return !parentExistsInArea;
      });

      return { ...area, uutGroups, unassignedPoints };
    });
  }, [currentSessionData, currentTestPoints]);

  // --- LOGIC: Compute Data to Display ---
  const displayData = useMemo(() => {
    if (!currentSessionData) return null;

    if (selectedTestPointId) {
      const pointData = currentTestPoints.find((p) => p.id === selectedTestPointId);
      if (!pointData) return null;

      // Default: Start with stored values
      let effectiveUutTolerance = (pointData.uutTolerance !== null && pointData.uutTolerance !== undefined && Object.keys(pointData.uutTolerance).length > 0)
        ? pointData.uutTolerance
        : currentSessionData.uutTolerance;

      let effectiveUutDescription = pointData.uutDescription || (
        pointData.associatedUutIds?.length > 0
          ? currentSessionData.uuts?.find(u => u.id === pointData.associatedUutIds[0])?.description
          : currentSessionData.uutDescription
      );

      let activeUutId = null;

      // CONTEXT: Specific UUT folder clicked
      if (selectedTestPointContextUutId) {
        const contextUut = currentSessionData.uuts?.find(u => u.id === selectedTestPointContextUutId);
        if (contextUut) {
          effectiveUutDescription = contextUut.description;
          activeUutId = contextUut.id;

          // Only fallback to auto-matching if no specific tolerance is saved on the point
          if (!pointData.uutTolerance || Object.keys(pointData.uutTolerance).length === 0) {
            const pointValue = pointData.testPointInfo?.parameter?.value;
            const pointUnit = pointData.testPointInfo?.parameter?.unit;
            if (pointValue !== undefined && pointValue !== "") {
              const matchedRange = findMatchingRange(contextUut, pointValue, pointUnit);
              if (matchedRange) {
                effectiveUutTolerance = matchedRange;
              }
            }
          }
        }
      }

      // FALLBACK CONTEXT: No specific folder clicked
      if (!activeUutId && pointData.associatedUutIds && pointData.associatedUutIds.length > 0) {
        activeUutId = pointData.associatedUutIds[0];

        if (!pointData.uutTolerance || Object.keys(pointData.uutTolerance).length === 0) {
          const fallbackUut = currentSessionData.uuts?.find(u => u.id === activeUutId);
          if (fallbackUut) {
            const pointValue = pointData.testPointInfo?.parameter?.value;
            const pointUnit = pointData.testPointInfo?.parameter?.unit;
            if (pointValue !== undefined && pointValue !== "") {
              const matchedRange = findMatchingRange(fallbackUut, pointValue, pointUnit);
              if (matchedRange) {
                effectiveUutTolerance = matchedRange;
              }
            }
          }
        }
      }

      return {
        ...pointData,
        uutDescription: effectiveUutDescription,
        uutTolerance: effectiveUutTolerance,
        activeUutId: activeUutId,
      };
    }

    if (virtualPoint) {
      let activeUutId = null;
      if (virtualPoint.associatedUutIds && virtualPoint.associatedUutIds.length > 0) {
        activeUutId = virtualPoint.associatedUutIds[0];
      }
      return {
        ...virtualPoint,
        activeUutId: activeUutId
      };
    }

    return null;
  }, [currentSessionData, selectedTestPointId, currentTestPoints, virtualPoint, selectedTestPointContextUutId]);


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
        <AddTestPointModal isOpen={isAddModalOpen || !!editingTestPoint} onClose={() => { setIsAddModalOpen(false); setEditingTestPoint(null); }} onSave={handleSaveTestPoint} initialData={editingTestPoint || (selectedAreaId ? { measurementAreaId: selectedAreaId } : null)} hasExistingPoints={currentTestPoints.length > 0} previousTestPointData={currentTestPoints.length > 0 ? currentTestPoints[currentTestPoints.length - 1] : null} />
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
                {/* --- Sidebar View Controls (Updated) --- */}
                <div className="sidebar-view-controls">
                  <button onClick={handleAddNewSession} title="Add New Session" className="sidebar-action-button"><FontAwesomeIcon icon={faPlus} /></button>
                  <button onClick={() => handleOpenSessionEditor("details")} title="Edit Session" className="sidebar-action-button"><FontAwesomeIcon icon={faEdit} /></button>
                  <button onClick={() => handleDeleteSession(selectedSessionId)} title="Delete Session" className="sidebar-action-button delete"><FontAwesomeIcon icon={faTrashAlt} /></button>
                </div>
              </div>

              <div className="measurement-point-list">
                {sidebarData.map((areaData) => (
                  <div key={areaData.id} className="measurement-group">
                    {/* LEVEL 1: MEASUREMENT AREA */}
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

                      {/* Quick Add Button (Area Level) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button className="btn-icon-only small" onClick={(e) => { e.stopPropagation(); handleAddNewTestPoint(areaData.id); }} title="Quick Add Point">
                          <FontAwesomeIcon icon={faPlus} size="xs" />
                        </button>
                      </div>
                    </div>

                    {/* LEVEL 2: UUTs */}
                    {areaData.uutGroups.map(group => {
                      const isUutSelected = selectedUutId === group.id && !selectedTestPointId;
                      const isHidingEmpty = uutsHidingEmptyRanges.has(group.id);

                      return (
                        <div key={group.id} style={{ display: 'flex', flexDirection: 'column' }}>
                          {/* UUT ROW */}
                          <div
                            className={`uut-header ${isUutSelected ? 'active' : ''}`}
                            onClick={() => handleSelectUut(group.id, areaData.id, group)}
                          >
                            <div className="uut-label">
                              <FontAwesomeIcon icon={faMicroscope} size="sm" />
                              <span>{group.description}</span>
                            </div>

                            {/* This container will now be invisible until hover */}
                            <div className="uut-actions">
                              <button
                                className={`btn-icon-only small ${isHidingEmpty ? 'active' : ''}`}
                                onClick={(e) => { e.stopPropagation(); toggleUutEmptyRanges(group.id); }}
                                title={isHidingEmpty ? "Show All Ranges" : "Hide Empty Ranges"}
                              >
                                <FontAwesomeIcon icon={isHidingEmpty ? faEyeSlash : faEye} size="xs" />
                              </button>

                              <button
                                className="btn-icon-only small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddNewTestPoint(areaData.id, group.id);
                                }}
                                title="Quick Add Point to UUT"
                              >
                                <FontAwesomeIcon icon={faPlus} size="xs" />
                              </button>
                            </div>
                          </div>

                          {/* LEVEL 3: RANGES */}
                          {group.rangeGroups.map(range => {
                            // Hide logic: Check specific UUT state
                            if (isHidingEmpty && range.points.length === 0) return null;

                            return (
                              <div key={`range-${range._id}`} style={{ display: 'flex', flexDirection: 'column' }}>
                                {/* RANGE HEADER */}
                                <div className="range-header-container">
                                  <div className="range-label-group">
                                    <FontAwesomeIcon icon={faRulerCombined} size="xs" />
                                    <span>{range.label}</span>
                                  </div>

                                  {/* Removed Quick Add Button from here as requested */}
                                </div>

                                {/* LEVEL 4: POINTS IN RANGE */}
                                {range.points.length === 0 ? (
                                  <div style={{ padding: '2px 0 2px 60px', color: 'var(--text-color-muted)', fontSize: '0.7rem', fontStyle: 'italic', opacity: 0.7 }}>
                                    Empty Range
                                  </div>
                                ) : (
                                  range.points.map(tp => {
                                    const isSelected = selectedTestPointId === tp.id && selectedTestPointContextUutId === group.id;
                                    return (
                                      <button
                                        key={tp.id}
                                        onClick={() => handleSelectTestPoint(tp.id, group.id)}
                                        className={`measurement-point-item nested ${isSelected ? "active" : ""}`}
                                        style={{
                                          marginLeft: '60px',
                                          width: 'calc(100% - 60px)',
                                          borderLeft: '1px solid var(--border-color)',
                                          padding: '6px 10px',
                                          textAlign: 'left'
                                        }}
                                        onContextMenu={(e) => {
                                          e.preventDefault();
                                          setContextMenu({
                                            x: e.pageX, y: e.pageY,
                                            items: [
                                              { label: "Delete Point", action: () => handleDeleteTestPoint(tp.id), icon: faTrashAlt, className: "destructive" },
                                            ],
                                          });
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <FontAwesomeIcon icon={faCube} size="xs" style={{ opacity: 0.5 }} />
                                          {/* Simplified Label: Value + Unit only */}
                                          <span className="point-main" style={{ fontSize: '0.8rem' }}>
                                            {tp.testPointInfo.parameter.value} {tp.testPointInfo.parameter.unit}
                                          </span>
                                        </div>
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            );
                          })}

                          {/* FALLBACK: UNCATEGORIZED POINTS */}
                          {group.uncategorizedPoints && group.uncategorizedPoints.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              {group.rangeGroups.length > 0 && (
                                <div style={{ padding: '4px 10px 4px 45px', color: 'var(--text-color-muted)', fontSize: '0.7rem', fontStyle: 'italic' }}>
                                  Out of Range Points
                                </div>
                              )}
                              {group.uncategorizedPoints.map(tp => {
                                const isSelected = selectedTestPointId === tp.id && selectedTestPointContextUutId === group.id;
                                return (
                                  <button
                                    key={tp.id}
                                    onClick={() => handleSelectTestPoint(tp.id, group.id)}
                                    className={`measurement-point-item nested ${isSelected ? "active" : ""}`}
                                    style={{
                                      marginLeft: '45px',
                                      width: 'calc(100% - 45px)',
                                      borderLeft: '1px solid var(--border-color)',
                                      padding: '6px 10px',
                                      textAlign: 'left'
                                    }}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      setContextMenu({
                                        x: e.pageX, y: e.pageY,
                                        items: [
                                          { label: "Delete Point", action: () => handleDeleteTestPoint(tp.id), icon: faTrashAlt, className: "destructive" },
                                        ],
                                      });
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <FontAwesomeIcon icon={faCube} size="xs" style={{ opacity: 0.5 }} />
                                      {/* Simplified Label: Value + Unit only */}
                                      <span className="point-main" style={{ fontSize: '0.8rem' }}>
                                        {tp.testPointInfo.parameter.value} {tp.testPointInfo.parameter.unit}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* UNASSIGNED POINTS */}
                    {areaData.unassignedPoints.length > 0 && (
                      <div style={{ padding: '5px 0 5px 25px', opacity: 1.0 }}>
                        <small style={{ textTransform: 'uppercase', fontSize: '0.7rem', color: 'var(--text-color-muted)', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '5px', display: 'block' }}>Unassigned Points</small>
                        {areaData.unassignedPoints.map(tp => (
                          <button
                            key={tp.id}
                            onClick={() => handleSelectTestPoint(tp.id, null)}
                            className={`measurement-point-item nested ${selectedTestPointId === tp.id ? "active" : ""}`}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              textAlign: 'left',
                              marginBottom: '2px'
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setContextMenu({
                                x: e.pageX, y: e.pageY,
                                items: [
                                  { label: "Delete Point", action: () => handleDeleteTestPoint(tp.id), icon: faTrashAlt, className: "destructive" },
                                ],
                              });
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <FontAwesomeIcon icon={faCube} size="xs" style={{ opacity: 0.5 }} />
                              {/* Simplified Label: Value + Unit only */}
                              <span className="point-main" style={{ fontSize: '0.8rem' }}>
                                {tp.testPointInfo.parameter.value} {tp.testPointInfo.parameter.unit}
                              </span>
                            </div>
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
                  key={displayData.id || `virtual-${selectedAreaId}-${selectedUutId}`}
                  testPointData={displayData}
                >
                  <Analysis
                    sessionData={currentSessionData}
                    testPointData={displayData}
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
                    onDeleteTestPoint={handleDeleteTestPoint}

                    // --- Pass Global UUT Selection Props ---
                    currentUutSelection={currentUutSelection}
                    setCurrentUutSelection={setCurrentUutSelection}
                    activeRangeIndices={activeRangeIndices}
                    onRangeSelectionChange={setActiveRangeIndices}
                  />
                </TestPointDetailView>
              ) : (
                <div className="placeholder-content">
                  {currentSessionData ? (
                    <>
                      <h3>No measurement point selected.</h3>
                      <p>Select a UUT Range or Measurement Area from the sidebar.</p>
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