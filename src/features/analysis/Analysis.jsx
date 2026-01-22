/**
 * * Responsibilities:
 * - Manages Top-Level State (Tabs, Modals).
 * - Calls useUncertaintyCalculation & useRiskCalculation hooks.
 * - Renders the appropriate dashboard based on the selected tab.
 */

import React, { useState, useMemo, useEffect } from "react";

// --- Custom Hooks ---
import { useUncertaintyCalculation } from "./hooks/useUncertaintyCalculation";
import { useRiskCalculation } from "./hooks/useRiskCalculation";

// --- Sub-Components ---
import AnalysisHeader from "./components/AnalysisHeader";
import ManualComponentModal from "./components/ManualComponentModal";
import UncertaintyPanel from "./components/UncertaintyPanel";
import RiskAnalysisDashboard from "./components/RiskAnalysisDashboard";
import RiskMitigationDashboard from "./components/RiskMitigationDashboard";
import RiskScatterplot from "./components/RiskScatterplot";

// --- Modals ---
import NotificationModal from "../../components/modals/NotificationModal";
import AddTmdeModal from "../instruments/components/AddTmdeModal";
import EditUutModal from "../instruments/components/EditUutModal";
import DerivedBreakdownModal from "./components/BreakdownModals/DerivedBreakdownModal";
import RiskBreakdownModal from "./components/BreakdownModals/RiskBreakdownModals";
import RepeatabilityModal from "./components/RepeatabilityModal";

// --- FIX: Adjusted import path assuming file is in features/analysis/components/ ---
import AddTestPointModal from "../testPoints/components/AddTestPointModal";

// --- Utils ---
import {
  convertToPPM,
  recalculateTolerance
} from "../../utils/uncertaintyMath";

