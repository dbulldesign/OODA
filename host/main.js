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
const { app, BrowserWindow, Tray, Menu, nativeImage, powerMonitor, ipcMain, screen } = require('electron');
const path = require('path');

const IDLE_SECONDS = 60;    // match the app's Idle Detection threshold
const POLL_MS = 4000;       // how often to sample the foreground window
const DEFAULT_URL = 'https://dbulldesign.github.io/OODA/';

let win = null;
let tray = null;
let hud = null;             // always-on-top mini HUD window
let hudVisible = true;      // whether the HUD is shown
let lastKey = null;         // last app|title we forwarded (dedupe → one segment per switch)
let lastIdle = false;
let paused = false;         // tray "Pause capturing"
let isQuitting = false;     // true only when the user chooses Quit
let currentStatus = 'Starting…';   // what the tray/HUD shows we're capturing
let segmentStart = Date.now();     // when the current activity started (for the HUD timer)

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
  // Keep OUR dynamic title (what's being captured) authoritative — don't let
  // the loaded page's <title> overwrite it. This title shows on the taskbar
  // button, the title bar, and Alt-Tab.
  win.on('page-title-updated', (e) => { e.preventDefault(); });
  // Closing the window hides it to the tray instead of quitting, so capture
  // keeps running in the background. Quit is available from the tray menu.
  win.on('close', (e) => {
    if (!isQuitting) { e.preventDefault(); win.hide(); }
  });
  updateTitle();
}

// Reflect the current capture in the window title, so it's visible on the
// Windows taskbar button (and title bar / Alt-Tab) without hovering the tray.
function updateTitle() {
  if (!win || win.isDestroyed()) return;
  const s = currentStatus.length > 50 ? currentStatus.slice(0, 49) + '…' : currentStatus;
  win.setTitle(paused ? 'OODA — paused' : 'OODA ⏺ ' + s);
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
    { label: hudVisible ? 'Hide mini HUD' : 'Show mini HUD', click: toggleHud },
    { label: 'Show OODA', click: showWindow },
    { type: 'separator' },
    { label: 'Quit OODA', click: () => { isQuitting = true; app.quit(); } },
  ]));
}

// --- always-on-top mini HUD: a small pill that stays above other windows and
// shows the current activity + a live timer, so what's being captured is
// visible at a glance regardless of Windows taskbar settings. ---
function createHud() {
  try {
    const wa = screen.getPrimaryDisplay().workArea;
    const W = 300, H = 46;
    hud = new BrowserWindow({
      width: W, height: H,
      x: wa.x + wa.width - W - 12,
      y: wa.y + 12,
      frame: false, resizable: false, movable: true, minimizable: false, maximizable: false,
      skipTaskbar: true, alwaysOnTop: true, transparent: true, focusable: false,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: path.join(__dirname, 'hud-preload.js'),
        contextIsolation: true, nodeIntegration: false,
      },
    });
    hud.setAlwaysOnTop(true, 'screen-saver');
    hud.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    hud.loadFile(path.join(__dirname, 'hud.html'));
    hud.webContents.on('did-finish-load', updateHud);
    if (hudVisible) hud.showInactive(); else hud.hide();
  } catch (e) {
    // HUD is optional; never let it stop the app.
  }
}

function updateHud() {
  if (hud && !hud.isDestroyed()) {
    hud.webContents.send('hud-update', { label: currentStatus, paused, startedAt: segmentStart });
  }
}

function toggleHud() {
  hudVisible = !hudVisible;
  if (hud && !hud.isDestroyed()) { if (hudVisible) hud.showInactive(); else hud.hide(); }
  updateTray();
}

function setStatus(label) {
  const next = label || 'Idle';
  if (next !== currentStatus) segmentStart = Date.now();   // new activity → restart the HUD timer
  currentStatus = next;
  updateTray();
  updateTitle();
  updateHud();
  // macOS: also show the text next to the menu-bar icon (no-op on Windows).
  if (tray && tray.setTitle) { try { tray.setTitle(paused ? ' paused' : ' ' + currentStatus); } catch (e) {} }
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
  updateTitle();
  updateHud();
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
  createHud();
  ipcMain.on('hud-show', showWindow);
  ipcMain.on('hud-pause', togglePause);
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
