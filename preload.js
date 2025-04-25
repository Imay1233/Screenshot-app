const { contextBridge, ipcRenderer, clipboard, nativeImage } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  captureScreen: (captureArea) => ipcRenderer.send('capture-screen', captureArea),
  startCapture: () => ipcRenderer.send('start-capture'),
  handleSourcesFetched: (callback) => ipcRenderer.on('sources-fetched', callback),
  saveScreenshot: (data) => ipcRenderer.invoke('save-screenshot', data),
  showMainWindow: () => ipcRenderer.send('show-main-window'),
  copyImageToClipboard: (dataUrl) => {
    try {
      const image = nativeImage.createFromDataURL(dataUrl);
      if (!image || image.isEmpty()) {
        console.error('Failed to create native image from data URL');
        return;
      }
      clipboard.writeImage(image);
    } catch (error) {
      console.error('Error copying image to clipboard:', error);
    }
  },
  cancelScreenshot: () => ipcRenderer.send('cancel-screenshot'),
  setBackgroundScreenshot: (callback) => ipcRenderer.on('set-background-screenshot', callback)
});