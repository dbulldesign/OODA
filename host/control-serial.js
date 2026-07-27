/* OODA host — USB serial control bridge.

   The companion to control.js. Where control.js exposes the Pomodoro over
   HTTP + SSE (for a WiFi puck, a Stream Deck, a script), this bridges the same
   controls over a plain USB serial link — for a puck plugged straight into the
   machine over USB-C. The puck treats USB as its primary link and WiFi as a
   fallback, so this is what it talks to most of the time.

   Trust model mirrors control.js: a USB cable is physically local, so no token
   is required (the same way loopback HTTP needs none).

   Wire protocol (newline-delimited, mirrors the SSE frames):
     puck → host :  HELLO | START | STOP | SKIP | TOGGLE
     host → puck :  {"type":"hello",name,version} | {"type":"ping"} | {…state…}

   Dependency: 'serialport' is an OPTIONAL dependency. If it isn't installed the
   bridge stays dormant (available() === false) and nothing else is affected.

   The main process supplies the same callbacks control.js uses:
     getState()      -> the current Pomodoro/activity state object
     onCommand(cmd)  -> Promise, runs 'start'|'stop'|'skip'|'toggle'
*/
let SerialPortMod = null;
try { SerialPortMod = require('serialport'); } catch (e) { SerialPortMod = null; }

const COMMANDS = { START: 'start', STOP: 'stop', SKIP: 'skip', TOGGLE: 'toggle' };
// USB vendor IDs to auto-detect an ESP32 puck:
//   303a Espressif (native USB, e.g. ESP32-S3)   239a Adafruit
//   10c4 Silicon Labs CP210x (ESP32 Feather V2)  1a86 WCH CH340
const KNOWN_VIDS = ['303a', '239a', '10c4', '1a86'];

function createSerialControl({ getState, onCommand, version, log }) {
  let port = null;
  let rescan = null;
  let heartbeat = null;
  let buf = '';
  let cfg = { path: '', baud: 115200 };
  let running = false;
  const say = (m) => { try { if (log) log(m); } catch (e) {} };

  function safeState() { try { return getState() || {}; } catch (e) { return {}; } }

  function write(obj) {
    if (!port || !port.isOpen) return;
    try { port.write((typeof obj === 'string' ? obj : JSON.stringify(obj)) + '\n'); } catch (e) {}
  }
  function broadcast(state) { write(state || safeState()); }

  // Choose a serial device: an explicitly configured path wins, else the first
  // port whose USB vendor id looks like an ESP32-S3 / Adafruit board.
  async function pickPath() {
    if (cfg.path) return cfg.path;
    try {
      const ports = await SerialPortMod.SerialPort.list();
      const hit = ports.find(p => p.vendorId && KNOWN_VIDS.includes(String(p.vendorId).toLowerCase()));
      return hit ? hit.path : '';
    } catch (e) { return ''; }
  }

  function handleLine(line) {
    const up = line.trim().toUpperCase();
    if (!up) return;
    if (up === 'HELLO') {
      write({ type: 'hello', name: 'ooda-host', version: version || '' });
      broadcast(safeState());              // start the puck off with a full frame
      return;
    }
    const cmd = COMMANDS[up];
    if (cmd) Promise.resolve().then(() => onCommand(cmd)).catch(() => {});
  }

  function onData(chunk) {
    buf += chunk.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      handleLine(line);
    }
    if (buf.length > 4096) buf = '';         // guard against a wedged stream
  }

  async function tryOpen() {
    if (!SerialPortMod || port) return;
    const path = await pickPath();
    if (!path) return;                       // no device yet — rescan will retry
    try {
      port = new SerialPortMod.SerialPort({ path, baudRate: cfg.baud || 115200, autoOpen: false });
      port.on('data', onData);
      port.on('close', () => { port = null; buf = ''; });
      port.on('error', () => { try { if (port) port.close(); } catch (e) {} port = null; buf = ''; });
      port.open((err) => {
        if (err) { say('serial open failed: ' + (err.message || err)); port = null; return; }
        // Deassert DTR/RTS so a board with an auto-reset circuit (CP2102 on the
        // Feather V2) isn't held in reset/bootloader while we hold the port.
        try { port.set({ dtr: false, rts: false }, () => {}); } catch (e) {}
        say('USB puck on ' + path);
        broadcast(safeState());
      });
    } catch (e) { say('serial error: ' + e); port = null; }
  }

  function start(next) {
    stop();
    cfg = { path: '', baud: 115200, ...(next || {}) };
    if (!SerialPortMod) { say('serialport not installed — USB bridge disabled'); return; }
    running = true;
    tryOpen();
    rescan = setInterval(() => { if (running && !port) tryOpen(); }, 3000);
    heartbeat = setInterval(() => write({ type: 'ping' }), 20000);
  }
  function stop() {
    running = false;
    if (rescan) { clearInterval(rescan); rescan = null; }
    if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
    if (port) { try { port.close(); } catch (e) {} port = null; }
    buf = '';
  }

  function isRunning() { return running && !!SerialPortMod; }
  function available() { return !!SerialPortMod; }

  return { start, stop, running: isRunning, broadcast, available };
}

module.exports = { createSerialControl };
