/**
 * * Responsibilities:
 * - Manages Top-Level State (Tabs, Modals).
 * - Calls useUncertaintyCalculation & useRiskCalculation hooks.
 * - Renders the appropriate dashboard based on the selected tab.
 */

import React, { useState, useMemo } from "react";

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
import DerivedBreakdownModal from "./components/BreakdownModals/DerivedBreakdownModal";
import RiskBreakdownModal from "./components/BreakdownModals/RiskBreakdownModals";
import RepeatabilityModal from "./components/RepeatabilityModal";

// --- Utils ---
import { convertToPPM } from "../../utils/uncertaintyMath";

function Analysis({
  sessionData,
  testPointData,
  onDataSave,
  defaultTestPoint,
  setContextMenu,
  setBreakdownPoint,
  handleOpenSessionEditor,
  // Props lifted from App.js
  instruments,
  onDeleteTmdeDefinition,
  onDecrementTmdeQuantity,
  onOpenOverview,
  // Shared State lifted from App.js
  riskResults: parentRiskResults, 
  setRiskResults: parentSetRiskResults 
}) {
  // --- 1. Local UI State ---
  const [analysisMode, setAnalysisMode] = useState("uncertaintyTool"); // Tabs: uncertaintyTool, risk, riskmitigation
  const [showContribution, setShowContribution] = useState(false);
  const [notification, setNotification] = useState(null);
  
  // Modal States
  const [isAddTmdeModalOpen, setAddTmdeModalOpen] = useState(false);
  const [tmdeToEdit, setTmdeToEdit] = useState(null);
  const [isManualModalOpen, setManualModalOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState(null);
  const [isRepeatabilityModalOpen, setRepeatabilityModalOpen] = useState(false);
  const [breakdownModalType, setBreakdownModalType] = useState(null); // For Risk Breakdown
  const [isDerivedBreakdownOpen, setIsDerivedBreakdownOpen] = useState(false);
  const [derivedBreakdownData, setDerivedBreakdownData] = useState(null);

  // --- 2. Memoized Data Lookups ---
  const uutNominal = useMemo(
    () => testPointData?.testPointInfo?.parameter,
    [testPointData?.testPointInfo?.parameter]
  );
  
  const uutToleranceData = useMemo(
    () => sessionData.uutTolerance || {},
    [sessionData.uutTolerance]
  );
  
  const tmdeTolerancesData = useMemo(
    () => testPointData.tmdeTolerances || [],
    [testPointData.tmdeTolerances]
  );

  const manualComponents = useMemo(() => {
    return testPointData.measurementType === "direct"
      ? testPointData.components || []
      : [];
  }, [testPointData.measurementType, testPointData.components]);

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
  // Wrapper to sync hook results with parent App.js state (setRiskResults)
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
    handleRiskDataSave // Use wrapper
  );

  // Sync risk notification to local notification
  if (riskNotification && !notification) {
    setNotification(riskNotification);
  }

  // --- 5. Handlers ---

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

    const componentData = {
        id: `repeatability_${Date.now()}`,
        name: "Repeatability",
        sourcePointLabel: `N=${data.count}, Mean=${data.mean.toPrecision(5)}`,
        type: "A",
        value: ppm,
        value_native: data.stdDev, 
        unit_native: data.unit,
        dof: data.dof,
        distribution: "Normal",
        isCore: false
    };

    const updatedComponents = [...manualComponents, componentData];
    onDataSave({ components: updatedComponents });
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

  return (
    <div>
      {/* --- HEADER --- */}
      <AnalysisHeader 
        sessionData={sessionData} 
        onOpenOverview={onOpenOverview} 
      />

      {/* --- MODALS --- */}
      <NotificationModal
        isOpen={!!notification}
        onClose={() => setNotification(null)}
        {...notification}
      />

      <AddTmdeModal
        isOpen={isAddTmdeModalOpen}
        onClose={() => { setAddTmdeModalOpen(false); setTmdeToEdit(null); }}
        onSave={handleSaveTmde}
        testPointData={testPointData}
        initialTmdeData={tmdeToEdit}
        instruments={instruments}
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
        onClose={() => setRepeatabilityModalOpen(false)}
        onSave={handleSaveRepeatability}
        uutNominal={uutNominal}
      />

      <DerivedBreakdownModal
        isOpen={isDerivedBreakdownOpen}
        onClose={() => setIsDerivedBreakdownOpen(false)}
        breakdownData={derivedBreakdownData}
      />

      <RiskBreakdownModal
        isOpen={!!breakdownModalType}
        onClose={() => setBreakdownModalType(null)}
        modalType={breakdownModalType}
        data={{
          results: riskResults,
          inputs: riskResults ? {
            LLow: parseFloat(riskInputs.LLow),
            LUp: parseFloat(riskInputs.LUp),
            reliability: parseFloat(sessionData.uncReq.reliability),
            guardBandMultiplier: parseFloat(sessionData.uncReq.guardBandMultiplier),
            ...riskResults.gbInputs,
          } : null,
        }}
      />

      {/* --- TABS --- */}
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
          onClick={() => setAnalysisMode("riskmitigation")}
        >
          Risk Mitigation
        </button>
      </div>

      {/* --- UNCERTAINTY VIEW --- */}
      {analysisMode === "uncertaintyTool" && (
        <UncertaintyPanel 
          // Data
          testPointData={testPointData}
          sessionData={sessionData}
          calcResults={calcResults}
          calculationError={calculationError}
          uutNominal={uutNominal}
          uutToleranceData={uutToleranceData}
          tmdeTolerancesData={tmdeTolerancesData}
          riskResults={riskResults}
          
          // State
          showContribution={showContribution}
          setShowContribution={setShowContribution}

          // Handlers
          onAddManualComponent={() => { setEditingComponent(null); setManualModalOpen(true); }}
          onEditManualComponent={(c) => { setEditingComponent(c); setManualModalOpen(true); }}
          onRemoveComponent={handleRemoveComponent}
          onAddTmde={() => { setTmdeToEdit(null); setAddTmdeModalOpen(true); }}
          onEditTmde={(tmde) => { setTmdeToEdit(tmde); setAddTmdeModalOpen(true); }}
          onDeleteTmdeDefinition={onDeleteTmdeDefinition}
          onDecrementTmdeQuantity={onDecrementTmdeQuantity}
          handleOpenSessionEditor={handleOpenSessionEditor}
          setContextMenu={setContextMenu}
          setBreakdownPoint={setBreakdownPoint}
          onBudgetRowContextMenu={handleBudgetRowContextMenu}
          onShowDerivedBreakdown={() => {
            // Trigger logic similar to context menu but for button click
            if(calcResults) handleBudgetRowContextMenu({ preventDefault: () => {} });
          }}
          onShowRiskBreakdown={(type) => setBreakdownModalType(type)}
          onOpenRepeatability={() => setRepeatabilityModalOpen(true)}
        />
      )}

      {/* --- RISK ANALYSIS VIEW --- */}
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
                    onShowBreakdown={(type) => setBreakdownModalType(type)}
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

      {/* --- RISK MITIGATION VIEW --- */}
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
                  onShowBreakdown={(type) => setBreakdownModalType(type)}
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