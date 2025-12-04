import { useState, useEffect, useMemo, useCallback } from "react";

const useSessionManager = () => {
  // --- Constants (Moved from App.jsx) ---
  const defaultTestPoint = useMemo(
    () => ({
      section: "",
      tmdeDescription: "",
      tmdeTolerances: [],
      specifications: {
        mfg: { uncertainty: "", k: 2 },
        navy: { uncertainty: "", k: 2 },
      },
      components: [],
      is_detailed_uncertainty_calculated: false,
      measurementType: "direct",
      equationString: "",
      variableMappings: {},
      testPointInfo: {
        parameter: { name: "", value: "", unit: "" },
        qualifier: null,
      },
    }),
    []
  );

  const createNewSession = useCallback(
    () => ({
      id: Date.now(),
      name: "New Session",
      uutDescription: "",
      analyst: "",
      organization: "",
      document: "",
      documentDate: "",
      notes: "",
      noteImages: [],
      uutTolerance: {},
      testPoints: [],
      uncReq: {
        uncertaintyConfidence: 95,
        reliability: 85,
        calInt: 12,
        measRelCalcAssumed: 85,
        neededTUR: 4,
        reqPFA: 2,
        guardBandMultiplier: 1,
      },
    }),
    []
  );

  // --- State ---
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [selectedTestPointId, setSelectedTestPointId] = useState(null);
  
  // --- Initialization & Persistence ---
  useEffect(() => {
    let loadedData = false;
    const defaultSession = createNewSession();

    try {
      const savedSessions = localStorage.getItem("uncertaintySessions");
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const migratedSessions = parsed.map((session) => ({
            ...defaultSession,
            ...session,
            id: session.id,
            name: session.name || defaultSession.name,
          }));

          setSessions(migratedSessions);
          setSelectedSessionId(migratedSessions[0].id);
          setSelectedTestPointId(migratedSessions[0].testPoints?.[0]?.id || null);
          loadedData = true;
        }
      }
    } catch (error) {
      console.error("Failed to load data from localStorage", error);
    }

    if (!loadedData) {
      setSessions([defaultSession]);
      setSelectedSessionId(defaultSession.id);
    }
  }, [createNewSession]);

  useEffect(() => {
    if (sessions.length > 0) {
      try {
        localStorage.setItem("uncertaintySessions", JSON.stringify(sessions));
      } catch (error) {
        console.error("Failed to save data to localStorage", error);
      }
    }
  }, [sessions]);

  // --- Helpers ---
  const currentSessionData = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId),
    [sessions, selectedSessionId]
  );

  const currentTestPoints = useMemo(
    () => currentSessionData?.testPoints || [],
    [currentSessionData]
  );

  // --- CRUD Operations ---

  const addSession = () => {
    const newSession = createNewSession();
    setSessions((prev) => [...prev, newSession]);
    setSelectedSessionId(newSession.id);
    setSelectedTestPointId(null);
    return newSession;
  };

  const deleteSession = (sessionId) => {
    const newSessions = sessions.filter((s) => s.id !== sessionId);

    if (newSessions.length === 0) {
      const firstSession = createNewSession();
      setSessions([firstSession]);
      setSelectedSessionId(firstSession.id);
      setSelectedTestPointId(null);
    } else {
      if (selectedSessionId === sessionId) {
        const newSelectedSession = newSessions[0];
        setSelectedSessionId(newSelectedSession.id);
        const newTpId = newSelectedSession.testPoints?.[0]?.id || null;
        setSelectedTestPointId(newTpId);
      }
      setSessions(newSessions);
    }
  };

  const updateSession = (updatedSession) => {
    setSessions((prevSessions) =>
      prevSessions.map((s) => (s.id === updatedSession.id ? updatedSession : s))
    );
  };

  const importSession = (loadedSession) => {
    setSessions((prevSessions) => {
      const sessionExists = prevSessions.some((s) => s.id === loadedSession.id);
      if (sessionExists) {
        return prevSessions.map((s) =>
          s.id === loadedSession.id ? loadedSession : s
        );
      }
      return [...prevSessions, loadedSession];
    });
    setSelectedSessionId(loadedSession.id);
    setSelectedTestPointId(loadedSession.testPoints?.[0]?.id || null);
  };

  const saveTestPoint = (formData) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== selectedSessionId) return session;

        // Update existing
        if (formData.id) {
          const updatedTestPoints = session.testPoints.map((tp) => {
            if (tp.id === formData.id) {
              return {
                ...tp,
                section: formData.section,
                testPointInfo: { ...formData.testPointInfo },
                measurementType: formData.measurementType,
                equationString: formData.equationString,
                variableMappings: formData.variableMappings,
              };
            }
            return tp;
          });
          return { ...session, testPoints: updatedTestPoints };
        }

        // Add New
        else {
          const lastTestPoint = session.testPoints.find(
            (tp) => tp.id === selectedTestPointId
          );
          let copiedTmdes = [];
          const newTestPointParameter = formData.testPointInfo.parameter;

          if (formData.copyTmdes && lastTestPoint) {
            copiedTmdes = JSON.parse(JSON.stringify(lastTestPoint.tmdeTolerances || []));
            const originalTestPointParameter = lastTestPoint.testPointInfo.parameter;

            copiedTmdes.forEach((tmde) => {
              const wasUsingUutRef =
                tmde.measurementPoint?.value === originalTestPointParameter.value &&
                tmde.measurementPoint?.unit === originalTestPointParameter.unit;
              if (wasUsingUutRef) {
                tmde.measurementPoint = { ...newTestPointParameter };
              }
            });
          }

          const newTestPoint = {
            id: Date.now(),
            ...defaultTestPoint,
            section: formData.section,
            testPointInfo: formData.testPointInfo,
            tmdeTolerances: copiedTmdes,
            measurementType: formData.measurementType,
            equationString: formData.equationString,
            variableMappings: formData.variableMappings,
          };
          setSelectedTestPointId(newTestPoint.id);
          return { ...session, testPoints: [...session.testPoints, newTestPoint] };
        }
      })
    );
  };

  const deleteTestPoint = (idToDelete) => {
    let nextSelectedTestPointId = selectedTestPointId;
    const updatedSessions = sessions.map((session) => {
      if (session.id === selectedSessionId) {
        const filteredTestPoints = session.testPoints.filter((tp) => tp.id !== idToDelete);
        if (selectedTestPointId === idToDelete) {
          nextSelectedTestPointId = filteredTestPoints[0]?.id || null;
        }
        return { ...session, testPoints: filteredTestPoints };
      }
      return session;
    });

    setSessions(updatedSessions);
    setSelectedTestPointId(nextSelectedTestPointId);
  };

  const updateTestPointData = useCallback((updatedData) => {
    setSessions((prevSessions) =>
      prevSessions.map((session) => {
        if (session.id === selectedSessionId) {
          const updatedTestPoints = session.testPoints.map((tp) =>
            tp.id === selectedTestPointId ? { ...tp, ...updatedData } : tp
          );
          return { ...session, testPoints: updatedTestPoints };
        }
        return session;
      })
    );
  }, [selectedSessionId, selectedTestPointId]);

  const deleteTmdeDefinition = (tmdeId) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== selectedSessionId) return session;
        const updatedTestPoints = session.testPoints.map((tp) => {
          if (tp.id !== selectedTestPointId) return tp;
          const newTolerances = tp.tmdeTolerances.filter((t) => t.id !== tmdeId);
          return { ...tp, tmdeTolerances: newTolerances };
        });
        return { ...session, testPoints: updatedTestPoints };
      })
    );
  };

  const decrementTmdeQuantity = (tmdeId) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== selectedSessionId) return session;
        const updatedTestPoints = session.testPoints.map((tp) => {
          if (tp.id !== selectedTestPointId) return tp;
          const newTolerances = tp.tmdeTolerances
            .map((t) => {
              if (t.id === tmdeId) {
                const newQuantity = (t.quantity || 1) - 1;
                return { ...t, quantity: newQuantity };
              }
              return t;
            })
            .filter((t) => t.quantity > 0);
          return { ...tp, tmdeTolerances: newTolerances };
        });
        return { ...session, testPoints: updatedTestPoints };
      })
    );
  };

  return {
    sessions,
    selectedSessionId,
    setSelectedSessionId,
    selectedTestPointId,
    setSelectedTestPointId,
    currentSessionData,
    currentTestPoints,
    defaultTestPoint,
    createNewSession,
    // Actions
    addSession,
    deleteSession,
    updateSession,
    importSession,
    saveTestPoint,
    deleteTestPoint,
    updateTestPointData,
    deleteTmdeDefinition,
    decrementTmdeQuantity,
    setSessions // Exposed for edge cases if needed
  };
};

export default useSessionManager;