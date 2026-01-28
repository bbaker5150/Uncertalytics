import { useState, useEffect, useMemo, useCallback } from "react";

const useSessionManager = () => {
  const ipcRenderer = window.require ? window.require("electron").ipcRenderer : null;

  // --- Constants ---
  const defaultTestPoint = useMemo(
    () => ({
      section: "",
      tmdeDescription: "",
      tmdeTolerances: [],
      //  Allow specific UUT tolerance per point
      uutTolerance: null, 
      //  Hierarchical Linkage
      measurementAreaId: "", 
      associatedUutIds: [], // Array of UUT IDs this point links to
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
      analyst: "",
      organization: "",
      document: "",
      documentDate: "",
      notes: "",
      noteImages: [], 
      //  Master lists for the "Instruments Tab" workflow
      measurementAreas: [], // { id, name, color }
      uuts: [],             // { id, name, measurementAreaId, ...specs }
      tmdes: [],            // { id, name, measurementAreaId, ...specs }
      
      // Legacy/Fallback fields (kept for backward compatibility or simple sessions)
      uutDescription: "",
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
  const [instruments, setInstruments] = useState([]); 
  const [bugReports, setBugReports] = useState([]); 
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [selectedTestPointId, setSelectedTestPointId] = useState(null);
  const [dbPath, setDbPath] = useState(null);

  // --- 1. Load Data (Sessions) ---
  const loadData = useCallback(async () => {
    let loadedFromDb = false;

    if (ipcRenderer) {
      try {
        const currentPath = await ipcRenderer.invoke('get-db-path');
        setDbPath(currentPath);

        if (currentPath) {
          const loadedSessions = await ipcRenderer.invoke('load-sessions');
          
          if (loadedSessions && loadedSessions.length > 0) {
            setSessions(loadedSessions);
            loadedFromDb = true;

            if (!selectedSessionId) {
                const mostRecent = loadedSessions[0];
                setSelectedSessionId(mostRecent.id);
                setSelectedTestPointId(mostRecent.testPoints?.[0]?.id || null);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load sessions via IPC", err);
      }
    }

    if (!loadedFromDb) {
        try {
            const savedSessions = localStorage.getItem("uncertaintySessions");
            if (savedSessions) {
                const parsed = JSON.parse(savedSessions);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setSessions(parsed);
                    if (!selectedSessionId || !parsed.find(s => s.id === selectedSessionId)) {
                        setSelectedSessionId(parsed[0].id);
                        setSelectedTestPointId(parsed[0].testPoints?.[0]?.id || null);
                    }
                } else {
                    setSessions([]);
                }
            }
        } catch (error) {
            console.error("Failed to load from LocalStorage", error);
        }
    }
  }, [ipcRenderer, selectedSessionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- 1.1 Load Shared Data (Instruments & Bugs) ---
  const loadSharedData = useCallback(async () => {
    // 1. Instruments
    let instLoaded = false;
    if (ipcRenderer && dbPath) {
        try {
            const dbInstruments = await ipcRenderer.invoke('load-instruments');
            if (dbInstruments) {
                setInstruments(dbInstruments);
                instLoaded = true;
            }
        } catch (e) {
            console.error("Failed to load instruments from DB", e);
        }
    }
    
    if (!instLoaded) {
        const localInst = localStorage.getItem("uncertaintyInstruments");
        if (localInst) {
            try {
                setInstruments(JSON.parse(localInst));
            } catch (e) { console.error("Failed to load instruments from LS", e); }
        }
    }

    // 2. Bug Reports
    if (ipcRenderer && dbPath) {
        try {
            const dbBugs = await ipcRenderer.invoke('load-bug-reports');
            if (dbBugs) {
                setBugReports(dbBugs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
            }
        } catch (e) {
            console.error("Failed to load bugs from DB", e);
        }
    }

  }, [ipcRenderer, dbPath]);

  useEffect(() => {
    loadSharedData();
  }, [loadSharedData]);


  // --- 2. Persistence Logic (Sessions) ---
  const persistSession = async (sessionToSave, newImages = []) => {
    if (ipcRenderer && dbPath) {
        try {
            await ipcRenderer.invoke('save-session', sessionToSave);
            for (const img of newImages) {
                if (img.fileObject) {
                    await ipcRenderer.invoke('save-image', { 
                        sessionId: sessionToSave.id, 
                        imageId: img.id, 
                        dataBase64: img.fileObject 
                    });
                }
            }
        } catch (err) {
            console.error("Failed to save to disk", err);
        }
    } 
    
    setSessions(prev => {
        const sessionForLs = { ...sessionToSave };
        if (newImages.length > 0) {
            const updatedNoteImages = (sessionForLs.noteImages || []).map(imgRef => {
                const newImg = newImages.find(ni => ni.id === imgRef.id);
                if (newImg) {
                    return { ...imgRef, fileObject: newImg.fileObject };
                }
                return imgRef;
            });
            sessionForLs.noteImages = updatedNoteImages;
        }

        const updatedList = prev.map(s => s.id === sessionForLs.id ? sessionForLs : s);
        if (!prev.find(s => s.id === sessionForLs.id)) {
            updatedList.unshift(sessionForLs);
        }
        
        try {
            localStorage.setItem("uncertaintySessions", JSON.stringify(updatedList));
        } catch (e) {
            console.warn("LocalStorage Quota Exceeded", e);
        }
        
        return prev; 
    });
  };

  // --- 2.1 Persist Instrument ---
  const saveInstrument = async (instrument) => {
    setInstruments(prev => {
        const existingIdx = prev.findIndex(i => i.id === instrument.id);
        let newInstruments;
        if (existingIdx > -1) {
            newInstruments = [...prev];
            newInstruments[existingIdx] = instrument;
        } else {
            newInstruments = [...prev, instrument];
        }
        
        try {
            localStorage.setItem("uncertaintyInstruments", JSON.stringify(newInstruments));
        } catch (e) { console.warn("LS Quota (Instruments)", e); }
        return newInstruments;
    });

    if (ipcRenderer && dbPath) {
        try {
            await ipcRenderer.invoke('save-instrument', instrument);
        } catch (e) {
            console.error("Failed to save instrument to DB", e);
        }
    }
  };

  // --- 2.2 Delete Instrument ---
  const deleteInstrument = async (instrumentId) => {
    setInstruments(prev => {
        const newInstruments = prev.filter(i => i.id !== instrumentId);
        try {
            localStorage.setItem("uncertaintyInstruments", JSON.stringify(newInstruments));
        } catch (e) { console.warn("LS Quota (Instruments)", e); }
        return newInstruments;
    });

    if (ipcRenderer && dbPath) {
        try {
            await ipcRenderer.invoke('delete-instrument', instrumentId);
        } catch (e) {
            console.error("Failed to delete instrument from DB", e);
        }
    }
  };

  // --- 2.3 Save/Update Bug Report ---
  const saveBugReport = async (report) => {
    setBugReports(prev => {
        const idx = prev.findIndex(r => r.id === report.id);
        if (idx > -1) {
            const updated = [...prev];
            updated[idx] = report;
            return updated.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        }
        return [report, ...prev].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    });

    if (ipcRenderer && dbPath) {
        try {
            await ipcRenderer.invoke('save-bug-report', report);
        } catch (e) {
            console.error("Failed to save bug report", e);
        }
    }
  };

  const deleteBugReport = async (reportId) => {
    setBugReports(prev => prev.filter(r => r.id !== reportId));
    if (ipcRenderer && dbPath) {
        try {
            await ipcRenderer.invoke('delete-bug-report', reportId);
        } catch (e) {
            console.error("Failed to delete bug report", e);
        }
    }
  };


  // --- 3. Image Actions ---
  const loadSessionImages = async (sessionId) => {
    if (ipcRenderer && dbPath) {
      return await ipcRenderer.invoke('load-session-images', sessionId);
    } 
    const session = sessions.find(s => s.id === sessionId);
    if (session && session.noteImages) {
        return session.noteImages
            .filter(img => img.fileObject) 
            .map(img => ({ id: img.id, data: img.fileObject }));
    }
    return [];
  };

  const saveSessionImage = async (sessionId, imageId, dataBase64) => {
    if (ipcRenderer && dbPath) {
      await ipcRenderer.invoke('save-image', { sessionId, imageId, dataBase64 });
    }
  };

  const deleteSessionImage = async (sessionId, imageId) => {
    if (ipcRenderer && dbPath) {
      await ipcRenderer.invoke('delete-image', { sessionId, imageId });
    }
    
    setSessions(prev => {
        const session = prev.find(s => s.id === sessionId);
        if (!session) return prev;
        const updatedImages = (session.noteImages || []).filter(img => img.id !== imageId);
        const updatedSession = { ...session, noteImages: updatedImages };
        const updatedList = prev.map(s => s.id === sessionId ? updatedSession : s);
        localStorage.setItem("uncertaintySessions", JSON.stringify(updatedList));
        return updatedList;
    });
  };

  const deleteSessionFromDisk = async (sessionId) => {
    if (ipcRenderer && dbPath) {
        await ipcRenderer.invoke('delete-session', sessionId);
    }
    setSessions(prev => {
        const updated = prev.filter(s => s.id !== sessionId);
        localStorage.setItem("uncertaintySessions", JSON.stringify(updated));
        return updated;
    });
  };

  // --- 4. Database Actions ---
  const selectDatabaseFolder = async () => {
      if(ipcRenderer) {
          const path = await ipcRenderer.invoke('select-db-folder');
          if (path) {
              setDbPath(path);
              loadData(); 
              loadSharedData(); 
          }
      }
  };

  const disconnectDatabase = async () => {
      if(ipcRenderer) {
          await ipcRenderer.invoke('disconnect-db');
          setDbPath(null);
          loadData(); 
          loadSharedData(); 
      }
  };

  const migrateToDisk = async () => {
      if (!ipcRenderer || !dbPath) {
          alert("Please connect a database folder first.");
          return;
      }
      
      if (sessions.length > 0) {
        if (window.confirm(`Migrate ${sessions.length} sessions to ${dbPath}?`)) {
            let count = 0;
            for (const session of sessions) {
                const imagesToSave = (session.noteImages || [])
                    .filter(img => img.fileObject)
                    .map(img => ({ id: img.id, fileObject: img.fileObject }));

                await persistSession(session, imagesToSave);
                count++;
            }
            for (const inst of instruments) {
                await saveInstrument(inst);
            }
            alert(`Successfully saved ${count} sessions and ${instruments.length} instruments to disk!`);
            loadData(); 
            loadSharedData();
        }
      }
  };

  // --- 5. CRUD Operations ---
  const updateSession = (updatedSession, newImages = []) => {
    setSessions((prevSessions) =>
      prevSessions.map((s) => (s.id === updatedSession.id ? updatedSession : s))
    );
    persistSession(updatedSession, newImages);
  };

  const addSession = () => {
    const newSession = createNewSession();
    setSessions((prev) => [newSession, ...prev]);
    setSelectedSessionId(newSession.id);
    setSelectedTestPointId(null);
    persistSession(newSession);
    return newSession;
  };

  const deleteSession = (sessionId) => {
    const newSessions = sessions.filter((s) => s.id !== sessionId);
    deleteSessionFromDisk(sessionId); 

    if (newSessions.length === 0) {
      setSessions([]);
      setSelectedSessionId(null);
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

  const importSession = (loadedSession) => {
    setSessions((prev) => {
        const exists = prev.some(s => s.id === loadedSession.id);
        if (exists) {
            return prev.map(s => s.id === loadedSession.id ? loadedSession : s);
        }
        return [loadedSession, ...prev];
    });
    setSelectedSessionId(loadedSession.id);
    setSelectedTestPointId(loadedSession.testPoints?.[0]?.id || null);
    
    const imagesToSave = (loadedSession.noteImages || [])
        .filter(img => img.fileObject)
        .map(img => ({ id: img.id, fileObject: img.fileObject }));

    persistSession(loadedSession, imagesToSave);
  };

  // --- 6. Workflow Redesign CRUD (Area, UUT, TMDE) ---
  
  // Measurement Areas
  const addMeasurementArea = (sessionId, area) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const currentAreas = session.measurementAreas || [];
    const updatedSession = { ...session, measurementAreas: [...currentAreas, area] };
    updateSession(updatedSession);
  };

  const updateMeasurementArea = (sessionId, updatedArea) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const updatedAreas = (session.measurementAreas || []).map(a => a.id === updatedArea.id ? updatedArea : a);
    updateSession({ ...session, measurementAreas: updatedAreas });
  };

  const removeMeasurementArea = (sessionId, areaId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const updatedAreas = (session.measurementAreas || []).filter(a => a.id !== areaId);
    // Optional: Logic to cleanup UUTs/TMDEs associated with this area could go here
    updateSession({ ...session, measurementAreas: updatedAreas });
  };

  // UUTs (Session Level)
  const addSessionUut = (sessionId, uut) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const currentUuts = session.uuts || [];
    updateSession({ ...session, uuts: [...currentUuts, uut] });
  };

  const updateSessionUut = (sessionId, updatedUut) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const updatedUuts = (session.uuts || []).map(u => u.id === updatedUut.id ? updatedUut : u);
    updateSession({ ...session, uuts: updatedUuts });
  };

  const removeSessionUut = (sessionId, uutId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const updatedUuts = (session.uuts || []).filter(u => u.id !== uutId);
    updateSession({ ...session, uuts: updatedUuts });
  };

  // TMDEs (Session Level)
  const addSessionTmde = (sessionId, tmde) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const currentTmdes = session.tmdes || [];
    updateSession({ ...session, tmdes: [...currentTmdes, tmde] });
  };

  const updateSessionTmde = (sessionId, updatedTmde) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const updatedTmdes = (session.tmdes || []).map(t => t.id === updatedTmde.id ? updatedTmde : t);
    updateSession({ ...session, tmdes: updatedTmdes });
  };

  const removeSessionTmde = (sessionId, tmdeId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const updatedTmdes = (session.tmdes || []).filter(t => t.id !== tmdeId);
    updateSession({ ...session, tmdes: updatedTmdes });
  };


  // --- 7. Test Point Actions (UPDATED FOR BATCH SAVING) ---

  const saveTestPoint = (formDataOrArray, sessionUpdates = null) => {
    const session = sessions.find(s => s.id === selectedSessionId);
    if (!session) return;

    // Start with a copy of the session and apply any immediate session-level overrides
    let updatedSession = { ...session, ...sessionUpdates };

    // Normalize input to an array to handle both Single and Batch saves
    const dataItems = Array.isArray(formDataOrArray) ? formDataOrArray : [formDataOrArray];
    
    // We'll build the new list of test points based on the current session
    let currentTestPoints = [...session.testPoints];
    let lastNewId = null;

    dataItems.forEach((formData, index) => {
        if (formData.id) {
            // --- UPDATE EXISTING POINT ---
            currentTestPoints = currentTestPoints.map((tp) => {
                if (tp.id === formData.id) {
                    return {
                        ...tp,
                        section: formData.section,
                        testPointInfo: { ...formData.testPointInfo },
                        measurementType: formData.measurementType,
                        equationString: formData.equationString,
                        variableMappings: formData.variableMappings,
                        tmdeTolerances: formData.tmdeTolerances || tp.tmdeTolerances,
                        uutTolerance: formData.uutTolerance !== undefined ? formData.uutTolerance : tp.uutTolerance,
                        measurementAreaId: formData.measurementAreaId || tp.measurementAreaId || "",
                        associatedUutIds: formData.associatedUutIds || tp.associatedUutIds || []
                    };
                }
                return tp;
            });
        } else {
            // --- CREATE NEW POINT ---
            const lastTestPoint = session.testPoints.find((tp) => tp.id === selectedTestPointId);
            let finalTmdes = formData.tmdeTolerances || [];

            if (finalTmdes.length === 0 && formData.copyTmdes && lastTestPoint) {
                finalTmdes = JSON.parse(JSON.stringify(lastTestPoint.tmdeTolerances || []));
                const originalTestPointParameter = lastTestPoint.testPointInfo.parameter;
                const newTestPointParameter = formData.testPointInfo.parameter;
                finalTmdes.forEach((tmde) => {
                    const wasUsingUutRef =
                        tmde.measurementPoint?.value === originalTestPointParameter.value &&
                        tmde.measurementPoint?.unit === originalTestPointParameter.unit;
                    if (wasUsingUutRef) {
                        tmde.measurementPoint = { ...newTestPointParameter };
                    }
                });
            }

            // Generate a robust unique ID (Date + Random + Index) to prevent collisions in batch
            const newId = Date.now() + Math.floor(Math.random() * 10000) + index;
            
            const newTestPoint = {
                id: newId,
                ...defaultTestPoint, // Merge defaults
                ...formData,         // Merge form data
                section: formData.section, // Explicit overrides to ensure safety
                testPointInfo: formData.testPointInfo,
                tmdeTolerances: finalTmdes,
                uutTolerance: formData.uutTolerance || null,
                measurementType: formData.measurementType,
                equationString: formData.equationString,
                variableMappings: formData.variableMappings,
                measurementAreaId: formData.measurementAreaId || "",
                associatedUutIds: formData.associatedUutIds || []
            };

            currentTestPoints.push(newTestPoint);
            lastNewId = newId;
        }
    });

    // Update Session State
    updatedSession.testPoints = currentTestPoints;
    
    // If we created new points, select the last one
    if (lastNewId) {
        setSelectedTestPointId(lastNewId);
    }

    updateSession(updatedSession);
  };

  const deleteTestPoint = (idToDelete) => {
    const session = sessions.find(s => s.id === selectedSessionId);
    if(!session) return;
    let nextSelectedTestPointId = selectedTestPointId;
    const filteredTestPoints = session.testPoints.filter((tp) => tp.id !== idToDelete);
    if (selectedTestPointId === idToDelete) {
        nextSelectedTestPointId = filteredTestPoints[0]?.id || null;
    }
    const updatedSession = { ...session, testPoints: filteredTestPoints };
    setSelectedTestPointId(nextSelectedTestPointId);
    updateSession(updatedSession);
  };

  const updateTestPointData = useCallback((updatedData) => {
    setSessions(prevSessions => {
        const session = prevSessions.find(s => s.id === selectedSessionId);
        if(!session) return prevSessions;
        const updatedTestPoints = session.testPoints.map((tp) =>
            tp.id === selectedTestPointId ? { ...tp, ...updatedData } : tp
        );
        const updatedSession = { ...session, testPoints: updatedTestPoints };
        persistSession(updatedSession);
        return prevSessions.map(s => s.id === selectedSessionId ? updatedSession : s);
    });
  }, [selectedSessionId, selectedTestPointId]); 

  const deleteTmdeDefinition = (tmdeId) => {
    const session = sessions.find(s => s.id === selectedSessionId);
    if(!session) return;
    const updatedTestPoints = session.testPoints.map((tp) => {
        if (tp.id !== selectedTestPointId) return tp;
        const newTolerances = tp.tmdeTolerances.filter((t) => t.id !== tmdeId);
        return { ...tp, tmdeTolerances: newTolerances };
    });
    const updatedSession = { ...session, testPoints: updatedTestPoints };
    updateSession(updatedSession);
  };

  const decrementTmdeQuantity = (tmdeId) => {
     const session = sessions.find(s => s.id === selectedSessionId);
     if(!session) return;
     const updatedTestPoints = session.testPoints.map((tp) => {
        if (tp.id !== selectedTestPointId) return tp;
        const newTolerances = tp.tmdeTolerances.map((t) => {
            if (t.id === tmdeId) {
            const newQuantity = (t.quantity || 1) - 1;
            return { ...t, quantity: newQuantity };
            }
            return t;
        }).filter((t) => t.quantity > 0);
        return { ...tp, tmdeTolerances: newTolerances };
    });
    const updatedSession = { ...session, testPoints: updatedTestPoints };
    updateSession(updatedSession);
  };

  // --- HELPERS ---
  const currentSessionData = sessions.find((s) => s.id === selectedSessionId);
  const currentTestPoints = currentSessionData?.testPoints || [];

  return {
    sessions,
    instruments,
    bugReports, 
    saveInstrument,
    saveBugReport, 
    deleteBugReport, 
    deleteInstrument, 
    loadInstruments: loadSharedData,
    selectedSessionId,
    setSelectedSessionId,
    selectedTestPointId,
    setSelectedTestPointId,
    currentSessionData,
    currentTestPoints,
    defaultTestPoint,
    createNewSession,
    dbPath,
    selectDatabaseFolder,
    disconnectDatabase,
    migrateToDisk,
    saveSessionImage,
    loadSessionImages,
    deleteSessionImage,
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
    
    // NEW EXPORTS
    addMeasurementArea,
    updateMeasurementArea,
    removeMeasurementArea,
    addSessionUut,
    updateSessionUut,
    removeSessionUut,
    addSessionTmde,
    updateSessionTmde,
    removeSessionTmde
  };
};

export default useSessionManager;