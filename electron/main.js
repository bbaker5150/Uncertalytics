import { app, BrowserWindow, Menu, MenuItem, ipcMain, nativeTheme, dialog } from 'electron';
import fs from 'fs';
import path from 'path';

const isRunningInDev = !app.isPackaged;

// --- FILE SYSTEM HELPERS (Multi-User / Network Drive Safe) ---

/**
 * atomicWrite: Writes data to a temp file first, then renames it.
 * This prevents file corruption and handles EBUSY errors common on network drives.
 */
async function safeWriteFile(filePath, data) {
  const tempPath = filePath + '.tmp_' + Date.now(); // Unique temp name
  
  try {
    // 1. Write to a unique temp file (unlikely to be locked)
    fs.writeFileSync(tempPath, data);
    
    // 2. Retry renaming if target is busy
    let retries = 5;
    while (retries > 0) {
      try {
        // Atomic replace: this operation is very fast
        fs.renameSync(tempPath, filePath);
        return true;
      } catch (err) {
        // If resource is busy (locked by another user), wait and retry
        if (err.code === 'EBUSY' || err.code === 'EPERM') {
          retries--;
          await new Promise(r => setTimeout(r, 200)); // Wait 200ms
        } else {
          throw err;
        }
      }
    }
    // Final attempt failed
    throw new Error(`Could not write to ${filePath} after multiple retries (Resource Busy).`);
  } catch (err) {
    // Cleanup temp file if it exists
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (e) {}
    }
    throw err;
  }
}

/**
 * safeReadFile: Retries reading if the file is momentarily locked by another writer.
 */
