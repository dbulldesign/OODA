/* OODA desktop host — main process.
   Wraps the OODA web app in an Electron window and feeds it real
   computer-activity events (the foreground app + its window title, and
   away/idle state) through the window.activity bridge the app already
   consumes. Nothing here talks to the network; it only observes the
   local desktop and forwards events into the page.

   Foreground app/title come from `get-windows` (a small native addon).
   Idle time comes from Electron's built-in powerMonitor — no extra
   native dependency, cross-platform. */
const { app, BrowserWindow, powerMonitor } = require('electron');
const path = require('path');

const IDLE_SECONDS = 60;    // match the app's Idle Detection threshold
const POLL_MS = 4000;       // how often to sample the foreground window

let win = null;
let lastKey = null;         // last app|title we forwarded (dedupe → one segment per switch)
let lastIdle = false;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 820,
    backgroundColor: '#1F2A2C',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // OODA_URL points at a deployed build; otherwise load the local app — from the
  // packaged resources when built, or the sibling index.html in development.
  if (process.env.OODA_URL) {
    win.loadURL(process.env.OODA_URL);
  } else {
    const local = app.isPackaged
      ? path.join(process.resourcesPath, 'app-web', 'index.html')
      : path.join(__dirname, '..', 'index.html');
    win.loadFile(local);
  }
}

function send(data) {
  if (win && !win.isDestroyed()) win.webContents.send('activity-event', data);
}

async function poll() {
  if (!win || win.isDestroyed()) return;
  try {
    const idle = powerMonitor.getSystemIdleTime() >= IDLE_SECONDS;
    if (idle) {
      if (!lastIdle) { send({ idle: true }); lastIdle = true; lastKey = null; }
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
    }
  } catch (e) {
    // Missing OS permission (macOS: Screen Recording for titles / Accessibility)
    // or an unsupported platform — skip this tick rather than crash.
  }
}

app.whenReady().then(() => {
  createWindow();
  setInterval(poll, POLL_MS);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
