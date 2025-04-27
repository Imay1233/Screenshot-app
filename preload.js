// preload.js: Exposes safe APIs to the renderer process via contextBridge
const { contextBridge, ipcRenderer } = require('electron');

// Expose the electronAPI object to the renderer process for secure communication with the main process
contextBridge.exposeInMainWorld('electronAPI', {
  // Send a capture-screen message to the main process with the selected area
  captureScreen: (captureArea) => ipcRenderer.send('capture-screen', captureArea),
  
  // Trigger the start of the capture process by sending a message to the main process
  startCapture: (modes) => ipcRenderer.send('start-capture', modes),
  
  // Listen for the sources-fetched event from the main process to receive screen sources
  handleSourcesFetched: (callback) => ipcRenderer.on('sources-fetched', callback),
  
  // Request to save a screenshot to the downloads folder
  saveScreenshot: (data) => ipcRenderer.invoke('save-screenshot', data),
  
  // Show the main window after capture is complete or canceled
  showMainWindow: () => ipcRenderer.send('show-main-window'),
  
  // Delegate clipboard copy operation to the main process
  copyImageToClipboard: (dataUrl) => {
    try {
      ipcRenderer.send('copy-image-to-clipboard', dataUrl);
    } catch (error) {
      console.error('Error initiating clipboard copy:', error);
    }
  },
  
  // Cancel the screenshot capture process
  cancelScreenshot: () => ipcRenderer.send('cancel-screenshot'),
  
  // Receive the background screenshot data URL for the overlay window
  setBackgroundScreenshot: (callback) => ipcRenderer.on('set-background-screenshot', callback),
  
  // Receive the selection and capture modes for the overlay window
  setModes: (callback) => ipcRenderer.on('set-modes', callback)
});

// End of preload.js