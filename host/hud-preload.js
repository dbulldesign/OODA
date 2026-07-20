/* Preload for the always-on-top mini HUD window. Exposes a tiny bridge the
   HUD page uses to receive live capture updates and send back its two
   actions (open the main window, toggle pause). */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hud', {
  onUpdate: (cb) => { if (typeof cb === 'function') ipcRenderer.on('hud-update', (_e, d) => cb(d)); },
  show: () => ipcRenderer.send('hud-show'),
  togglePause: () => ipcRenderer.send('hud-pause'),
  hover: (on) => ipcRenderer.send('hud-hover', !!on),   // expand on hover to reveal the full text
  onExpanded: (cb) => { if (typeof cb === 'function') ipcRenderer.on('hud-expanded', (_e, on) => cb(!!on)); },
});
