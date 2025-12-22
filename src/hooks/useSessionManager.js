import { useState, useEffect, useMemo, useCallback } from "react";

const useSessionManager = () => {
  const ipcRenderer = window.require ? window.require("electron").ipcRenderer : null;

  // --- Constants ---
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
  const [instruments, setInstruments] = useState([]); 
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

  // --- 1.1 Load Data (Instruments) ---
  const loadInstruments = useCallback(async () => {
    let loaded = false;
    if (ipcRenderer && dbPath) {
        try {
            const dbInstruments = await ipcRenderer.invoke('load-instruments');
            if (dbInstruments) {
                setInstruments(dbInstruments);
                loaded = true;
            }
        } catch (e) {
            console.error("Failed to load instruments from DB", e);
        }
    }
    
    if (!loaded) {
        const localInst = localStorage.getItem("uncertaintyInstruments");
        if (localInst) {
            try {
                setInstruments(JSON.parse(localInst));
            } catch (e) { console.error("Failed to load instruments from LS", e); }
        }
    }
  }, [ipcRenderer, dbPath]);

  useEffect(() => {
    loadInstruments();
  }, [loadInstruments]);


  // --- 2. Persistence Logic ---
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

  // --- 2.2 Delete Instrument (NEW) ---
  const deleteInstrument = async (instrumentId) => {
    // 1. Update State & LocalStorage
    setInstruments(prev => {
        const newInstruments = prev.filter(i => i.id !== instrumentId);
        try {
            localStorage.setItem("uncertaintyInstruments", JSON.stringify(newInstruments));
        } catch (e) { console.warn("LS Quota (Instruments)", e); }
        return newInstruments;
    });

    // 2. Update DB
    if (ipcRenderer && dbPath) {
        try {
            await ipcRenderer.invoke('delete-instrument', instrumentId);
        } catch (e) {
            console.error("Failed to delete instrument from DB", e);
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
              loadInstruments(); 
          }
      }
  };

  const disconnectDatabase = async () => {
      if(ipcRenderer) {
          await ipcRenderer.invoke('disconnect-db');
          setDbPath(null);
          loadData(); 
          loadInstruments(); 
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
            loadInstruments();
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

  // FIX: Added sessionUpdates parameter to allow saving UUT tolerance along with the test point
  const saveTestPoint = (formData, sessionUpdates = null) => {
    const session = sessions.find(s => s.id === selectedSessionId);
    if(!session) return;
    
    // Start with a copy of the session and apply any immediate session-level overrides (like uutTolerance)
    let updatedSession = { ...session, ...sessionUpdates };
    
    if (formData.id) {
        // UPDATE EXISTING POINT
        const updatedTestPoints = session.testPoints.map((tp) => {
        if (tp.id === formData.id) {
            return {
            ...tp,
            section: formData.section,
            testPointInfo: { ...formData.testPointInfo },
            measurementType: formData.measurementType,
            equationString: formData.equationString,
            variableMappings: formData.variableMappings,
            tmdeTolerances: formData.tmdeTolerances || tp.tmdeTolerances
            };
        }
        return tp;
        });
        updatedSession = { ...updatedSession, testPoints: updatedTestPoints };
    } else {
        // CREATE NEW POINT
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

        const newTestPoint = {
            id: Date.now(),
            ...defaultTestPoint,
            section: formData.section,
            testPointInfo: formData.testPointInfo,
            tmdeTolerances: finalTmdes,
            measurementType: formData.measurementType,
            equationString: formData.equationString,
            variableMappings: formData.variableMappings,
        };
        setSelectedTestPointId(newTestPoint.id);
        updatedSession = { ...updatedSession, testPoints: [...session.testPoints, newTestPoint] };
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
    saveInstrument,
    deleteInstrument, 
    loadInstruments,
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
    setSessions
  };
};

export default useSessionManager;