async function safeReadFile(filePath) {
  let retries = 5;
  while (retries > 0) {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      if (err.code === 'EBUSY' || err.code === 'EPERM') {
        retries--;
        await new Promise(r => setTimeout(r, 200));
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Could not read ${filePath} (Resource Busy).`);
}

// --- CONFIGURATION HANDLER ---
function getAppConfig() {
  const configPath = path.join(app.getPath('userData'), 'app-config.json');
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.error("Config read error", e);
  }
  return { dbPath: null };
}

function saveAppConfig(config) {
  const configPath = path.join(app.getPath('userData'), 'app-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: '#ffffff', 
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, 
    },
  });

  win.setMenu(null); 
  win.maximize();

  win.webContents.on('context-menu', (event, params) => {
    const menu = new Menu();
    menu.append(new MenuItem({ label: 'Inspect Element', click: () => win.webContents.inspectElement(params.x, params.y) }));
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({ label: 'Refresh', click: () => win.webContents.reload() }));
    menu.append(new MenuItem({ label: 'Open Console', click: () => win.webContents.openDevTools() }));
    menu.popup();
  });

  win.show();

  if (isRunningInDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile('dist/index.html');
  }
}

// ==========================================
// DATABASE IPC HANDLERS
// ==========================================

// 1. SELECT FOLDER
ipcMain.handle('select-db-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Shared Database Folder',
    buttonLabel: 'Select Folder',
    message: 'Select the network folder containing shared session files.'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];
    saveAppConfig({ dbPath: selectedPath });
    return selectedPath;
  }
  return null;
});

// 2. GET CURRENT PATH
ipcMain.handle('get-db-path', () => {
  return getAppConfig().dbPath;
});

// 3. DISCONNECT
ipcMain.handle('disconnect-db', () => {
  saveAppConfig({ dbPath: null });
  return true;
});

// 4. LOAD SESSIONS
ipcMain.handle('load-sessions', async () => {
  const { dbPath } = getAppConfig();
  if (!dbPath || !fs.existsSync(dbPath)) return []; 

  try {
    // Filter out instruments.json so it doesn't appear as a session
    const files = fs.readdirSync(dbPath).filter(file => file.endsWith('.json') && file !== 'instruments.json');
    
    // We use Promise.all to load files in parallel, but handle individual errors gracefully
    const sessions = await Promise.all(files.map(async (file) => {
      try {
        const raw = await safeReadFile(path.join(dbPath, file));
        const data = JSON.parse(raw);
        if (data.id && data.name) return data;
        return null;
      } catch (err) {
        // If a single file is corrupted or locked, skip it rather than crashing app
        console.warn(`Skipping file ${file}:`, err.message);
        return null;
      }
    }));
    
    return sessions.filter(s => s !== null).sort((a, b) => b.id - a.id);
  } catch (error) {
    console.error("DB Load Error:", error);
    return [];
  }
});

// 5. SAVE SESSION (Safe Atomic Write)
ipcMain.handle('save-session', async (event, sessionData) => {
  const { dbPath } = getAppConfig();
  if (!dbPath) throw new Error("Database path not set");

  const safeName = (sessionData.name || "Untitled")
    .replace(/[^a-z0-9 \-_]/gi, '')
    .trim();

  let newFileName = `${safeName}.json`;
  let newFilePath = path.join(dbPath, newFileName);

  // Check for collision with OTHER users' files (same name, different ID)
  if (fs.existsSync(newFilePath)) {
    try {
      const existingRaw = await safeReadFile(newFilePath);
      const existingJson = JSON.parse(existingRaw);
      if (existingJson.id !== sessionData.id) {
        // Name collision! Append ID to make unique
        newFileName = `${safeName}_${sessionData.id}.json`;
        newFilePath = path.join(dbPath, newFileName);
      }
    } catch (e) {
      // If we can't read the colliding file, play it safe and use unique name
      newFileName = `${safeName}_${sessionData.id}.json`;
      newFilePath = path.join(dbPath, newFileName);
    }
  }

  // Cleanup: Delete old files with DIFFERENT names but SAME ID (Renaming logic)
  try {
    const files = fs.readdirSync(dbPath).filter(f => f.endsWith('.json') && f !== 'instruments.json');
    for (const file of files) {
      if (file === newFileName) continue; // Don't delete target
      
      const currentPath = path.join(dbPath, file);
      try {
        const raw = fs.readFileSync(currentPath, 'utf8'); // Sync read is okay for cleanup check
        const data = JSON.parse(raw);
        if (data.id === sessionData.id) {
          fs.unlinkSync(currentPath); // Delete old version
        }
      } catch (e) {}
    }
  } catch (e) {}
  
  // Perform Atomic Write
  await safeWriteFile(newFilePath, JSON.stringify(sessionData, null, 2));
  return true;
});

// 6. DELETE SESSION
ipcMain.handle('delete-session', async (event, sessionId) => {
  const { dbPath } = getAppConfig();
  if (!dbPath) return;

  try {
    const files = fs.readdirSync(dbPath).filter(f => f.endsWith('.json'));
    // Find file by ID content
    for (const f of files) {
        try {
            const raw = fs.readFileSync(path.join(dbPath, f), 'utf8');
            if (JSON.parse(raw).id === sessionId) {
                fs.unlinkSync(path.join(dbPath, f));
                break; // Found and deleted
            }
        } catch {}
    }
  } catch (e) {
    console.error("Error deleting session JSON:", e);
  }

  // Delete associated Images
  try {
    const imagesPath = path.join(dbPath, 'images');
    if (fs.existsSync(imagesPath)) {
      const imageFiles = fs.readdirSync(imagesPath).filter(f => f.startsWith(`img_${sessionId}_`));
      imageFiles.forEach(f => fs.unlinkSync(path.join(imagesPath, f)));
    }
  } catch (e) {
    console.error("Error deleting session images:", e);
  }

  return true;
});

// ==========================================
// INSTRUMENT LIBRARY HANDLERS (SHARED DB)
// ==========================================

// 7. SAVE INSTRUMENT (Multi-User Safe)
ipcMain.handle('save-instrument', async (event, instrument) => {
  const { dbPath } = getAppConfig();
  if (!dbPath) throw new Error("Database path not set");
  
  const instPath = path.join(dbPath, 'instruments.json');
  let instruments = [];
  
  // Always READ fresh from disk before writing to minimize overwriting others
  if (fs.existsSync(instPath)) {
    try {
      const raw = await safeReadFile(instPath);
      instruments = JSON.parse(raw);
      if (!Array.isArray(instruments)) instruments = [];
    } catch(e) { 
      console.error("Error reading instruments DB:", e);
      // If file is corrupted, we might start fresh or throw. 
      // Safe option: Initialize empty array but log error.
      instruments = [];
    }
  }
  
  // Update existing or Append new
  const idx = instruments.findIndex(i => i.id === instrument.id);
  if (idx > -1) {
    instruments[idx] = instrument;
  } else {
    instruments.push(instrument);
  }
  
  // Atomic Write
  await safeWriteFile(instPath, JSON.stringify(instruments, null, 2));
  return true;
});

// 8. LOAD INSTRUMENTS
ipcMain.handle('load-instruments', async () => {
  const { dbPath } = getAppConfig();
  if (!dbPath) return [];
  
  const instPath = path.join(dbPath, 'instruments.json');
  if (fs.existsSync(instPath)) {
    try {
      const data = await safeReadFile(instPath);
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch(e) { 
      console.error("Failed to load instruments:", e);
      return []; 
    }
  }
  return [];
});

// ==========================================
// IMAGE IPC HANDLERS
// ==========================================

// 9. SAVE IMAGE
ipcMain.handle('save-image', async (event, { sessionId, imageId, dataBase64 }) => {
  const { dbPath } = getAppConfig();
  if (!dbPath) return false;

  const imagesPath = path.join(dbPath, 'images');
  if (!fs.existsSync(imagesPath)) fs.mkdirSync(imagesPath);

  const filePath = path.join(imagesPath, `img_${sessionId}_${imageId}.txt`);
  await safeWriteFile(filePath, dataBase64);
  return true;
});

// 10. LOAD IMAGES
ipcMain.handle('load-session-images', async (event, sessionId) => {
  const { dbPath } = getAppConfig();
  if (!dbPath) return [];

  const imagesPath = path.join(dbPath, 'images');
  if (!fs.existsSync(imagesPath)) return [];

  try {
    const files = fs.readdirSync(imagesPath).filter(f => f.startsWith(`img_${sessionId}_`));
    
    const images = await Promise.all(files.map(async (file) => {
      try {
        const imageId = file.replace(`img_${sessionId}_`, '').replace('.txt', '');
        const data = await safeReadFile(path.join(imagesPath, file));
        return { id: imageId, data: data };
      } catch (e) {
        return null;
      }
    }));
    
    return images.filter(i => i !== null);
  } catch (e) {
    console.error("Image Load Error", e);
    return [];
  }
});

// 11. DELETE IMAGE
ipcMain.handle('delete-image', async (event, { sessionId, imageId }) => {
  const { dbPath } = getAppConfig();
  if (!dbPath) return;
  const filePath = path.join(dbPath, 'images', `img_${sessionId}_${imageId}.txt`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
});

// main.js - Add this new handler

// 12. DELETE INSTRUMENT
ipcMain.handle('delete-instrument', async (event, instrumentId) => {
  const { dbPath } = getAppConfig();
  if (!dbPath) return false;
  
  const instPath = path.join(dbPath, 'instruments.json');
  if (fs.existsSync(instPath)) {
    try {
      const raw = await safeReadFile(instPath);
      let instruments = JSON.parse(raw);
      if (!Array.isArray(instruments)) return false;
      
      const newInstruments = instruments.filter(i => i.id !== instrumentId);
      
      await safeWriteFile(instPath, JSON.stringify(newInstruments, null, 2));
      return true;
    } catch(e) {
      console.error("Failed to delete instrument:", e);
      return false;
    }
  }
  return false;
});

// --- THEME HANDLER ---
ipcMain.on('set-theme', (event, mode) => {
  const isDark = mode === 'dark';
  nativeTheme.themeSource = mode;
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.setBackgroundColor(isDark ? '#1e1e1e' : '#ffffff');
  }
});

// --- APP LIFECYCLE ---
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});