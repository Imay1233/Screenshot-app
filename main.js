const { app, BrowserWindow, ipcMain, screen, globalShortcut, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');

let mainWindow;
let overlayWindow;

const enableDevTools = isDev && process.env.ENABLE_DEVTOOLS !== 'false';

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
  
  if (enableDevTools) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function captureDesktopScreenshot() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width, height }
  });
  
  const primarySource = sources[0];
  return primarySource.thumbnail.toDataURL();
}

async function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // Capture a screenshot of the desktop
  const screenshotDataUrl = await captureDesktopScreenshot();

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

  overlayWindow.setIgnoreMouseEvents(false);
  overlayWindow.loadFile(path.join(__dirname, 'src', 'overlay.html'));
  
  // Send the screenshot data to the overlay window
  overlayWindow.webContents.on('did-finish-load', () => {
    overlayWindow.webContents.send('set-background-screenshot', screenshotDataUrl);
  });
  
  if (enableDevTools) {
    overlayWindow.webContents.openDevTools();
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

app.whenReady().then(() => {
  createMainWindow();
  
  globalShortcut.register('CommandOrControl+Shift+X', () => {
    if (!overlayWindow && mainWindow) {
      mainWindow.hide();
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

ipcMain.on('capture-screen', async (event, captureArea) => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 0, height: 0 }
    });
    
    if (overlayWindow) {
      overlayWindow.close();
    }
    
    if (captureArea && captureArea.width > 0 && captureArea.height > 0) {
      mainWindow.webContents.send('sources-fetched', sources, captureArea);
    }
  } catch (error) {
    console.error('Error capturing screen:', error);
  }
});

ipcMain.on('show-main-window', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

ipcMain.on('start-capture', () => {
  if (!overlayWindow && mainWindow) {
    mainWindow.hide();
    createOverlayWindow();
  }
});

ipcMain.handle('save-screenshot', async (event, data) => {
  const downloadsPath = app.getPath('downloads');
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filePath = path.join(downloadsPath, `screenshot-${timestamp}.png`);
  
  const base64Data = data.replace(/^data:image\/png;base64,/, '');
  
  try {
    fs.writeFileSync(filePath, base64Data, 'base64');
    return { success: true, filePath };
  } catch (error) {
    console.error('Error saving screenshot:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.on('cancel-screenshot', () => {
  if (overlayWindow) {
    overlayWindow.close();
  }
  if (mainWindow) {
    mainWindow.show();
  }
});