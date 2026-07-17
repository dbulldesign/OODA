/* OODA desktop host — preload (runs in an isolated world before the page).
   Exposes window.activity.subscribe(cb): OODA calls it on startup, and every
   foreground-app / idle event the main process samples is delivered to each
   subscriber as {app, title} or {idle:true}. This is the exact contract the
   app's actInitHost() already looks for, so no change to index.html is needed. */
const { contextBridge, ipcRenderer } = require('electron');

const subscribers = [];

ipcRenderer.on('activity-event', (_event, data) => {
  for (const cb of subscribers.slice()) {
    try { cb(data); } catch (e) { /* a bad subscriber must not break the rest */ }
  }
});

contextBridge.exposeInMainWorld('activity', {
  subscribe(cb) {
    if (typeof cb !== 'function') return () => {};
    subscribers.push(cb);
    return () => { const i = subscribers.indexOf(cb); if (i >= 0) subscribers.splice(i, 1); };
  },
  // OODA calls this to feed the current category, color, and today's total back
  // to the host so the mini HUD can tint itself and show the running day total.
  report(data) { ipcRenderer.send('activity-report', data); },
});
