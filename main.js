// main.js: Main process script for the Electron screenshot app
const { app, BrowserWindow, ipcMain, screen, globalShortcut, desktopCapturer, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');

// Global references to the main and overlay windows
let mainWindow;
let overlayWindow;
let currentModes = { selectionMode: 'drag', captureMode: 'instant', imageFormat: 'png' }; // Store modes globally

// Enable DevTools in development mode unless explicitly disabled
const enableDevTools = isDev && process.env.ENABLE_DEVTOOLS !== 'false';

// Create the main window (the UI for previewing and saving screenshots)
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

// Capture a full-screen screenshot to use as the overlay background
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

// Create the overlay window for selecting the capture area
async function createOverlayWindow(modes) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const screenshotDataUrl = await captureDesktopScreenshot();

  overlayWindow = new BrowserWindow({
    width,
    height,
    transparent: true,
    frame: false,
    fullscreen: true,
    alwaysOnTop: true,
    resizable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  overlayWindow.setIgnoreMouseEvents(false);
  
  overlayWindow.loadFile(path.join(__dirname, 'src', 'overlay.html'));
  
  overlayWindow.webContents.on('did-finish-load', () => {
    overlayWindow.webContents.send('set-background-screenshot', screenshotDataUrl);
    overlayWindow.webContents.send('set-modes', modes);
  });
  
  if (enableDevTools) {
    overlayWindow.webContents.openDevTools();
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

// Initialize the app when Electron is ready
app.whenReady().then(() => {
  createMainWindow();
  
  globalShortcut.register('CommandOrControl+Shift+X', () => {
    if (!overlayWindow && mainWindow) {
      mainWindow.hide();
      // Use the last known modes or defaults
      createOverlayWindow(currentModes);
    }
  });
});

// Quit the app when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Recreate the main window if the app is activated
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Handle the capture-screen message to fetch screen sources and send them to the renderer
ipcMain.on('capture-screen', async (event, captureArea) => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 0, height: 0 }
    });
    
    if (overlayWindow) {
      overlayWindow.close();
    }
    
    if (captureArea && captureArea.width > 10 && captureArea.height > 10) {
      mainWindow.webContents.send('sources-fetched', sources, captureArea, currentModes.imageFormat);
    }
  } catch (error) {
    console.error('Error capturing screen:', error);
    if (mainWindow) {
      mainWindow.show();
    }
  }
});

// Show the main window when requested
ipcMain.on('show-main-window', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

// Start the capture process when requested, passing the selected modes and format
ipcMain.on('start-capture', (event, modes) => {
  if (!overlayWindow && mainWindow) {
    mainWindow.hide();
    currentModes = { ...currentModes, ...modes }; // Update stored modes
    createOverlayWindow(modes);
  }
});

// Save a screenshot to the downloads folder
ipcMain.handle('save-screenshot', async (event, data, imageFormat) => {
  const downloadsPath = app.getPath('downloads');
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const extension = imageFormat === 'jpeg' ? 'jpg' : imageFormat;
  const filePath = path.join(downloadsPath, `screenshot-${timestamp}.${extension}`);
  
  const base64Data = data.replace(/^data:image\/[a-z]+;base64,/, '');
  
  try {
    fs.writeFileSync(filePath, base64Data, 'base64');
    return { success: true, filePath };
  } catch (error) {
    console.error('Error saving screenshot:', error);
    return { success: false, error: error.message };
  }
});

// Cancel the screenshot capture process
ipcMain.on('cancel-screenshot', () => {
  if (overlayWindow) {
    overlayWindow.close();
  }
  if (mainWindow) {
    mainWindow.show();
  }
});

// Handle clipboard copy operation in the main process
ipcMain.on('copy-image-to-clipboard', (event, dataUrl) => {
  try {
    const image = nativeImage.createFromDataURL(dataUrl);
    if (!image || image.isEmpty()) {
      console.error('Failed to create native image from data URL in main process');
      return;
    }
    clipboard.writeImage(image);
    console.log('Successfully copied image to clipboard in main process');
  } catch (error) {
    console.error('Error copying image to clipboard in main process:', error);
  }
});

// End of main.js