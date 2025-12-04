import { app, BrowserWindow, Menu, MenuItem, ipcMain, nativeTheme, dialog } from 'electron';
import fs from 'fs';
import path from 'path';

const isRunningInDev = !app.isPackaged;

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
    // Start with white to prevent flash, theme handler will update it shortly after
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
    title: 'Select Session Data Folder',
    buttonLabel: 'Select Database Folder',
    message: 'Select the folder containing your session files. (Note: Individual files are hidden in this view)'
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
    const files = fs.readdirSync(dbPath).filter(file => file.endsWith('.json'));
    const sessions = files.map(file => {
      try {
        const raw = fs.readFileSync(path.join(dbPath, file), 'utf8');
        const data = JSON.parse(raw);
        // Basic validation: must have ID and Name
        if (data.id && data.name) return data;
        return null;
      } catch (err) {
        return null;
      }
    }).filter(s => s !== null);
    
    // Sort by ID (created timestamp) descending
    return sessions.sort((a, b) => b.id - a.id);
  } catch (error) {
    console.error("DB Load Error:", error);
    return [];
  }
});

// 5. SAVE SESSION (Dynamic Naming + Cleanup)
ipcMain.handle('save-session', async (event, sessionData) => {
  const { dbPath } = getAppConfig();
  if (!dbPath) throw new Error("Database path not set");

  // Sanitize filename
  const safeName = (sessionData.name || "Untitled")
    .replace(/[^a-z0-9 \-_]/gi, '') // Remove special chars, keep spaces
    .trim();

  let newFileName = `${safeName}.json`;
  let newFilePath = path.join(dbPath, newFileName);

  // Handle Collisions (Same name, different ID)
  if (fs.existsSync(newFilePath)) {
    try {
      const existingRaw = fs.readFileSync(newFilePath, 'utf8');
      const existingJson = JSON.parse(existingRaw);
      if (existingJson.id !== sessionData.id) {
        // Name collision! Append ID to make unique
        newFileName = `${safeName}_${sessionData.id}.json`;
        newFilePath = path.join(dbPath, newFileName);
      }
    } catch (e) {
      newFileName = `${safeName}_${sessionData.id}.json`;
      newFilePath = path.join(dbPath, newFileName);
    }
  }

  // Cleanup: Delete any OLD files for this specific session ID (renaming support)
  try {
    const files = fs.readdirSync(dbPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      if (file === newFileName) continue; // Don't delete what we are about to write
      
      const currentPath = path.join(dbPath, file);
      try {
        const raw = fs.readFileSync(currentPath, 'utf8');
        const data = JSON.parse(raw);
        if (data.id === sessionData.id) {
          fs.unlinkSync(currentPath); // Found an old version, delete it
        }
      } catch (e) {}
    }
  } catch (e) {}
  
  // Write the file
  fs.writeFileSync(newFilePath, JSON.stringify(sessionData, null, 2));
  return true;
});

// 6. DELETE SESSION
ipcMain.handle('delete-session', async (event, sessionId) => {
  const { dbPath } = getAppConfig();
  if (!dbPath) return;

  // A. Delete the JSON file
  try {
    const files = fs.readdirSync(dbPath).filter(f => f.endsWith('.json'));
    // We have to inspect contents to find the right ID since filename might vary
    const targetFile = files.find(f => {
      try {
        const raw = fs.readFileSync(path.join(dbPath, f), 'utf8');
        return JSON.parse(raw).id === sessionId;
      } catch { return false; }
    });

    if (targetFile) {
      fs.unlinkSync(path.join(dbPath, targetFile));
    }
  } catch (e) {
    console.error("Error deleting session JSON:", e);
  }

  // B. Delete associated Images
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
// IMAGE IPC HANDLERS
// ==========================================

// 7. SAVE IMAGE
ipcMain.handle('save-image', async (event, { sessionId, imageId, dataBase64 }) => {
  const { dbPath } = getAppConfig();
  if (!dbPath) return false;

  const imagesPath = path.join(dbPath, 'images');
  if (!fs.existsSync(imagesPath)) fs.mkdirSync(imagesPath);

  const filePath = path.join(imagesPath, `img_${sessionId}_${imageId}.txt`);
  fs.writeFileSync(filePath, dataBase64);
  return true;
});

// 8. LOAD IMAGES
ipcMain.handle('load-session-images', async (event, sessionId) => {
  const { dbPath } = getAppConfig();
  if (!dbPath) return [];

  const imagesPath = path.join(dbPath, 'images');
  if (!fs.existsSync(imagesPath)) return [];

  try {
    const files = fs.readdirSync(imagesPath).filter(f => f.startsWith(`img_${sessionId}_`));
    const images = files.map(file => {
      try {
        // Filename format: img_{sessionId}_{imageId}.txt
        // We split by '_' and grab the 3rd part (index 2)
        const parts = file.split('_'); 
        // Handles cases where image ID might contain underscores? Better to rely on suffix.
        // Let's assume standard format: img_SESSIONID_IMAGEID.txt
        // Just reading the content is what matters most.
        const imageId = file.replace(`img_${sessionId}_`, '').replace('.txt', '');
        
        const data = fs.readFileSync(path.join(imagesPath, file), 'utf8');
        return { id: imageId, data: data };
      } catch (e) {
        return null;
      }
    }).filter(i => i !== null);
    
    return images;
  } catch (e) {
    console.error("Image Load Error", e);
    return [];
  }
});

// 9. DELETE IMAGE
ipcMain.handle('delete-image', async (event, { sessionId, imageId }) => {
  const { dbPath } = getAppConfig();
  if (!dbPath) return;
  const filePath = path.join(dbPath, 'images', `img_${sessionId}_${imageId}.txt`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
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