function Analysis({
  sessionData,
  testPointData,
  onDataSave,
  onSessionSave,
  onSaveTestPoint,
  defaultTestPoint,
  setContextMenu,
  setBreakdownPoint,
  handleOpenSessionEditor,
  // Props lifted from App.js
  instruments,
  onDeleteTmdeDefinition,
  onDecrementTmdeQuantity,
  onDeleteUut,
  onDeleteTestPoint,
  // Shared State lifted from App.js
  riskResults: parentRiskResults,
  setRiskResults: parentSetRiskResults,
  
  // --- NEW: Global UUT Selection Props ---
  currentUutSelection = [],
  setCurrentUutSelection,
  activeRangeIndices,
  onRangeSelectionChange,
}) {
  // --- 1. Local UI State ---
  const [analysisMode, setAnalysisMode] = useState("uncertaintyTool");
  const [showContribution, setShowContribution] = useState(false);
  const [notification, setNotification] = useState(null);

  // Modal States
  const [isAddTmdeModalOpen, setAddTmdeModalOpen] = useState(false);
  const [isUutModalOpen, setIsUutModalOpen] = useState(false);
  const [tmdeToEdit, setTmdeToEdit] = useState(null);
  const [modalOverrides, setModalOverrides] = useState(null);

  // New State for Test Point Definition
  const [isTestPointModalOpen, setTestPointModalOpen] = useState(false);

  const [isManualModalOpen, setManualModalOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState(null);

  const [isRepeatabilityModalOpen, setRepeatabilityModalOpen] = useState(false);
  const [modalPosition, setModalPosition] = useState(null);

  const [activeRiskModals, setActiveRiskModals] = useState([]);

  const [isDerivedBreakdownOpen, setIsDerivedBreakdownOpen] = useState(false);
  const [derivedBreakdownData, setDerivedBreakdownData] = useState(null);

  // --- NEW: TMDE Selection State ---
  const [selectedTmdeIds, setSelectedTmdeIds] = useState([]);

  // --- 2. Memoized Data Lookups ---
  const uutNominal = useMemo(
    () => testPointData?.testPointInfo?.parameter,
    [testPointData?.testPointInfo?.parameter]
  );

  const uutToleranceData = useMemo(
    () => testPointData.uutTolerance || sessionData.uutTolerance || {},
    [testPointData.uutTolerance, sessionData.uutTolerance]
  );

  const tmdeTolerancesData = useMemo(
    () => testPointData.tmdeTolerances || [],
    [testPointData.tmdeTolerances]
  );

  const manualComponents = useMemo(() => {
    return testPointData.components || [];
  }, [testPointData.components]);

  // Reset selection when test point changes
  useEffect(() => {
    setSelectedTmdeIds([]);
  }, [testPointData.id]);

  // --- 3. Uncertainty Calculation Hook ---
  const { calcResults, calculationError } = useUncertaintyCalculation(
    testPointData,
    sessionData,
    tmdeTolerancesData,
    uutToleranceData,
    uutNominal,
    manualComponents,
    onDataSave
  );

  // --- 4. Risk Calculation Hook ---
  const handleRiskDataSave = (data) => {
    if (data.riskMetrics !== undefined && parentSetRiskResults) {
      parentSetRiskResults(data.riskMetrics);
    }
    onDataSave(data);
  };

  const {
    riskResults,
    riskInputs,
    notification: riskNotification
  } = useRiskCalculation(
    sessionData,
    testPointData,
    uutToleranceData,
    tmdeTolerancesData,
    uutNominal,
    calcResults,
    analysisMode,
    handleRiskDataSave
  );

  if (riskNotification && !notification) {
    setNotification(riskNotification);
  }

  // --- 5. Handlers ---

  // --- TMDE Selection Handlers ---
  const handleToggleTmdeSelection = (id) => {
    setSelectedTmdeIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(tid => tid !== id);
      }
      return [...prev, id];
    });
  };

  const handleToggleAllTmdes = () => {
    if (selectedTmdeIds.length === tmdeTolerancesData.length) {
      setSelectedTmdeIds([]);
    } else {
      setSelectedTmdeIds(tmdeTolerancesData.map(t => t.id));
    }
  };

  const handleToggleUut = (uutId) => {
    if (!uutId && uutId !== 0) return;
    
    // Ensure we are working with global selection
    const isSelected = currentUutSelection.some(id => String(id) === String(uutId));
    let newIds;
    
    if (isSelected) {
      newIds = currentUutSelection.filter(id => String(id) !== String(uutId));
    } else {
      newIds = [...currentUutSelection, uutId];
    }
    
    if (setCurrentUutSelection) {
        setCurrentUutSelection(newIds);
    }
  };

  const handleSaveUut = ({ description, tolerance, instrument }) => {
    onDataSave({ uutTolerance: tolerance });

    if (onSessionSave) {
      const updatedTestPoint = { ...testPointData, uutTolerance: tolerance };
      const updatedTestPointsList = (sessionData.testPoints || []).map(tp =>
        tp.id === testPointData.id ? updatedTestPoint : tp
      );

      onSessionSave({
        ...sessionData,
        testPoints: updatedTestPointsList,
        uutDescription: description,
        uutTolerance: tolerance,
        uutInstrument: instrument || sessionData.uutInstrument
      });
    } else {
      console.error("onSessionSave prop missing in Analysis.jsx");
    }
  };

  const handleSaveTmde = (tmdeToSave, andClose = true) => {
    const existingIndex = tmdeTolerancesData.findIndex((t) => t.id === tmdeToSave.id);
    let updatedTolerances;
    if (existingIndex > -1) {
      updatedTolerances = tmdeTolerancesData.map((t, index) =>
        index === existingIndex ? tmdeToSave : t
      );
    } else {
      updatedTolerances = [...tmdeTolerancesData, tmdeToSave];
    }
    onDataSave({ tmdeTolerances: updatedTolerances });

    if (andClose) {
      setAddTmdeModalOpen(false);
      setTmdeToEdit(null);
    }
  };

  const handleSaveTestPointInfo = (updatedData) => {
    if (onSaveTestPoint) {
      // If we are CREATING a new point (no ID yet)
      // We need to inject the selected TMDEs with RESET values

      let finalData = { ...updatedData };

      // Check if this is a creation event (usually implied if passed from AddTestPointModal without an ID)
      // AddTestPointModal calls onSave({ ...data })
      // If editing, it calls onSave({ id: ..., ...data })

      if (!finalData.id && selectedTmdeIds.length > 0) {
        const selectedTmdes = tmdeTolerancesData.filter(t => selectedTmdeIds.includes(t.id));

        const resetTmdes = selectedTmdes.map(t => ({
          ...t,
          id: Date.now() + Math.random(), // Ensure unique ID for new instance
          measurementPoint: {
            ...t.measurementPoint,
            value: ""  // RESET VALUE
          }
        }));

        finalData.tmdeTolerances = resetTmdes;
        finalData.copyTmdes = false; // Disable default copy behavior since we handled it
      } else if (!finalData.id && selectedTmdeIds.length === 0) {
        // If nothing selected, ensure we don't copy anything implicitly
        finalData.copyTmdes = false;
        finalData.tmdeTolerances = [];
      }

      onSaveTestPoint(finalData);
    } else {
      onDataSave(updatedData);
    }
    setTestPointModalOpen(false);
    
    // Clear Global Selection after saving new point
    if (setCurrentUutSelection) setCurrentUutSelection([]);
  };

  const handleSaveManualComponent = (componentData) => {
    let updatedComponents;
    if (editingComponent) {
      updatedComponents = manualComponents.map((c) =>
        c.id === editingComponent.id ? componentData : c
      );
    } else {
      updatedComponents = [...manualComponents, { ...componentData, id: Date.now() }];
    }
    onDataSave({ components: updatedComponents });
    setManualModalOpen(false);
    setEditingComponent(null);
  };

  const handleEditComponent = (event, component) => {
    setEditingComponent(component);
    if (component.id.toString().includes('repeatability') || component.name === 'Repeatability') {
      if (event && event.clientY) {
        setModalPosition({ top: event.clientY, left: event.clientX });
      } else {
        setModalPosition(null);
      }
      setRepeatabilityModalOpen(true);
    } else {
      setManualModalOpen(true);
    }
  };

  const handleRemoveComponent = (id) => {
    const updatedComponents = manualComponents.filter((c) => c.id !== id);
    if (updatedComponents.length < manualComponents.length) {
      onDataSave({ components: updatedComponents });
    } else {
      setNotification({
        title: "Action Not Allowed",
        message: "Core budget components cannot be removed here.",
      });
    }
  };

  const handleSaveRepeatability = (data) => {
    const { value: ppm, warning } = convertToPPM(
      data.stdDev,
      data.unit,
      uutNominal?.value,
      uutNominal?.unit,
      null,
      true
    );

    if (warning) {
      setNotification({ title: "Conversion Error", message: warning });
      return;
    }

    const isEditing = editingComponent && editingComponent.id.toString().includes('repeatability');
    const newId = isEditing ? editingComponent.id : `repeatability_${Date.now()}`;

    const componentData = {
      id: newId,
      name: "Repeatability",
      sourcePointLabel: `N=${data.count}, Mean=${data.mean.toPrecision(5)}`,
      type: "A",
      value: ppm,
      value_native: data.stdDev,
      unit_native: data.unit,
      dof: data.dof,
      distribution: "Normal",
      isCore: false,
      savedInputs: data
    };

    let updatedComponents;
    if (isEditing) {
      updatedComponents = manualComponents.map((c) =>
        c.id === newId ? componentData : c
      );
    } else {
      updatedComponents = [...manualComponents, componentData];
    }

    onDataSave({ components: updatedComponents });
    setEditingComponent(null);
    setRepeatabilityModalOpen(false);
  };

  const handleBudgetRowContextMenu = (event, componentData) => {
    event.preventDefault();
    if (testPointData.measurementType !== "derived" || !calcResults) return;

    const breakdownPayload = {
      equationString: testPointData.equationString,
      components: calcResults.calculatedBudgetComponents || [],
      results: calcResults,
      derivedNominalPoint: uutNominal,
      tmdeTolerances: tmdeTolerancesData,
    };

    setDerivedBreakdownData(breakdownPayload);
    setIsDerivedBreakdownOpen(true);
  };

  const handleShowRiskBreakdown = (type) => {
    setActiveRiskModals(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  };

  const handleCloseRiskBreakdown = (type) => {
    setActiveRiskModals(prev => prev.filter(t => t !== type));
  };

  const handleInlineUutUpdate = (field, value) => {
    if (field === 'description') {
      if (onSessionSave) {
        onSessionSave({ ...sessionData, uutDescription: value });
      }
    } else if (field === 'nominal') {
      const currentParam = testPointData.testPointInfo?.parameter || {};
      const newParam = { ...currentParam, value: parseFloat(value) };
      const updatedTestPointInfo = {
        ...testPointData.testPointInfo,
        parameter: newParam
      };
      onDataSave({ testPointInfo: updatedTestPointInfo });
    }
  };

  const handleInlineTmdeUpdate = (id, field, value) => {
    const tmdeToUpdate = tmdeTolerancesData.find(t => t.id === id);
    if (!tmdeToUpdate) return;

    const newTmde = { ...tmdeToUpdate };
    if (field === 'name') {
      newTmde.name = value;
    } else if (field === 'nominal') {
      newTmde.measurementPoint = {
        ...newTmde.measurementPoint,
        value: parseFloat(value)
      };
    } else if (field === 'variableType') {
      newTmde.variableType = value;
    } else if (field === 'unit') {
      newTmde.measurementPoint = {
        ...newTmde.measurementPoint,
        unit: value
      };
    }
    handleSaveTmde(newTmde, false);
  };

  return (
    <div>
      <AnalysisHeader
        sessionData={sessionData}
        onEditSession={handleOpenSessionEditor}
      />

      <NotificationModal
        isOpen={!!notification}
        onClose={() => setNotification(null)}
        {...notification}
      />

      <EditUutModal
        isOpen={isUutModalOpen}
        onClose={() => setIsUutModalOpen(false)}
        onSave={handleSaveUut}
        initialDescription={sessionData.uutDescription}
        initialTolerance={uutToleranceData}
        instruments={instruments}
        uutNominal={uutNominal}
      />

      <AddTmdeModal
        isOpen={isAddTmdeModalOpen}
        onClose={() => { setAddTmdeModalOpen(false); setTmdeToEdit(null); }}
        onSave={handleSaveTmde}
        testPointData={testPointData}
        initialTmdeData={tmdeToEdit}
        instruments={instruments}
      />

      <AddTestPointModal
        isOpen={isTestPointModalOpen}
        onClose={() => {
            setTestPointModalOpen(false);
            setModalOverrides(null);
        }}
        onSave={handleSaveTestPointInfo}
        initialData={modalOverrides} 
        previousTestPointData={testPointData}
      />

      <ManualComponentModal
        isOpen={isManualModalOpen}
        onClose={() => { setManualModalOpen(false); setEditingComponent(null); }}
        onSave={handleSaveManualComponent}
        existingComponent={editingComponent}
        uutNominal={uutNominal}
      />

      <RepeatabilityModal
        isOpen={isRepeatabilityModalOpen}
        onClose={() => { setRepeatabilityModalOpen(false); setEditingComponent(null); }}
        onSave={handleSaveRepeatability}
        uutNominal={uutNominal}
        existingData={editingComponent}
        position={modalPosition}
      />

      <DerivedBreakdownModal
        isOpen={isDerivedBreakdownOpen}
        onClose={() => setIsDerivedBreakdownOpen(false)}
        breakdownData={derivedBreakdownData}
      />

      {activeRiskModals.map(type => (
        <RiskBreakdownModal
          key={type}
          isOpen={true}
          onClose={() => handleCloseRiskBreakdown(type)}
          modalType={type}
          data={{
            results: riskResults,
            inputs: riskResults ? {
              LLow: parseFloat(riskInputs.LLow),
              LUp: parseFloat(riskInputs.LUp),
              reliability: parseFloat(sessionData.uncReq.reliability),
              guardBandMultiplier: parseFloat(sessionData.uncReq.guardBandMultiplier),
              guardBandInputs: riskResults.gbInputs,
            } : null,
          }}
        />
      ))}

      <div className="analysis-tabs">
        <button
          className={analysisMode === "uncertaintyTool" ? "active" : ""}
          onClick={() => setAnalysisMode("uncertaintyTool")}
        >
          Uncertainty Analysis
        </button>
        <button
          className={analysisMode === "risk" ? "active" : ""}
          onClick={() => setAnalysisMode("risk")}
        >
          Risk Analysis
        </button>
        <button
          className={analysisMode === "riskmitigation" ? "active" : ""}
          onClick={() => {
            setAnalysisMode("riskmitigation");
            const gbLowValid = riskResults?.gbResults?.GBLOW !== undefined && !isNaN(riskResults.gbResults.GBLOW);
            const gbUpValid = riskResults?.gbResults?.GBUP !== undefined && !isNaN(riskResults.gbResults.GBUP);

            if (!gbLowValid || !gbUpValid) {
              const inputs = riskResults?.gbInputs || {};
              const reqTUR = inputs.reqTUR || "N/A";
              const achievedTUR = inputs.turVal ? inputs.turVal.toFixed(2) : "N/A";
              const uCal = inputs.combUnc ? inputs.combUnc.toPrecision(4) : "N/A";
              const unit = inputs.nominalUnit || "";
              let topContributorString = "N/A";
              if (calcResults && calcResults.calculatedBudgetComponents) {
                const sortedComponents = [...calcResults.calculatedBudgetComponents].sort((a, b) =>
                  Math.abs(b.contribution || 0) - Math.abs(a.contribution || 0)
                );
                const topComp = sortedComponents[0];
                if (topComp && typeof topComp.contribution === 'number') {
                  topContributorString = `${topComp.name} (${topComp.contribution.toPrecision(4)} ${unit})`;
                }
              }

              setNotification({
                title: "Math Engine Convergence Failure",
                isFloating: true,
                message: `The mathematical engine could not converge on guard band limits because the required TUR is so low, causing the calculated Uncertainty to exceed allowable limits.

Diagnostic Data:
• Required TUR: ${reqTUR}
• Achieved TUR: ${achievedTUR}
• Total Uncertainty (u_cal): ${uCal} ${unit}

Primary Contributor:
• ${topContributorString}

Please increase the required TUR or improve your uncertainty to allow for a viable solution.`
              });
            }
          }}
        >
          Risk Mitigation
        </button>
      </div>

      {analysisMode === "uncertaintyTool" && (
        <UncertaintyPanel
          testPointData={testPointData}
          sessionData={sessionData}
          calcResults={calcResults}
          calculationError={calculationError}
          uutNominal={uutNominal}
          uutToleranceData={uutToleranceData}
          tmdeTolerancesData={tmdeTolerancesData}
          riskResults={riskResults}

          showContribution={showContribution}
          setShowContribution={setShowContribution}

          onAddManualComponent={() => { setEditingComponent(null); setManualModalOpen(true); }}
          onEditManualComponent={handleEditComponent}
          onRemoveComponent={handleRemoveComponent}
          onAddTmde={() => { setTmdeToEdit(null); setAddTmdeModalOpen(true); }}
          onEditTmde={(tmde) => { setTmdeToEdit(tmde); setAddTmdeModalOpen(true); }}
          onDeleteTmdeDefinition={onDeleteTmdeDefinition}
          onDecrementTmdeQuantity={onDecrementTmdeQuantity}

          onOpenUutModal={() => setIsUutModalOpen(true)}
          
          onDeleteUut={onDeleteUut}
          onInlineUutUpdate={handleInlineUutUpdate}
          onInlineTmdeUpdate={handleInlineTmdeUpdate}

          handleOpenSessionEditor={handleOpenSessionEditor}

          onUpdateTestPoint={onDataSave}

          onDefineTestPoint={(selectedUutIds, resolvedTolerance) => {
             const overrides = {};
             
             if (selectedUutIds && Array.isArray(selectedUutIds)) {
                 overrides.associatedUutIds = selectedUutIds;
             }
             
             if (resolvedTolerance) {
                 overrides.uutTolerance = resolvedTolerance;
             }
             
             setModalOverrides(overrides);
             setTestPointModalOpen(true);
          }}

          // --- Pass Selection Props ---
          selectedTmdeIds={selectedTmdeIds}
          onToggleTmdeSelection={handleToggleTmdeSelection}
          onToggleAllTmdes={handleToggleAllTmdes}

          // --- Pass UUT Toggle Handler ---
          onToggleUut={handleToggleUut}
          
          // --- Pass Global UUT Selection Props ---
          currentUutSelection={currentUutSelection}

          setContextMenu={setContextMenu}
          setBreakdownPoint={setBreakdownPoint}
          onBudgetRowContextMenu={handleBudgetRowContextMenu}
          onShowDerivedBreakdown={() => {
            if (calcResults) handleBudgetRowContextMenu({ preventDefault: () => { } });
          }}
          onShowRiskBreakdown={handleShowRiskBreakdown}
          onOpenRepeatability={(e) => {
            if (e && e.clientY) setModalPosition({ top: e.clientY, left: e.clientX });
            setEditingComponent(null);
            setRepeatabilityModalOpen(true);
          }}
          setNotification={setNotification}
          onDeleteTestPoint={onDeleteTestPoint}
          activeRangeIndices={activeRangeIndices}
          onRangeSelectionChange={onRangeSelectionChange}
        />
      )}

      {analysisMode === "risk" && (
        <div>
          {!calcResults ? (
            <div className="form-section-warning">
              <p>Uncertainty budget must be calculated first.</p>
            </div>
          ) : (
            <>
              {riskResults ? (
                <>
                  <RiskAnalysisDashboard
                    results={riskResults}
                    onShowBreakdown={handleShowRiskBreakdown}
                    activeModals={activeRiskModals}
                  />
                  <RiskScatterplot
                    results={riskResults}
                    inputs={{
                      LLow: parseFloat(riskInputs.LLow),
                      LUp: parseFloat(riskInputs.LUp),
                    }}
                  />
                </>
              ) : (
                <div className="placeholder-content" style={{ minHeight: "200px" }}>
                  <p>Calculating risk...</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {analysisMode === "riskmitigation" && (
        <>
          {!calcResults ? (
            <div className="form-section-warning">
              <p>Uncertainty budget must be calculated first.</p>
            </div>
          ) : (
            <>
              {riskResults ? (
                <RiskMitigationDashboard
                  results={riskResults}
                  onShowBreakdown={handleShowRiskBreakdown}
                  activeModals={activeRiskModals}
                />
              ) : (
                <div className="placeholder-content" style={{ minHeight: "200px" }}>
                  <p>Calculating risk...</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default Analysis;