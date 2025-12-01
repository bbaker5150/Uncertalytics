import { app, BrowserWindow, Menu, MenuItem, ipcMain, nativeTheme } from 'electron';

// We still need this to know WHERE to load the app from (Server vs File)
const isRunningInDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    // Set initial background color to match your App.css (--header-background)
    // to prevent white flashes during loading
    backgroundColor: '#ffffff', 
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: true, 
    },
  });

  // 1. Remove the default file menu
  win.setMenu(null); 

  // 2. Maximize
  win.maximize();

  // 3. Enable Context Menu
  win.webContents.on('context-menu', (event, params) => {
    const menu = new Menu();
    
    menu.append(new MenuItem({
      label: 'Inspect Element',
      click: () => {
        win.webContents.inspectElement(params.x, params.y);
      }
    }));

    menu.append(new MenuItem({ type: 'separator' }));
    
    menu.append(new MenuItem({ 
      label: 'Clear Data And Refresh', 
      click: () => { 
        win.webContents.executeJavaScript('localStorage.clear(); window.location.reload();');
      } 
    }));

    menu.append(new MenuItem({ 
      label: 'Open Developer Console', 
      click: () => { win.webContents.openDevTools(); } 
    }));

    menu.popup();
  });

  win.show();

  // 4. Load the App
  if (isRunningInDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile('dist/index.html');
  }
}

ipcMain.on('set-theme', (event, mode) => {
  const isDark = mode === 'dark';
  
  // 1. Update Electron's internal theme (affects context menus, scrollbars)
  nativeTheme.themeSource = mode;

  // 2. Update Background Color to match App.css variables
  // Dark: #1e1e1e, Light: #ffffff
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.setBackgroundColor(isDark ? '#1e1e1e' : '#ffffff');
  }
});

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