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
import EditUutModal from "../instruments/components/EditUutModal"; 
import DerivedBreakdownModal from "./components/BreakdownModals/DerivedBreakdownModal";
import RiskBreakdownModal from "./components/BreakdownModals/RiskBreakdownModals";
import RepeatabilityModal from "./components/RepeatabilityModal";

// --- Utils ---
import { 
  convertToPPM,
} from "../../utils/uncertaintyMath";

function Analysis({
  sessionData,
  testPointData,
  onDataSave, 
  onSessionSave, 
  defaultTestPoint,
  setContextMenu,
  setBreakdownPoint,
  handleOpenSessionEditor,
  // Props lifted from App.js
  instruments,
  onDeleteTmdeDefinition,
  onDecrementTmdeQuantity,
  onDeleteUut,
  onOpenOverview,
  // Shared State lifted from App.js
  riskResults: parentRiskResults, 
  setRiskResults: parentSetRiskResults 
}) {
  // --- 1. Local UI State ---
  const [analysisMode, setAnalysisMode] = useState("uncertaintyTool");
  const [showContribution, setShowContribution] = useState(false);
  const [notification, setNotification] = useState(null);
  
  // Modal States
  const [isAddTmdeModalOpen, setAddTmdeModalOpen] = useState(false);
  const [isUutModalOpen, setIsUutModalOpen] = useState(false); 
  const [tmdeToEdit, setTmdeToEdit] = useState(null);
  
  const [isManualModalOpen, setManualModalOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState(null);
  
  const [isRepeatabilityModalOpen, setRepeatabilityModalOpen] = useState(false);
  const [modalPosition, setModalPosition] = useState(null);

  const [breakdownModalType, setBreakdownModalType] = useState(null);
  const [isDerivedBreakdownOpen, setIsDerivedBreakdownOpen] = useState(false);
  const [derivedBreakdownData, setDerivedBreakdownData] = useState(null);

  // --- 2. Memoized Data Lookups ---
  const uutNominal = useMemo(
    () => testPointData?.testPointInfo?.parameter,
    [testPointData?.testPointInfo?.parameter]
  );
  
  // FIX: Read from testPointData first (which App.jsx enriches), then fallback to session
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
  const handleSaveUut = ({ description, tolerance, instrument }) => {
    // FIX: Save specific tolerance to the Test Point (isolating it)
    onDataSave({ uutTolerance: tolerance });

    if (onSessionSave) {
        // Update global description and instrument definition
        onSessionSave({
            ...sessionData,
            uutDescription: description,
            // We can update the session default here too, but the TP specific 
            // value will always override it thanks to the memo above.
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

      <EditUutModal
        isOpen={isUutModalOpen}
        onClose={() => setIsUutModalOpen(false)}
        onSave={handleSaveUut}
        initialDescription={sessionData.uutDescription}
        initialTolerance={uutToleranceData} // Pass the specific tolerance
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
            guardBandInputs: riskResults.gbInputs,
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

      {/* --- PANELS --- */}
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
          handleOpenSessionEditor={handleOpenSessionEditor}

          setContextMenu={setContextMenu}
          setBreakdownPoint={setBreakdownPoint}
          onBudgetRowContextMenu={handleBudgetRowContextMenu}
          onShowDerivedBreakdown={() => {
            if(calcResults) handleBudgetRowContextMenu({ preventDefault: () => {} });
          }}
          onShowRiskBreakdown={(type) => setBreakdownModalType(type)}
          onOpenRepeatability={(e) => { 
             if (e && e.clientY) setModalPosition({ top: e.clientY, left: e.clientX });
             setEditingComponent(null); 
             setRepeatabilityModalOpen(true); 
          }}
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