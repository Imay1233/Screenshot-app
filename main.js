// main.js: Main process script for the Electron screenshot app
const { app, BrowserWindow, ipcMain, screen, globalShortcut, desktopCapturer, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');

// Global references to the main and overlay windows
let mainWindow;
let overlayWindow;

// Enable DevTools in development mode unless explicitly disabled
const enableDevTools = isDev && process.env.ENABLE_DEVTOOLS !== 'false';

// Create the main window (the UI for previewing and saving screenshots)
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false, // Disable Node.js integration in renderer for security
      contextIsolation: true, // Enable context isolation for security
      preload: path.join(__dirname, 'preload.js') // Load the preload script for safe IPC
    }
  });

  // Load the main window HTML
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  
  // Open DevTools in development mode
  if (enableDevTools) {
    mainWindow.webContents.openDevTools();
  }

  // Clean up when the window is closed
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

  // Capture a screenshot to use as the background
  const screenshotDataUrl = await captureDesktopScreenshot();

  // Create a fullscreen, transparent overlay window
  overlayWindow = new BrowserWindow({
    width,
    height,
    transparent: true, // Make the window transparent
    frame: false, // Remove window frame
    fullscreen: true, // Make the window fullscreen
    alwaysOnTop: true, // Keep the window on top of all other windows
    resizable: false, // Disable resizing of the window
    backgroundColor: '#00000000', // Fully transparent background
    webPreferences: {
      nodeIntegration: false, // Disable Node.js integration for security
      contextIsolation: true, // Enable context isolation for security
      preload: path.join(__dirname, 'preload.js') // Load the preload script
    }
  });

  // Allow mouse events on the window
  overlayWindow.setIgnoreMouseEvents(false);
  
  // Load the overlay HTML
  overlayWindow.loadFile(path.join(__dirname, 'src', 'overlay.html'));
  
  // Send the screenshot data URL and modes to the overlay window after it loads
  overlayWindow.webContents.on('did-finish-load', () => {
    overlayWindow.webContents.send('set-background-screenshot', screenshotDataUrl);
    overlayWindow.webContents.send('set-modes', modes);
  });
  
  // Open DevTools in development mode
  if (enableDevTools) {
    overlayWindow.webContents.openDevTools();
  }

  // Clean up when the window is closed
  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

// Initialize the app when Electron is ready
app.whenReady().then(() => {
  createMainWindow();
  
  // Register a global shortcut (Ctrl+Shift+X or Cmd+Shift+X) to start capture
  globalShortcut.register('CommandOrControl+Shift+X', () => {
    if (!overlayWindow && mainWindow) {
      mainWindow.hide();
      // Use the currently selected modes (default to 'drag' and 'instant' if not set)
      const selectionMode = document.querySelector('input[name="selection-mode"]:checked')?.value || 'drag';
      const captureMode = document.querySelector('input[name="capture-mode"]:checked')?.value || 'instant';
      createOverlayWindow({ selectionMode, captureMode });
    }
  });
});

// Quit the app when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Recreate the main window if the app is activated (e.g., clicking the dock icon on macOS)
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
      mainWindow.webContents.send('sources-fetched', sources, captureArea);
    }
  } catch (error) {
    console.error('Error capturing screen:', error);
  }
});

// Show the main window when requested
ipcMain.on('show-main-window', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

// Start the capture process when requested, passing the selected modes
ipcMain.on('start-capture', (event, modes) => {
  if (!overlayWindow && mainWindow) {
    mainWindow.hide();
    createOverlayWindow(modes);
  }
});

// Save a screenshot to the downloads folder
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