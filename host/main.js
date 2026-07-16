/* OODA desktop host — main process.
   Wraps the OODA web app in an Electron window and feeds it real
   computer-activity events (the foreground app + its window title, and
   away/idle state) through the window.activity bridge the app already
   consumes. Nothing here talks to the network; it only observes the
   local desktop and forwards events into the page.

   A system-tray icon stays in the taskbar notification area showing what's
   currently being captured, with pause/resume and show/quit controls.

   Foreground app/title come from `get-windows` (a small native addon).
   Idle time comes from Electron's built-in powerMonitor — no extra
   native dependency, cross-platform. */
const { app, BrowserWindow, Tray, Menu, nativeImage, powerMonitor } = require('electron');
const path = require('path');

const IDLE_SECONDS = 60;    // match the app's Idle Detection threshold
const POLL_MS = 4000;       // how often to sample the foreground window
const DEFAULT_URL = 'https://dbulldesign.github.io/OODA/';

let win = null;
let tray = null;
let lastKey = null;         // last app|title we forwarded (dedupe → one segment per switch)
let lastIdle = false;
let paused = false;         // tray "Pause capturing"
let isQuitting = false;     // true only when the user chooses Quit
let currentStatus = 'Starting…';   // what the tray shows we're capturing

function localAppPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app-web', 'index.html')
    : path.join(__dirname, '..', 'index.html');
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 820,
    backgroundColor: '#1F2A2C',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // By default load the live deployed app, so the desktop window auto-updates
  // its UI whenever a new version ships (the app is a PWA — it caches itself
  // and shows its own "new version available" prompt). If the site can't be
  // reached (offline first launch), fall back to the copy bundled in the app.
  // OODA_URL overrides the default with any URL or a local file path.
  const override = process.env.OODA_URL;
  if (override) {
    if (/^https?:/i.test(override)) win.loadURL(override);
    else win.loadFile(override);
  } else {
    win.loadURL(DEFAULT_URL);
    win.webContents.on('did-fail-load', (_e, _code, _desc, _url, isMainFrame) => {
      if (isMainFrame) win.loadFile(localAppPath());
    });
  }
  // Closing the window hides it to the tray instead of quitting, so capture
  // keeps running in the background. Quit is available from the tray menu.
  win.on('close', (e) => {
    if (!isQuitting) { e.preventDefault(); win.hide(); }
  });
}

function showWindow() {
  if (!win || win.isDestroyed()) { createWindow(); return; }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createTray() {
  try {
    const img = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.ico'));
    tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
    tray.on('click', showWindow);        // click the tray icon → open the window
    tray.on('double-click', showWindow);
    updateTray();
  } catch (e) {
    // Tray is a nicety; never let it stop the app from running.
  }
}

function updateTray() {
  if (!tray) return;
  const status = paused ? 'Paused' : currentStatus;
  tray.setToolTip('OODA — ' + (paused ? 'capture paused' : 'capturing: ' + currentStatus));
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: paused ? 'Capture paused' : 'Capturing: ' + status, enabled: false },
    { type: 'separator' },
    { label: paused ? 'Resume capturing' : 'Pause capturing', click: togglePause },
    { label: 'Show OODA', click: showWindow },
    { type: 'separator' },
    { label: 'Quit OODA', click: () => { isQuitting = true; app.quit(); } },
  ]));
}

function setStatus(label) {
  currentStatus = label || 'Idle';
  updateTray();
}

function send(data) {
  if (win && !win.isDestroyed()) win.webContents.send('activity-event', data);
}

function togglePause() {
  paused = !paused;
  if (paused) {
    send({ stop: true });     // tell the app to close the current segment (stop the clock)
    lastKey = null; lastIdle = false;
  } else {
    lastKey = null;           // force the next poll to re-report the foreground app
  }
  updateTray();
}

async function poll() {
  if (paused || !win || win.isDestroyed()) return;
  try {
    const idle = powerMonitor.getSystemIdleTime() >= IDLE_SECONDS;
    if (idle) {
      if (!lastIdle) { send({ idle: true }); lastIdle = true; lastKey = null; setStatus('Idle / away'); }
      return;
    }
    lastIdle = false;
    // get-windows is ESM-only — import it dynamically from CommonJS.
    const { activeWindow } = await import('get-windows');
    const w = await activeWindow();
    if (!w) return;
    const appName = (w.owner && w.owner.name) || 'Unknown';
    const title = w.title || '';
    const key = appName + '|' + title;
    if (key !== lastKey) {
      lastKey = key;
      send({ app: appName, title });   // OODA categorizes + times it
      setStatus(title ? appName + ' — ' + title : appName);
    }
  } catch (e) {
    // Missing OS permission or an unsupported platform — skip this tick.
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  setInterval(poll, POLL_MS);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showWindow();
  });
});

app.on('before-quit', () => { isQuitting = true; });

// Keep running in the tray when the window is closed; quit only via the tray.
app.on('window-all-closed', () => {
  if (isQuitting && process.platform !== 'darwin') app.quit();
});
