import { app, BrowserWindow } from 'electron';

// Determine if we are in development mode based on the environment variable set by cross-env
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // These settings allow the renderer (React) to access Node.js features if needed
      nodeIntegration: true,
      contextIsolation: false,
      // Disabling webSecurity allows the app to load local resources (file:// protocol)
      // without hitting strict security blocks in the built app.
      webSecurity: false, 
    },
  });

  if (isDev) {
    // In Development: Load the Vite dev server
    win.loadURL('http://localhost:3000');
    // Optional: Open DevTools automatically in dev mode
    // win.webContents.openDevTools(); 
  } else {
    // In Production: Load the built index.html relative to the application root.
    // Electron automatically maps this to the correct path inside the ASAR archive.
    win.loadFile('dist/index.html');
  }
}

// App Lifecycle Listeners
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