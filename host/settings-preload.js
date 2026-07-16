/* Preload for the settings window. Bridges the form to the main process:
   load current settings, save changes, and close the window. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsApi', {
  get: () => ipcRenderer.invoke('settings-get'),
  save: (s) => ipcRenderer.send('settings-save', s),
  close: () => ipcRenderer.send('settings-close'),
});
