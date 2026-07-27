/* OODA host — local control server.

   A tiny HTTP + Server-Sent-Events endpoint that lets an external device (a
   DIY ESP32 puck, a Stream Deck, a Flic button, a shell script, …) drive the
   Pomodoro and read its live state. It is the bridge a physical timer plugs
   into: commands come in over HTTP, state goes out over an SSE stream.

   Design notes:
   - No third-party dependencies — Node's built-in `http` only. SSE (a plain
     text/event-stream) is trivial to parse on an ESP32, and commands are
     simple GET/POST requests, so the firmware side stays tiny too.
   - Off by default. When on, it binds to loopback (127.0.0.1) so only this PC
     can reach it. "Allow LAN devices" switches the bind to 0.0.0.0 for a
     WiFi puck on the same network — and then a shared token is required.
   - Loopback requests never need the token (they're already local); remote
     requests always do.

   The main process supplies two callbacks:
     getState()      -> a plain object describing the current Pomodoro/activity
     onCommand(cmd)  -> Promise, runs 'start'|'stop'|'skip'|'toggle'
*/
const http = require('http');

const COMMANDS = ['start', 'stop', 'skip', 'toggle'];

function createControlServer({ getState, onCommand, version, log }) {
  let server = null;
  let clients = new Set();        // open SSE responses
  let heartbeat = null;
  let cfg = { port: 7420, lan: false, token: '' };
  const say = (m) => { try { if (log) log(m); } catch (e) {} };

  function isLoopback(req) {
    const a = (req.socket && req.socket.remoteAddress) || '';
    return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
  }
  function authorized(req, url) {
    if (isLoopback(req)) return true;               // local requests are trusted
    if (!cfg.token) return false;                   // remote requires a token to be set
    const t = req.headers['x-ooda-token'] || url.searchParams.get('token') || '';
    return t === cfg.token;
  }
  function sendJson(res, code, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(code, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'x-ooda-token, content-type',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  }

  function handle(req, res) {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch (e) { return sendJson(res, 400, { error: 'bad-url' }); }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'x-ooda-token, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      });
      return res.end();
    }
    const p = url.pathname.replace(/\/+$/, '') || '/';

    // unauthenticated discovery ping — lets a device confirm it found an OODA host
    if (p === '/ping') return sendJson(res, 200, { ok: true, name: 'ooda-host', version: version || '' });

    if (!authorized(req, url)) return sendJson(res, 401, { error: 'unauthorized' });

    if (p === '/' || p === '/state') return sendJson(res, 200, safeState());

    if (p === '/events') return startStream(req, res);

    const m = p.match(/^\/pomodoro\/(\w+)$/);
    if (m && COMMANDS.includes(m[1])) {
      Promise.resolve().then(() => onCommand(m[1])).catch(() => {});
      // state will change a beat later; return the pre-command state immediately
      return sendJson(res, 200, { ok: true, command: m[1] });
    }

    return sendJson(res, 404, { error: 'not-found', endpoints: ['/ping', '/state', '/events', '/pomodoro/{start,stop,skip,toggle}'] });
  }

  function safeState() {
    try { return getState() || {}; } catch (e) { return {}; }
  }

  function startStream(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('retry: 3000\n');
    res.write('data: ' + JSON.stringify(safeState()) + '\n\n');
    clients.add(res);
    req.on('close', () => { clients.delete(res); });
  }

  function broadcast(state) {
    if (!clients.size) return;
    const line = 'data: ' + JSON.stringify(state || safeState()) + '\n\n';
    for (const res of clients) { try { res.write(line); } catch (e) { clients.delete(res); } }
  }

  function start(next) {
    stop();                                   // idempotent: always start clean
    cfg = { port: 7420, lan: false, token: '', ...(next || {}) };
    const host = cfg.lan ? '0.0.0.0' : '127.0.0.1';
    try {
      server = http.createServer(handle);
      server.on('error', (e) => { say('control server error: ' + (e && e.code || e)); server = null; });
      server.listen(cfg.port, host, () => { say('control server on ' + host + ':' + cfg.port + (cfg.lan ? ' (LAN)' : ' (local)')); });
      heartbeat = setInterval(() => { for (const res of clients) { try { res.write(': ping\n\n'); } catch (e) { clients.delete(res); } } }, 20000);
    } catch (e) { say('control server failed: ' + e); server = null; }
  }
  function stop() {
    if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
    for (const res of clients) { try { res.end(); } catch (e) {} }
    clients.clear();
    if (server) { try { server.close(); } catch (e) {} server = null; }
  }
  function running() { return !!server; }

  return { start, stop, running, broadcast };
}

module.exports = { createControlServer };
