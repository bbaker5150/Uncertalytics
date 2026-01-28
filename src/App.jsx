
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
  faRulerCombined,
  faEye,
  faEyeSlash,
  faFolderOpen,
  faCopy,
  faPaste,
  faCheckCircle
} from "@fortawesome/free-solid-svg-icons";

const ThemeContext = React.createContext(false);
export const useTheme = () => React.useContext(ThemeContext);

// --- HELPER COMPONENT: Sidebar Point Item (Supports Inline Editing) ---
const SidebarPointItem = ({ 
  point, 
  isSelected, 
  isTableSelected,
  onSelect, 
  onModalOpen, 
  onSave, 
  onContextMenu,
  onDragStart 
}) => {
  const [editingField, setEditingField] = useState(null); // 'section' | 'value' | null
  const [tempValue, setTempValue] = useState("");

  const startEdit = (e, field, currentVal) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingField(field);
    setTempValue(currentVal !== undefined && currentVal !== null ? currentVal : "");
  };

  const handleSingleClickEdit = (e, field, currentVal) => {
    if (isSelected) {
        startEdit(e, field, currentVal);
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setTempValue("");
  };

  const commitEdit = () => {
    if (editingField === 'section') {
       onSave({ ...point, section: tempValue });
    } else if (editingField === 'value') {
       const prevInfo = point.testPointInfo || {};
       const prevParam = prevInfo.parameter || {};
       
       const newInfo = { 
         ...prevInfo, 
         parameter: { ...prevParam, value: tempValue } 
       };
       onSave({ ...point, testPointInfo: newInfo });
    }
    setEditingField(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
        e.target.blur(); // Triggers onBlur which commits
    }
    if (e.key === 'Escape') cancelEdit();
  };

  // Safe Accessors
  const displayValue = point.testPointInfo?.parameter?.value;
  const displayUnit = point.testPointInfo?.parameter?.unit;

  return (
    <div
      draggable={!editingField}
      className={`point-grid-item ${isSelected ? 'active' : ''} ${isTableSelected ? 'table-highlight' : ''}`}
      onClick={(e) => { 
        if(!editingField) {
          e.stopPropagation(); 
          onSelect(point); 
        }
      }}
      onDragStart={(e) => onDragStart(e, point.id)}
      onDoubleClick={(e) => { 
        if(!editingField) {
            e.preventDefault(); 
            onModalOpen(point); 
        }
      }}
      onContextMenu={(e) => onContextMenu(e, point)}
    >
       {/* Section Column */}
       {editingField === 'section' ? (
          <input 
            autoFocus 
            className="sidebar-inline-input section"
            value={tempValue} 
            onChange={e => setTempValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            onClick={e => e.stopPropagation()}
            placeholder="-"
          />
       ) : (
          <span 
            className="point-section" 
            onClick={(e) => handleSingleClickEdit(e, 'section', point.section)}
            title="Click to edit Section"
          >
            {point.section || '-'}
          </span>
       )}

       {/* Value Column */}
       {editingField === 'value' ? (
          <div className="sidebar-inline-input-wrapper">
             <input 
                autoFocus 
                className="sidebar-inline-input value"
                value={tempValue} 
                onChange={e => setTempValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleKeyDown}
                onClick={e => e.stopPropagation()}
             />
             <small>{displayUnit}</small>
          </div>
       ) : (
          <span 
            className="point-value"
            onClick={(e) => handleSingleClickEdit(e, 'value', displayValue)}
            title="Click to edit Value"
          >
            {/* If value is empty, show a placeholder so it's clickable */}
            {displayValue || <span style={{opacity:0.3}}>-</span>} 
            {displayValue && <small style={{marginLeft:'4px', color:'var(--text-color-muted)'}}>{displayUnit}</small>}
          </span>
       )}
    </div>
  );
};


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
    let label = ""; 
    // Prioritize explicit Min/Max range display
    if (r.min !== undefined && r.max !== undefined) {
      label = `${r.min} to ${r.max}`;
    } else {
      label = r.range || "Range";
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
  const [selectedRangeContext, setSelectedRangeContext] = useState(null); // { uutId, range }
  const [virtualPoint, setVirtualPoint] = useState(null);
  const [activeRangeIndices, setActiveRangeIndices] = useState({});

  // UPDATED: Tracks which UUTs are explicitly SHOWING all ranges. 
  const [uutsShowingAllRanges, setUutsShowingAllRanges] = useState(new Set());

  // Tracks which UUT "folder" was clicked in the sidebar to enforce context
  const [selectedTestPointContextUutId, setSelectedTestPointContextUutId] = useState(null);

  // --- NEW: Table Selection State ---
  const [selectedTablePointIds, setSelectedTablePointIds] = useState([]);

  // --- Global UUT Selection State ---
  const [currentUutSelection, setCurrentUutSelection] = useState([]);

  // --- DRAG AND DROP & CLIPBOARD STATE ---
  const [draggedPointId, setDraggedPointId] = useState(null);
  const [dragOverTargetId, setDragOverTargetId] = useState(null);
  const [clipboardPoint, setClipboardPoint] = useState(null); // The point currently in the "clipboard"

  // --- TOAST STATE ---
  const [toast, setToast] = useState(null);

  // Toast Helper
  const showToast = (message) => {
    setToast(message);
    setTimeout(() => {
      setToast(null);
    }, 3000); // clear after 3 seconds
  };

  // --- DELETE HELPER (Defined before useEffect so it can be used inside) ---
  const handleDeleteTestPoint = (idOrIds, immediate = false) => {
    const idsToDelete = Array.isArray(idOrIds) ? idOrIds : [idOrIds];

    const performDelete = () => {
      if (currentSessionData && currentSessionData.testPoints) {
        const idsSet = new Set(idsToDelete);
        const updatedTestPoints = currentSessionData.testPoints.filter(tp => !idsSet.has(tp.id));

        updateSession({
          ...currentSessionData,
          testPoints: updatedTestPoints
        });
      }
      setAppNotification(null);
      // If the selected point was deleted, clear selection
      if (idsToDelete.includes(selectedTestPointId)) {
        setSelectedTestPointId(null);
      }
    };

    if (immediate) {
      performDelete();
      return;
    }

    const message = idsToDelete.length > 1
      ? `Are you sure you want to delete these ${idsToDelete.length} measurement points?`
      : "Are you sure you want to delete this measurement point?";

    setAppNotification({
      title: idsToDelete.length > 1 ? "Batch Delete" : "Delete Measurement Point",
      message: message,
      confirmText: "Delete",
      isIconConfirm: true,
      onConfirm: performDelete,
    });
  };

  // --- COPY / PASTE HANDLERS (Moved up for scope access in useEffect) ---
  const handleCopyPoint = (point) => {
    setClipboardPoint(point);
    showToast("Measurement point copied to clipboard");
    setContextMenu(null);
  };

  const handlePastePoint = (targetUutId, targetAreaId, targetRange = null) => {
    if (!clipboardPoint) return;

    const targetUut = currentSessionData.uuts.find(u => u.id === targetUutId);

    // FIX: Robust Area ID Lookup
    let resolvedAreaId = targetAreaId;
    if (!resolvedAreaId && targetUut) {
         resolvedAreaId = targetUut.measurementAreaId;
         // Fallback: Try finding area by name if ID is missing (common with imported legacy sessions)
         if (!resolvedAreaId && targetUut.measurementArea) {
             const area = currentSessionData.measurementAreas?.find(a => a.name === targetUut.measurementArea);
             if (area) resolvedAreaId = area.id;
         }
    }

    // Create new point object (Clean ID)
    const newPointData = { ...clipboardPoint };
    delete newPointData.id;

    // Update Location with RESOLVED Area ID
    newPointData.measurementAreaId = resolvedAreaId;
    newPointData.associatedUutIds = [targetUutId];

    // Resolve Tolerance
    if (targetRange) {
      newPointData.uutTolerance = targetRange;
    } else if (targetUut) {
      const val = newPointData.testPointInfo?.parameter?.value;
      const unit = newPointData.testPointInfo?.parameter?.unit;
      const matched = findMatchingRange(targetUut, val, unit);
      newPointData.uutTolerance = matched || null;
    }

    saveTestPoint(newPointData, null);
    showToast("Measurement point pasted successfully");
    setContextMenu(null);
    setSelectedTestPointContextUutId(targetUutId);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. Ctrl+Shift+M for Migrate (Existing)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        migrateToDisk();
      }

      // 2. Ctrl+C for Copy Point
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        // Only trigger if a single point is selected and we aren't in an input
        if (selectedTestPointId && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          const point = currentTestPoints.find(p => p.id === selectedTestPointId);
          if (point) {
            e.preventDefault();
            handleCopyPoint(point);
          }
        }
      }

      // 3. Ctrl+V for Paste Point
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (clipboardPoint && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          e.preventDefault();
          // Determine target from selection state
          let targetUutId = null;
          let targetAreaId = selectedAreaId;
          let targetRange = null;

          // Priority 0: Selected Range
          if (selectedRangeContext) {
            targetUutId = selectedRangeContext.uutId;
            targetRange = selectedRangeContext.range;
          }
          // Priority 1: Selected UUT Folder
          else if (selectedUutId) {
            targetUutId = selectedUutId;
          }
          // Priority 2: Selected Point's Context UUT
          else if (selectedTestPointId && selectedTestPointContextUutId) {
            targetUutId = selectedTestPointContextUutId;
          }

          if (targetUutId) {
            // Find area if needed
            if (!targetAreaId) {
              const uut = currentSessionData?.uuts?.find(u => u.id === targetUutId);
              if (uut) targetAreaId = uut.measurementAreaId;
            }
            handlePastePoint(targetUutId, targetAreaId, targetRange);
          }
        }
      }

      // 4. Delete Key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.key === 'Delete') {
          if (selectedTestPointId && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            handleDeleteTestPoint(selectedTestPointId);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [migrateToDisk, selectedTestPointId, selectedUutId, selectedTestPointContextUutId, clipboardPoint, currentTestPoints, currentSessionData, selectedAreaId, selectedRangeContext]);

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
            showToast(`Zoom Level: ${Math.round(newZoom * 100)}%`);
          } catch (error) {
            console.warn("Zoom adjustment failed", error);
          }
        }
      }
    };

    window.addEventListener("wheel", handleZoom, { passive: false });
    return () => window.removeEventListener("wheel", handleZoom);
  }, []);

  // --- DRAG AND DROP HANDLERS (AUTO-MOVE) ---

  const handleDragStart = (e, pointId) => {
    setDraggedPointId(pointId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, targetId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverTargetId !== targetId) {
      setDragOverTargetId(targetId);
    }
  };

  const handleDragLeave = (e) => {
    // Optional cleanup
  };

  const handleDrop = (e, targetUutId, targetAreaId, targetRange = null) => {
    e.preventDefault();
    setDragOverTargetId(null);

    if (!draggedPointId) return;

    const pointToProcess = currentTestPoints.find(p => p.id === draggedPointId);
    if (!pointToProcess) return;

    const targetUut = currentSessionData.uuts.find(u => u.id === targetUutId);

    // FIX: Robust Area ID Lookup
    let resolvedAreaId = targetAreaId;
    if (!resolvedAreaId && targetUut) {
         resolvedAreaId = targetUut.measurementAreaId;
         if (!resolvedAreaId && targetUut.measurementArea) {
             const area = currentSessionData.measurementAreas?.find(a => a.name === targetUut.measurementArea);
             if (area) resolvedAreaId = area.id;
         }
    }

    const updatedPointData = {
      ...pointToProcess,
      measurementAreaId: resolvedAreaId, // Use resolved ID
      associatedUutIds: [targetUutId],
    };

    // Tolerance Logic
    if (targetRange) {
      updatedPointData.uutTolerance = targetRange;
    } else if (targetUut) {
      const val = pointToProcess.testPointInfo?.parameter?.value;
      const unit = pointToProcess.testPointInfo?.parameter?.unit;
      const matched = findMatchingRange(targetUut, val, unit);
      updatedPointData.uutTolerance = matched || null;
    }

    // Save (Update existing ID)
    saveTestPoint(updatedPointData, null);
    showToast("Measurement point moved");
    setSelectedTestPointContextUutId(targetUutId);
    setDraggedPointId(null);
  };

  // --- SELECTION HANDLERS ---
  const handleSelectSession = (newId) => {
    setSelectedSessionId(newId);
    setSelectedTestPointId(null);
    setSelectedAreaId(null);
    setSelectedUutId(null);
    setSelectedRangeContext(null); // Clear range
    setVirtualPoint(null);
    setSelectedTestPointContextUutId(null);
    setCurrentUutSelection([]);
    setSelectedTablePointIds([]);
  };

  const handleSelectArea = (areaId) => {
    setSelectedAreaId(areaId);
    setSelectedUutId(null);
    setSelectedRangeContext(null); // Clear range
    setSelectedTestPointId(null);
    setSelectedTestPointContextUutId(null);
    setCurrentUutSelection([]);
    setVirtualPoint(null);
    setSelectedTablePointIds([]);
  };

  const handleSelectUut = (uutId, areaId, uutObject) => {
    setSelectedUutId(uutId);
    setSelectedAreaId(areaId);
    setSelectedRangeContext(null); // Clear range
    setSelectedTestPointId(null);
    setSelectedTestPointContextUutId(null);
    setCurrentUutSelection([uutId]);
    setVirtualPoint(null);
    setSelectedTablePointIds([]);
  };

  // --- NEW: Handle Range Selection ---
  const handleSelectRange = (uutId, range, areaId) => {
    setSelectedRangeContext({ uutId, range });
    setSelectedUutId(null);
    setSelectedTestPointId(null);
    setVirtualPoint(null);
    setSelectedAreaId(areaId);
    setSelectedTablePointIds([]);

    // Auto-select the UUT so the "Add Point" button knows what to link to
    setCurrentUutSelection([uutId]);
    // Set the active range index so the "Add Point" modal pre-selects this range
    setActiveRangeIndices(prev => ({ ...prev, [uutId]: range._id }));
  };

  const handleSelectTestPoint = (tpId, contextUutId = null) => {
    setSelectedTestPointId(tpId);
    setSelectedRangeContext(null); // Clear range
    setSelectedAreaId(null);
    setSelectedUutId(null);
    setVirtualPoint(null);
    setSelectedTestPointContextUutId(contextUutId);
    setCurrentUutSelection([]);
    setSelectedTablePointIds([]);
  };

  const handleAddNewSession = () => {
    const newSession = addSession();
    setEditingSession(newSession);
  };

  const toggleUutEmptyRanges = (uutId) => {
    const newSet = new Set(uutsShowingAllRanges);
    if (newSet.has(uutId)) {
      newSet.delete(uutId);
    } else {
      newSet.add(uutId);
    }
    setUutsShowingAllRanges(newSet);
  };

  const handleAddNewTestPoint = (areaId = null, specificUutId = null, specificRange = null) => {
    let initialData = {};

    if (specificUutId && specificRange) {
      initialData = {
        measurementAreaId: areaId,
        associatedUutIds: [specificUutId],
        uutTolerance: specificRange,
        testPointInfo: {
          parameter: {
            value: '',
            unit: specificRange.unit || ''
          }
        }
      };
      setSelectedTestPointContextUutId(specificUutId);
      setActiveRangeIndices(prev => ({ ...prev, [specificUutId]: specificRange._id || 0 }));
    }
    else if (specificUutId) {
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

      if (primaryUut && currentUutSelection.length === 1) {
        const availableRanges = getAllUutRanges(primaryUut);
        const selectedIndex = activeRangeIndices[primaryUutId];

        if (selectedIndex !== undefined && availableRanges[selectedIndex]) {
          initialData.uutTolerance = availableRanges[selectedIndex];
        } else if (availableRanges.length > 0) {
          initialData.uutTolerance = availableRanges[0];
        }
      }
    }
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
    if (!formData.id && formData.associatedUutIds && formData.associatedUutIds.length > 1) {
      const batchPoints = formData.associatedUutIds.map(uutId => ({
        ...formData,
        associatedUutIds: [uutId],
        uutTolerance: null
      }));
      saveTestPoint(batchPoints, null);
      setSelectedTestPointContextUutId(formData.associatedUutIds[0]);
    } else {
      const finalData = { ...formData };
      if (!finalData.measurementAreaId && selectedAreaId) finalData.measurementAreaId = selectedAreaId;

      if ((!finalData.associatedUutIds || finalData.associatedUutIds.length === 0) && currentUutSelection.length > 0) {
        finalData.associatedUutIds = currentUutSelection;
      }

      saveTestPoint(finalData, null);

      if (finalData.associatedUutIds && finalData.associatedUutIds.length > 0) {
        setSelectedTestPointContextUutId(finalData.associatedUutIds[0]);
      }
    }
    setIsAddModalOpen(false);
    setEditingTestPoint(null);
    setCurrentUutSelection([]);
  };

  // --- NEW: Inline update handler for sidebar edits ---
  const handleInlinePointUpdate = (updatedPoint) => {
      saveTestPoint(updatedPoint, null);
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

        const availableRanges = getAllUutRanges(uut);

        const categorizedPoints = new Set();
        const rangesWithPoints = availableRanges.map(range => {
          const pointsInRange = associatedPoints.filter(tp => {
            if (categorizedPoints.has(tp.id)) return false;

            // 1. Explicit Assignment: Check if tolerance is set
            if (tp.uutTolerance && Object.keys(tp.uutTolerance).length > 0) {
                 const t = tp.uutTolerance;
                 const minMatch = t.min == range.min;
                 const maxMatch = t.max == range.max;
                 const unitMatch = (t.unit || "") === (range.unit || "");
                 const funcMatch = range.functionName ? t.functionName === range.functionName : true;
                 
                 if (minMatch && maxMatch && unitMatch && funcMatch) {
                     categorizedPoints.add(tp.id);
                     return true;
                 }
                 // If tolerance is set explicitly but doesn't match this range, do NOT fallback to value
                 return false;
            }

            // 2. Implicit Assignment: Value Check
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

      let effectiveUutTolerance = (pointData.uutTolerance !== null && pointData.uutTolerance !== undefined && Object.keys(pointData.uutTolerance).length > 0)
        ? pointData.uutTolerance
        : currentSessionData.uutTolerance;

      let effectiveUutDescription = pointData.uutDescription || (
        pointData.associatedUutIds?.length > 0
          ? currentSessionData.uuts?.find(u => u.id === pointData.associatedUutIds[0])?.description
          : currentSessionData.uutDescription
      );

      let activeUutId = null;

      if (selectedTestPointContextUutId) {
        const contextUut = currentSessionData.uuts?.find(u => u.id === selectedTestPointContextUutId);
        if (contextUut) {
          effectiveUutDescription = contextUut.description;
          activeUutId = contextUut.id;

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
        viewMode: 'point',
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
        viewMode: 'point',
        activeUutId: activeUutId
      };
    }

    // --- NEW: Range View Mode ---
    if (selectedRangeContext) {
      return {
        viewMode: 'range',
        id: `${selectedRangeContext.uutId}-${selectedRangeContext.range._id}`, // Unique ID for React keys
        rangeData: selectedRangeContext.range,
        uutId: selectedRangeContext.uutId,
        measurementAreaId: selectedAreaId
      };
    }

    if (selectedUutId) {
      return { viewMode: 'uut', id: selectedUutId };
    }

    if (selectedAreaId) {
      return { viewMode: 'area', id: selectedAreaId };
    }

    if (selectedSessionId) {
      return { viewMode: 'session', id: selectedSessionId };
    }

    return null;
  }, [currentSessionData, selectedTestPointId, currentTestPoints, virtualPoint, selectedTestPointContextUutId, selectedUutId, selectedAreaId, selectedSessionId, selectedRangeContext]);


  return (
    <ThemeContext.Provider value={isDarkMode}>
      <div className="App">
        {/* --- TOAST NOTIFICATION --- */}
        {toast && (
          <div className="toast-notification">
            <FontAwesomeIcon icon={faCheckCircle} />
            <span>{toast}</span>
          </div>
        )}

        {/* ... (Existing Modals) ... */}
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
        {displayData && displayData.id && displayData.viewMode === 'point' && (<ToleranceToolModal isOpen={isToleranceModalOpen} onClose={() => setIsToleranceModalOpen(false)} onSave={(data) => { updateTestPointData(data); }} testPointData={displayData} />)}
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
                <div className="sidebar-view-controls">
                  <button onClick={handleAddNewSession} title="Add New Session" className="sidebar-action-button"><FontAwesomeIcon icon={faPlus} /></button>
                  <button onClick={() => handleOpenSessionEditor("details")} title="Edit Session" className="sidebar-action-button"><FontAwesomeIcon icon={faEdit} /></button>
                  <button onClick={() => handleDeleteSession(selectedSessionId)} title="Delete Session" className="sidebar-action-button delete"><FontAwesomeIcon icon={faTrashAlt} /></button>
                </div>
              </div>

              {/* === SIDEBAR LIST === */}
              <div className="measurement-point-list">

                {/* 1. DASHBOARD HOME BUTTON */}
                <div
                  className={`sidebar-session-card ${selectedSessionId && !selectedAreaId && !selectedTestPointId ? 'active' : ''}`}
                  onClick={() => handleSelectSession(selectedSessionId)}
                >
                  <div className="session-card-icon">
                    <FontAwesomeIcon icon={faFolderOpen} />
                  </div>
                  <div className="session-card-text">
                    <span className="session-card-title">Session Overview</span>
                    <span className="session-card-subtitle">{currentTestPoints.length} Points Total</span>
                  </div>
                </div>

                {sidebarData.map((areaData) => {
                // NEW: Determine if this Area is the strictly selected item
                const isAreaActive =
                  selectedAreaId === areaData.id &&
                  !selectedUutId &&
                  !selectedTestPointId &&
                  !selectedRangeContext;

                return (
                  <div key={areaData.id} className="measurement-group-container">
                    
                    {/* 2. STICKY AREA HEADER (Now uses 'active' class) */}
                    <div 
                      className={`area-header-sticky ${isAreaActive ? 'active' : ''}`}
                      onClick={() => handleSelectArea(areaData.id)}
                    >
                      <FontAwesomeIcon 
                        icon={faLayerGroup} 
                        style={{ 
                          color: isAreaActive ? 'var(--primary-color)' : (areaData.color || 'var(--primary-color)'), 
                          opacity: isAreaActive ? 1 : 0.7 
                        }} 
                        size="sm" 
                      />
                      <span className="area-label">{areaData.name}</span>
                    </div>

                    <div className="tree-branch">
                      
                      {/* 3. UUTs LOOP */}
                      {areaData.uutGroups.map(group => {
                        const isUutSelected = selectedUutId === group.id && !selectedTestPointId && !selectedRangeContext;
                        const isShowingAll = uutsShowingAllRanges.has(group.id);
                        const isDragOver = dragOverTargetId === group.id;

                        return (
                          <div key={group.id} style={{ marginBottom: '10px' }}>
                            
                            {/* UUT ITEM CARD */}
                            <div 
                              className={`uut-row ${isUutSelected ? 'active' : ''} ${isDragOver ? 'drag-over' : ''}`}
                              onClick={() => handleSelectUut(group.id, areaData.id, group)}
                              onDragOver={(e) => handleDragOver(e, group.id)}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, group.id, areaData.id)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenu({
                                  x: e.pageX, y: e.pageY,
                                  items: [
                                    { 
                                      label: "Paste Point Here", 
                                      action: () => handlePastePoint(group.id, areaData.id), 
                                      icon: faPaste,
                                      className: !clipboardPoint ? 'disabled' : '' 
                                    },
                                  ],
                                });
                              }}
                            >
                              <div className="uut-info">
                                <FontAwesomeIcon icon={faMicroscope} style={{ opacity: 0.6 }} />
                                <span>{group.description}</span>
                              </div>
                              <div className="uut-actions-group">
                                <button
                                  className={`btn-icon-only small ${isShowingAll ? 'active' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); toggleUutEmptyRanges(group.id); }}
                                  title={isShowingAll ? "Hide Empty Ranges" : "Show All Ranges"}
                                >
                                  <FontAwesomeIcon icon={isShowingAll ? faEyeSlash : faEye} size="xs" />
                                </button>
                                <button
                                  className="btn-icon-only small"
                                  onClick={(e) => { e.stopPropagation(); handleAddNewTestPoint(areaData.id, group.id); }}
                                  title="Add Point"
                                >
                                  <FontAwesomeIcon icon={faPlus} size="xs" />
                                </button>
                              </div>
                            </div>

                            {/* 4. RANGES LOOP */}
                            <div style={{ paddingLeft: '15px' }}>
                              {group.rangeGroups.map(range => {
                                if (!isShowingAll && range.points.length === 0) return null;
                                const rangeKey = `${group.id}-${range._id}`;
                                const isRangeDragOver = dragOverTargetId === rangeKey;
                                
                                const isRangeSelected = selectedRangeContext && 
                                                        selectedRangeContext.uutId === group.id && 
                                                        selectedRangeContext.range._id === range._id;

                                return (
                                  <div key={`range-${range._id}`} style={{ marginBottom: '8px' }}>
                                    
                                    {/* RANGE HEADER */}
                                    <div 
                                      className={`range-label-row ${isRangeDragOver ? 'drag-over' : ''} ${isRangeSelected ? 'active' : ''}`}
                                      onClick={(e) => { 
                                          e.stopPropagation(); 
                                          handleSelectRange(group.id, range, areaData.id); 
                                      }}
                                      onDragOver={(e) => handleDragOver(e, rangeKey)}
                                      onDrop={(e) => handleDrop(e, group.id, areaData.id, range)}
                                      onContextMenu={(e) => {
                                        e.preventDefault();
                                        setContextMenu({
                                          x: e.pageX, y: e.pageY,
                                          items: [
                                            { 
                                              label: "Paste Point in Range", 
                                              action: () => handlePastePoint(group.id, areaData.id, range), 
                                              icon: faPaste,
                                              className: !clipboardPoint ? 'disabled' : '' 
                                            },
                                          ],
                                        });
                                      }}
                                    >
                                      <FontAwesomeIcon icon={faRulerCombined} size="xs" style={{ opacity: isRangeSelected ? 1 : 0.5 }} />
                                      <span>{range.label}</span>
                                    </div>

                                    {/* 5. POINTS */}
                                    {range.points.length === 0 ? (
                                      <div className="empty-branch-msg"></div>
                                    ) : (
                                      <>
                                      {/* Column Headers for Points */}
                                      <div style={{ 
                                          display: 'grid',  /* Changed to Grid to match item */
                                          gridTemplateColumns: '45px 1fr', /* Match item columns */
                                          fontSize: '0.7rem', 
                                          color: 'var(--text-color-muted)', 
                                          padding: '0 12px 4px 12px', 
                                          marginBottom: '2px',
                                          borderBottom: '1px solid var(--border-color)',
                                          borderLeft: '4px solid transparent',
                                          opacity: 0.7,
                                          gap: '10px' 
                                      }}>
                                          <span style={{textAlign: 'right', paddingRight: '2px'}}>Sect.</span>
                                          <span>Point</span>
                                      </div>
                                      {range.points.map(tp => {

                                        const isSelected = selectedTestPointId === tp.id && selectedTestPointContextUutId === group.id;
                                        return (
                                          <SidebarPointItem 
                                            key={tp.id}
                                            point={tp}
                                            isSelected={isSelected}
                                            isTableSelected={selectedTablePointIds.includes(tp.id)}
                                            onSelect={() => handleSelectTestPoint(tp.id, group.id)}
                                            onModalOpen={(p) => { setEditingTestPoint(p); setIsAddModalOpen(true); }}
                                            onSave={handleInlinePointUpdate}
                                            onDragStart={handleDragStart}
                                            onContextMenu={(e, p) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setContextMenu({
                                                    x: e.pageX, y: e.pageY,
                                                    items: [
                                                    { label: "Copy Point", action: () => handleCopyPoint(p), icon: faCopy },
                                                    { label: "Delete Point", action: () => handleDeleteTestPoint(p.id), icon: faTrashAlt, className: "destructive" },
                                                    ],
                                                });
                                            }}
                                          />
                                        );
                                      })}
                                      </>
                                    )}
                                  </div>
                                );
                              })}

                              {/* Uncategorized Points */}
                              {group.uncategorizedPoints && group.uncategorizedPoints.length > 0 && (
                                <div style={{ marginTop: '8px' }}>
                                   <div className="range-label-row" style={{ color: 'var(--status-warning)' }}>
                                      <FontAwesomeIcon icon={faLayerGroup} size="xs" />
                                      <span>Other Points</span>
                                    </div>
                                    {group.uncategorizedPoints.map(tp => (
                                      <SidebarPointItem 
                                        key={tp.id}
                                        point={tp}
                                        isSelected={selectedTestPointId === tp.id}
                                        isTableSelected={selectedTablePointIds.includes(tp.id)}
                                        onSelect={() => handleSelectTestPoint(tp.id, group.id)}
                                        onModalOpen={(p) => { setEditingTestPoint(p); setIsAddModalOpen(true); }}
                                        onSave={handleInlinePointUpdate}
                                        onDragStart={handleDragStart}
                                        onContextMenu={(e, p) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setContextMenu({
                                                x: e.pageX, y: e.pageY,
                                                items: [
                                                { label: "Copy Point", action: () => handleCopyPoint(p), icon: faCopy },
                                                { label: "Delete Point", action: () => handleDeleteTestPoint(p.id), icon: faTrashAlt, className: "destructive" },
                                                ],
                                            });
                                        }}
                                      />
                                    ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Unassigned Points */}
                      {areaData.unassignedPoints.length > 0 && (
                          <div style={{ marginTop: '15px', paddingLeft: '10px' }}>
                           <div className="range-label-row" style={{ color: 'var(--text-color-muted)' }}>
                              <FontAwesomeIcon icon={faLayerGroup} size="xs" style={{opacity: 0.5}}/>
                              <span>Unassigned Points</span>
                           </div>
                           {areaData.unassignedPoints.map(tp => (
                             <SidebarPointItem 
                                key={tp.id}
                                point={tp}
                                isSelected={selectedTestPointId === tp.id}
                                isTableSelected={selectedTablePointIds.includes(tp.id)}
                                onSelect={() => handleSelectTestPoint(tp.id, null)}
                                onModalOpen={(p) => { setEditingTestPoint(p); setIsAddModalOpen(true); }}
                                onSave={handleInlinePointUpdate}
                                onDragStart={handleDragStart}
                                onContextMenu={(e, p) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setContextMenu({
                                        x: e.pageX, y: e.pageY,
                                        items: [
                                        { label: "Copy Point", action: () => handleCopyPoint(p), icon: faCopy },
                                        { label: "Delete Point", action: () => handleDeleteTestPoint(p.id), icon: faTrashAlt, className: "destructive" },
                                        ],
                                    });
                                }}
                             />
                           ))}
                         </div>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </aside>

            <main className="results-content">
              {displayData ? (
                <TestPointDetailView
                  key={displayData.id || `view-${displayData.viewMode}`}
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
                    currentUutSelection={currentUutSelection}
                    setCurrentUutSelection={setCurrentUutSelection}
                    activeRangeIndices={activeRangeIndices}
                    onRangeSelectionChange={setActiveRangeIndices}
                    selectedTablePointIds={selectedTablePointIds}
                    setSelectedTablePointIds={setSelectedTablePointIds}
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