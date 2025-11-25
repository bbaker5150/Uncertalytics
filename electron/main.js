import { app, BrowserWindow, Menu, MenuItem } from 'electron';

// This effectively means "If running from source (dev), do this."
const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, 
    },
  });

  // 1. Remove the default menu bar
  win.setMenu(null); 

  // 2. Maximize
  win.maximize();

  // 3. Enable Right-Click "Inspect Element"
  win.webContents.on('context-menu', (event, params) => {

    if (isDev) {
      const menu = new Menu();
      
      menu.append(new MenuItem({
        label: 'Inspect Element',
        click: () => {
          win.webContents.inspectElement(params.x, params.y);
        }
      }));

      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ 
        label: 'Clear Data and Reload',
        click: () => { 
          win.webContents.executeJavaScript('localStorage.clear(); window.location.reload();');
        } 
      }));

      menu.popup();
    }
  });

  win.show();

  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile('dist/index.html');
  }
}

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