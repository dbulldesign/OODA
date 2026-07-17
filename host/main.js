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
const fs = require('fs');

const POLL_MS = 4000;       // how often to sample the foreground window
const DEFAULT_URL = 'https://dbulldesign.github.io/OODA/';

// Persisted user settings (written to userData/settings.json).
const DEFAULTS = {
  hudEnabled: true,          // show the always-on-top mini HUD
  hudCorner: 'top-right',    // top-right | top-left | bottom-right | bottom-left
  hudOpacity: 1,             // 0.4 – 1
  hudShowTimer: true,        // show the live timer on the HUD
  hudScale: 1,               // 0.85 | 1 | 1.15 | 1.3 — HUD size / text scale
  hudCompact: false,         // compact: dot + timer only (no label)
  hudShowCategory: true,     // tint by category color + show today's total
  hudRemember: false,        // remember a custom dragged position instead of a corner
  hudX: null, hudY: null,    // saved custom position (when hudRemember)
  idleMinutes: 1,            // mark "away" after this many minutes idle
  launchAtStartup: false,    // start the host at login
};
let settings = { ...DEFAULTS };
function settingsPath() { return path.join(app.getPath('userData'), 'settings.json'); }
function loadSettings() {
  try { settings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) }; }
  catch (e) { settings = { ...DEFAULTS }; }
}
function saveSettings() {
  try { fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2)); } catch (e) {}
}
function idleSeconds() { return Math.max(30, (settings.idleMinutes || 1) * 60); }

let win = null;
let tray = null;
let hud = null;             // always-on-top mini HUD window
let settingsWin = null;     // settings window
let lastKey = null;         // last app|title we forwarded (dedupe → one segment per switch)
let lastIdle = false;
let paused = false;         // tray "Pause capturing"
let isQuitting = false;     // true only when the user chooses Quit
let currentStatus = 'Starting…';   // what the tray/HUD shows we're capturing
let segmentStart = Date.now();     // when the current activity started (for the HUD timer)
let reported = { color: null, category: null, todayMs: 0 };   // fed back by the web app

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
    { label: settings.hudEnabled ? 'Hide mini HUD' : 'Show mini HUD', click: toggleHud },
    { label: 'Settings…', click: openSettingsWindow },
    { label: 'Show OODA', click: showWindow },
    { type: 'separator' },
    { label: 'Quit OODA', click: () => { isQuitting = true; app.quit(); } },
  ]));
}

// --- always-on-top mini HUD: a small pill that stays above other windows and
// shows the current activity + a live timer, so what's being captured is
// visible at a glance regardless of Windows taskbar settings. ---
function hudSize() {
  const s = settings.hudScale || 1;
  return { w: Math.round((settings.hudCompact ? 156 : 300) * s), h: Math.round(46 * s) };
}
function hudXY() {
  const { w, h } = hudSize();
  const wa = screen.getPrimaryDisplay().workArea, m = 12;
  // a remembered custom position wins (clamped so it can't land off-screen)
  if (settings.hudRemember && settings.hudX != null && settings.hudY != null) {
    return {
      x: Math.min(Math.max(settings.hudX, wa.x), wa.x + wa.width - w),
      y: Math.min(Math.max(settings.hudY, wa.y), wa.y + wa.height - h),
    };
  }
  const right = wa.x + wa.width - w - m, left = wa.x + m;
  const top = wa.y + m, bottom = wa.y + wa.height - h - m;
  switch (settings.hudCorner) {
    case 'top-left': return { x: left, y: top };
    case 'bottom-left': return { x: left, y: bottom };
    case 'bottom-right': return { x: right, y: bottom };
    default: return { x: right, y: top };   // top-right
  }
}
function createHud() {
  try {
    const { w, h } = hudSize();
    const { x, y } = hudXY();
    hud = new BrowserWindow({
      width: w, height: h, x, y,
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
    hud.setOpacity(settings.hudOpacity);
    hud.loadFile(path.join(__dirname, 'hud.html'));
    hud.webContents.on('did-finish-load', updateHud);
    // remember where the user drags it (only persisted while "remember" is on)
    hud.on('moved', () => {
      if (!settings.hudRemember || !hud || hud.isDestroyed()) return;
      const [px, py] = hud.getPosition(); settings.hudX = px; settings.hudY = py; saveSettings();
    });
    if (settings.hudEnabled) hud.showInactive(); else hud.hide();
  } catch (e) {
    // HUD is optional; never let it stop the app.
  }
}

function updateHud() {
  if (hud && !hud.isDestroyed()) {
    hud.webContents.send('hud-update', {
      label: currentStatus, paused, startedAt: segmentStart,
      showTimer: settings.hudShowTimer, compact: settings.hudCompact, scale: settings.hudScale || 1,
      showCategory: settings.hudShowCategory, color: reported.color, category: reported.category, todayMs: reported.todayMs,
    });
  }
}

// Apply the current settings to the live HUD window (size, position, opacity, visibility).
function applyHud() {
  if (!hud || hud.isDestroyed()) return;
  const { w, h } = hudSize();
  hud.setSize(w, h);
  // when "remember" was just turned on with no saved point yet, capture where it is now
  if (settings.hudRemember && (settings.hudX == null || settings.hudY == null)) {
    const [px, py] = hud.getPosition(); settings.hudX = px; settings.hudY = py; saveSettings();
  }
  const { x, y } = hudXY();
  hud.setPosition(x, y);
  hud.setOpacity(settings.hudOpacity);
  if (settings.hudEnabled) hud.showInactive(); else hud.hide();
  updateHud();
}

function toggleHud() {
  settings.hudEnabled = !settings.hudEnabled;
  saveSettings();
  applyHud();
  updateTray();
}

// Apply all settings (HUD + launch-at-startup) and refresh the tray.
function applySettings() {
  applyHud();
  try { app.setLoginItemSettings({ openAtLogin: !!settings.launchAtStartup }); } catch (e) {}
  updateTray();
}

function openSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.show(); settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 430, height: 580, resizable: false, title: 'OODA host settings',
    backgroundColor: '#1F2A2C', icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  settingsWin.setMenuBarVisibility(false);
  settingsWin.loadFile(path.join(__dirname, 'settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
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
    const idle = powerMonitor.getSystemIdleTime() >= idleSeconds();
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
  loadSettings();
  createWindow();
  createTray();
  createHud();
  applySettings();
  ipcMain.on('hud-show', showWindow);
  ipcMain.on('hud-pause', togglePause);
  // the web app reports the current category, its color, and today's total back
  ipcMain.on('activity-report', (_e, d) => {
    if (!d) return;
    reported = { color: d.color || null, category: d.category || null, todayMs: d.todayMs || 0 };
    updateHud();
  });
  ipcMain.handle('settings-get', () => settings);
  ipcMain.on('settings-save', (_e, incoming) => {
    settings = { ...settings, ...(incoming || {}) };
    saveSettings();
    applySettings();
  });
  ipcMain.on('settings-close', () => { if (settingsWin && !settingsWin.isDestroyed()) settingsWin.close(); });
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
