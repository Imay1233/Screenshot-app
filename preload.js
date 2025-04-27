// preload.js: Exposes safe APIs to the renderer process via contextBridge
const { contextBridge, ipcRenderer } = require('electron');

// Expose the electronAPI object to the renderer process for secure communication with the main process
contextBridge.exposeInMainWorld('electronAPI', {
  captureScreen: (captureArea) => ipcRenderer.send('capture-screen', captureArea),
  
  startCapture: (modes) => ipcRenderer.send('start-capture', modes),
  
  handleSourcesFetched: (callback) => ipcRenderer.on('sources-fetched', callback),
  
  saveScreenshot: (data, imageFormat) => ipcRenderer.invoke('save-screenshot', data, imageFormat),
  
  showMainWindow: () => ipcRenderer.send('show-main-window'),
  
  copyImageToClipboard: (dataUrl) => {
    try {
      ipcRenderer.send('copy-image-to-clipboard', dataUrl);
    } catch (error) {
      console.error('Error initiating clipboard copy:', error);
    }
  },
  
  cancelScreenshot: () => ipcRenderer.send('cancel-screenshot'),
  
  setBackgroundScreenshot: (callback) => ipcRenderer.on('set-background-screenshot', callback),
  
  setModes: (callback) => ipcRenderer.on('set-modes', callback)
});

// End of preload.js