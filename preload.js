const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Main window functions
  captureScreen: (captureArea) => ipcRenderer.send('capture-screen', captureArea),
  startCapture: () => ipcRenderer.send('start-capture'),
  handleSourcesFetched: (callback) => ipcRenderer.on('sources-fetched', callback),
  saveScreenshot: (data) => ipcRenderer.invoke('save-screenshot', data),
  showMainWindow: () => ipcRenderer.send('show-main-window'), // New method to show main window
  
  // Overlay window functions
  cancelScreenshot: () => ipcRenderer.send('cancel-screenshot')
});