const { app, BrowserWindow, ipcMain, screen, globalShortcut, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');

// Keep a global reference of the windows
let mainWindow;
let overlayWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  overlayWindow = new BrowserWindow({
    width,
    height,
    transparent: true,
    frame: false,
    fullscreen: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

   // Set the window to be completely click-through except for the selection box
  overlayWindow.setIgnoreMouseEvents(false);

  overlayWindow.loadFile(path.join(__dirname, 'src', 'overlay.html'));

  // Set the window as frameless and totally transparent
  overlayWindow.setOpacity(0.3); // Try a partial opacity to see if it's working at all
  
  if (isDev) {
    overlayWindow.webContents.openDevTools();
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

app.whenReady().then(() => {
  createMainWindow();
  
  // Register a global shortcut for taking screenshots
  globalShortcut.register('CommandOrControl+Shift+X', () => {
    if (!overlayWindow) {
      createOverlayWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Handle capture request
// Handle capture request
ipcMain.on('capture-screen', async (event, captureArea) => {
  try {
    // Get the available sources (screens)
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 0, height: 0 }
    });
    
    // Close the overlay window after selection
    if (overlayWindow) {
      overlayWindow.close();
    }
    
    // Make sure captureArea is defined before sending
    if (captureArea && captureArea.width > 0 && captureArea.height > 0) {
      // Send the sources to the renderer process
      mainWindow.webContents.send('sources-fetched', sources, captureArea);
    }
  } catch (error) {
    console.error('Error capturing screen:', error);
  }
});

ipcMain.on('start-capture', () => {
  if (!overlayWindow) {
    createOverlayWindow();
  }
});

// Handle screenshot saving
ipcMain.handle('save-screenshot', async (event, data) => {
  const downloadsPath = app.getPath('downloads');
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filePath = path.join(downloadsPath, `screenshot-${timestamp}.png`);
  
  // Remove the data URL prefix
  const base64Data = data.replace(/^data:image\/png;base64,/, '');
  
  try {
    fs.writeFileSync(filePath, base64Data, 'base64');
    return { success: true, filePath };
  } catch (error) {
    console.error('Error saving screenshot:', error);
    return { success: false, error: error.message };
  }
});

// Cancel screenshot
ipcMain.on('cancel-screenshot', () => {
  if (overlayWindow) {
    overlayWindow.close();
  }
});