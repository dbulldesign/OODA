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
const { app, BrowserWindow, Tray, Menu, nativeImage, powerMonitor, ipcMain, screen, globalShortcut } = require('electron');
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
  hudAutoHideIdle: false,    // hide the HUD while you're away/idle
  hudTheme: 'dark',          // 'dark' | 'category' (tint the whole pill by category)
  hotkeys: false,            // enable global keyboard shortcuts
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
let hudExpanded = false, hudAnimating = false, hudTween = null;
let hudRest = null;              // the collapsed resting bounds (tracks user drags)
let hudMoving = false, hudMoveTimer = null, hudAnchorRight = false;
let hudCanExpand = false;        // renderer reports whether the label is actually truncated

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
// Force the newest web build: drop the service-worker + cache (keeps localStorage
// data) and hard-reload, so a stale cached UI updates immediately.
async function forceUpdateUI() {
  if (!win || win.isDestroyed()) { createWindow(); return; }
  try { await win.webContents.session.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] }); } catch (e) {}
  try { win.webContents.reloadIgnoringCache(); } catch (e) { try { win.webContents.reload(); } catch (e2) {} }
  showWindow();
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
    { label: 'Update UI to latest', click: forceUpdateUI },
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
    hudRest = hud.getBounds();
    // a user drag (not our own tween) updates the resting position; skip our tweens
    hud.on('move', () => {
      if (hudAnimating || !hud || hud.isDestroyed()) return;
      hudMoving = true; clearTimeout(hudMoveTimer);
      hudMoveTimer = setTimeout(() => {
        hudMoving = false;
        const b = hud.getBounds();
        // if dragged while expanded, keep the anchored edge so it collapses in place
        const x = hudExpanded ? (hudAnchorRight ? (b.x + b.width - hudRest.width) : b.x) : b.x;
        hudRest = { x, y: b.y, width: hudExpanded ? hudRest.width : b.width, height: hudExpanded ? hudRest.height : b.height };
        if (settings.hudRemember) { settings.hudX = hudRest.x; settings.hudY = hudRest.y; saveSettings(); }
      }, 300);
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
      theme: settings.hudTheme || 'dark',
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
  hudExpanded = false; hudRest = hud.getBounds();   // settings changed → new resting bounds
  applyHudVisibility();
  updateHud();
}
// whether the HUD should currently be visible (respects auto-hide-while-idle)
function hudShouldShow() {
  if (!settings.hudEnabled) return false;
  if (settings.hudAutoHideIdle && !paused && currentStatus === 'Idle / away') return false;
  return true;
}
function applyHudVisibility() {
  if (!hud || hud.isDestroyed()) return;
  if (hudShouldShow()) hud.showInactive(); else hud.hide();
}
// smoothly animate the HUD window between two bounds (time-based, eased, ~60fps)
function tweenHud(target, done) {
  if (!hud || hud.isDestroyed()) return;
  clearInterval(hudTween);
  const start = hud.getBounds(), t0 = Date.now(), dur = 200; hudAnimating = true;
  let last = null;
  hudTween = setInterval(() => {
    if (!hud || hud.isDestroyed()) { clearInterval(hudTween); hudAnimating = false; return; }
    const p = Math.min(1, (Date.now() - t0) / dur);
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;   // ease-in-out cubic
    const b = {
      x: Math.round(start.x + (target.x - start.x) * e), y: Math.round(start.y + (target.y - start.y) * e),
      width: Math.round(start.width + (target.width - start.width) * e), height: Math.round(start.height + (target.height - start.height) * e),
    };
    if (!last || b.x !== last.x || b.y !== last.y || b.width !== last.width || b.height !== last.height) { hud.setBounds(b); last = b; }
    if (p >= 1) { clearInterval(hudTween); hud.setBounds(target); hudAnimating = false; if (done) done(); }
  }, 1000 / 60);
}
// widen on hover to reveal the full title (only when there's more to show)
function hudDoExpand() {
  if (!hud || hud.isDestroyed() || !settings.hudEnabled || !hudRest) return;
  hudExpanded = true;
  try { hud.webContents.send('hud-expanded', true); } catch (e) {}
  const wa = screen.getPrimaryDisplay().workArea;
  const expW = Math.min(Math.round((settings.hudScale || 1) * 560), wa.width - 24);
  if (expW <= hudRest.width) { hudExpanded = false; return; }   // nothing to gain
  hudAnchorRight = (hudRest.x + hudRest.width / 2) > (wa.x + wa.width / 2);
  let x = hudAnchorRight ? (hudRest.x + hudRest.width - expW) : hudRest.x;
  x = Math.min(Math.max(x, wa.x), wa.x + wa.width - expW);
  tweenHud({ x, y: hudRest.y, width: expW, height: hudRest.height });
}
function hudDoCollapse() {
  hudExpanded = false;
  try { hud.webContents.send('hud-expanded', false); } catch (e) {}
  if (hudRest) tweenHud({ ...hudRest });
}

function toggleHud() {
  settings.hudEnabled = !settings.hudEnabled;
  saveSettings();
  applyHud();
  updateTray();
}

// Global keyboard shortcuts (opt-in). Registration can fail if another app
// already owns the combo — that's fine, we just skip it.
const HOTKEYS = [
  { accel: 'CommandOrControl+Shift+O', run: showWindow },       // open the OODA window
  { accel: 'CommandOrControl+Shift+H', run: toggleHud },        // show / hide the mini HUD
  { accel: 'CommandOrControl+Shift+P', run: togglePause },      // pause / resume capture
];
function registerHotkeys() {
  try { globalShortcut.unregisterAll(); } catch (e) {}
  if (!settings.hotkeys) return;
  for (const h of HOTKEYS) { try { globalShortcut.register(h.accel, h.run); } catch (e) {} }
}

// Apply all settings (HUD + launch-at-startup + hotkeys) and refresh the tray.
function applySettings() {
  applyHud();
  try { app.setLoginItemSettings({ openAtLogin: !!settings.launchAtStartup }); } catch (e) {}
  registerHotkeys();
  updateTray();
}

function openSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.show(); settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 430, height: 720, resizable: false, title: 'OODA host settings',
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
  applyHudVisibility();   // auto-hide/show as you go idle/active
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
  applyHudVisibility();
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
    // If OODA's own window is in front, log it under a FIXED label ("OODA") —
    // never its live title. Reading our own dynamic title back would feed a
    // runaway loop (OODA — OODA ⏺ OODA — …), so force a constant here.
    const own = w.owner && ((w.owner.path && process.execPath && w.owner.path.toLowerCase() === process.execPath.toLowerCase())
      || w.owner.processId === process.pid);
    const appName = own ? 'OODA' : ((w.owner && w.owner.name) || 'Unknown');
    let title = own ? '' : (w.title || '');
    if (title.length > 120) title = title.slice(0, 119) + '…';   // defensive cap
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
  ipcMain.on('hud-overflow', (_e, b) => { hudCanExpand = !!b; });   // is the label actually truncated?
  // detect hover over the HUD by cursor position (its drag region eats DOM mouse events)
  setInterval(() => {
    if (!hud || hud.isDestroyed() || !settings.hudEnabled || hudAnimating || hudMoving) return;
    let pt; try { pt = screen.getCursorScreenPoint(); } catch (e) { return; }
    const b = hud.getBounds();
    const inside = pt.x >= b.x && pt.x < b.x + b.width && pt.y >= b.y && pt.y < b.y + b.height;
    if (inside && !hudExpanded && hudCanExpand) hudDoExpand();       // only expand if there's more text
    else if (!inside && hudExpanded) hudDoCollapse();
  }, 200);
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

app.on('before-quit', () => { isQuitting = true; try { globalShortcut.unregisterAll(); } catch (e) {} });

// Keep running in the tray when the window is closed; quit only via the tray.
app.on('window-all-closed', () => {
  if (isQuitting && process.platform !== 'darwin') app.quit();
});
