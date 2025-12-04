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
      noteImages: [], // Contains { id, fileName, fileObject (optional) }
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
  const [dbPath, setDbPath] = useState(null);

  // --- 1. Load Data ---
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
          } else {
             console.log("Connected DB is empty. Falling back to Local Storage...");
          }
        }
      } catch (err) {
        console.error("Failed to load sessions via IPC", err);
      }
    }

    // Fallback: Load from LocalStorage
    if (!loadedFromDb) {
        try {
            const savedSessions = localStorage.getItem("uncertaintySessions");
            if (savedSessions) {
                const parsed = JSON.parse(savedSessions);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    console.log(`Loaded ${parsed.length} sessions from LocalStorage.`);
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


  // --- 2. Persistence Logic (The Fix) ---
  
  const persistSession = async (sessionToSave, newImages = []) => {
    // 1. DATABASE MODE
    if (ipcRenderer && dbPath) {
        try {
            // Save JSON (We keep it clean/lightweight)
            await ipcRenderer.invoke('save-session', sessionToSave);
            
            // Save Images as Files
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
    
    // 2. LOCAL STORAGE MODE (Always backup here, but embed images)
    setSessions(prev => {
        // Create a copy of the session
        const sessionForLs = { ...sessionToSave };

        // If we have new images, we MUST embed them into the JSON for LocalStorage
        // because we can't save separate files.
        if (newImages.length > 0) {
            const updatedNoteImages = (sessionForLs.noteImages || []).map(imgRef => {
                const newImg = newImages.find(ni => ni.id === imgRef.id);
                if (newImg) {
                    // Embed the data
                    return { ...imgRef, fileObject: newImg.fileObject };
                }
                // If it already has data (from previous load), keep it
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
            console.warn("LocalStorage Quota Exceeded (Images might be too big)", e);
        }
        
        return prev; 
    });
  };

  // --- 3. Image Actions (Updated) ---

  const loadSessionImages = async (sessionId) => {
    // A. DB Mode: Load from files
    if (ipcRenderer && dbPath) {
      return await ipcRenderer.invoke('load-session-images', sessionId);
    } 
    
    // B. Local Mode: Extract from Session State
    // We look at the session currently in memory
    const session = sessions.find(s => s.id === sessionId);
    if (session && session.noteImages) {
        // Return array of { id, data } objects
        return session.noteImages
            .filter(img => img.fileObject) // Only if data exists
            .map(img => ({ id: img.id, data: img.fileObject }));
    }
    return [];
  };

  const saveSessionImage = async (sessionId, imageId, dataBase64) => {
    // Only needed for DB Mode separate calls
    if (ipcRenderer && dbPath) {
      await ipcRenderer.invoke('save-image', { sessionId, imageId, dataBase64 });
    }
  };

  const deleteSessionImage = async (sessionId, imageId) => {
    // DB Mode
    if (ipcRenderer && dbPath) {
      await ipcRenderer.invoke('delete-image', { sessionId, imageId });
    }
    
    // Local Mode cleanup
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
    // Also remove from LocalStorage
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
          }
      }
  };

  const disconnectDatabase = async () => {
      if(ipcRenderer) {
          await ipcRenderer.invoke('disconnect-db');
          setDbPath(null);
          loadData(); 
      }
  };

  const migrateToDisk = async () => {
      if (!ipcRenderer || !dbPath) {
          alert("Please connect a database folder first.");
          return;
      }
      if (sessions.length === 0) {
          alert("No sessions to migrate.");
          return;
      }

      if (window.confirm(`Migrate ${sessions.length} sessions to ${dbPath}?`)) {
          let count = 0;
          for (const session of sessions) {
              // Extract images if they are embedded
              const imagesToSave = (session.noteImages || [])
                .filter(img => img.fileObject)
                .map(img => ({ id: img.id, fileObject: img.fileObject }));

              await persistSession(session, imagesToSave);
              count++;
          }
          alert(`Successfully saved ${count} sessions to disk!`);
          loadData(); 
      }
  };

  // --- 5. CRUD Operations ---

  // UPDATED: Now accepts newImages to handle the hybrid logic
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
    
    // Check if import has embedded images we need to save
    const imagesToSave = (loadedSession.noteImages || [])
        .filter(img => img.fileObject)
        .map(img => ({ id: img.id, fileObject: img.fileObject }));

    persistSession(loadedSession, imagesToSave);
  };

  // --- Sub-Update Wrappers ---

  const saveTestPoint = (formData) => {
    const session = sessions.find(s => s.id === selectedSessionId);
    if(!session) return;
    let updatedSession;
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
        updatedSession = { ...session, testPoints: updatedTestPoints };
    } else {
        const lastTestPoint = session.testPoints.find((tp) => tp.id === selectedTestPointId);
        let copiedTmdes = [];
        if (formData.copyTmdes && lastTestPoint) {
            copiedTmdes = JSON.parse(JSON.stringify(lastTestPoint.tmdeTolerances || []));
            const originalTestPointParameter = lastTestPoint.testPointInfo.parameter;
            const newTestPointParameter = formData.testPointInfo.parameter;
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
        updatedSession = { ...session, testPoints: [...session.testPoints, newTestPoint] };
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