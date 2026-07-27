#include "net.h"
#include "config.h"
#include <WiFi.h>
#include <WiFiClient.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

namespace {
  NetStatus       gStatus = NET_WIFI_DOWN;
  WiFiClient      gStream;               // raw socket for the SSE /events feed
  String          gLine;                 // current line being assembled
  String          gData;                 // accumulated `data:` payload for a frame
  bool            gHeaders = false;      // have we passed the HTTP response headers?

  uint32_t        gNextConnect = 0;      // when we may next (re)dial the stream
  uint32_t        gBackoff     = 1000;   // reconnect backoff, ms (grows to a cap)
  uint32_t        gLastRx      = 0;      // last time any byte arrived on the stream
  uint32_t        gWifiRetry   = 0;

  const uint32_t  BACKOFF_MAX  = 15000;
  const uint32_t  STREAM_STALE = 45000;  // no bytes (not even heartbeats) → dead

  // Build "?token=…" only when a token is configured.
  String tokenQuery() {
    if (strlen(OODA_TOKEN) == 0) return String("");
    return String("?token=") + OODA_TOKEN;
  }

  String baseUrl() {
    return String("http://") + OODA_HOST + ":" + OODA_PORT;
  }

  // One-shot GET; returns HTTP status code (or negative on transport error).
  int httpGet(const String& path, String* body = nullptr) {
    HTTPClient http;
    http.setConnectTimeout(2500);
    http.setTimeout(3000);
    if (!http.begin(baseUrl() + path)) return -1;
    if (strlen(OODA_TOKEN)) http.addHeader("X-OODA-Token", OODA_TOKEN);
    int code = http.GET();
    if (body && code > 0) *body = http.getString();
    http.end();
    return code;
  }

  // Confirm there's an OODA host at the configured address. /ping needs no auth.
  bool pingHost() {
    String body;
    int code = httpGet("/ping", &body);
    if (code != 200) return false;
    JsonDocument doc;
    if (deserializeJson(doc, body)) return false;
    return doc["ok"] == true && doc["name"] == "ooda-host";
  }

  // Parse one SSE data payload (raw JSON) into a PomoState.
  bool parseFrame(const String& json, PomoState& out) {
    JsonDocument doc;
    if (deserializeJson(doc, json)) return false;

    out.valid  = true;
    out.paused = doc["paused"] | false;
    out.todayMs = doc["todayMs"].as<int64_t>();
    strlcpy(out.status, doc["status"] | "", sizeof(out.status));

    JsonObject pomo = doc["pomo"];
    if (pomo.isNull()) {
      out.hasPomo = false;
      out.phase   = PHASE_NONE;
      out.endsAt  = 0;
      out.round   = 0;
    } else {
      out.hasPomo = true;
      out.phase   = phaseFromStr(pomo["phase"] | "");
      out.endsAt  = pomo["endsAt"].as<int64_t>();
      out.round   = pomo["round"] | 0;
    }

    // Clock-skew correction: offset = now - millis().  (README countdown math.)
    int64_t nowHost = doc["now"].as<int64_t>();
    if (nowHost > 0) out.offset = nowHost - (int64_t)millis();
    return true;
  }

  // Open the SSE stream. Non-blocking to read afterward; connect() itself is a
  // short blocking call bounded by the socket timeout.
  bool openStream() {
    gStream.stop();
    gLine = ""; gData = ""; gHeaders = false;
    if (!gStream.connect(OODA_HOST, OODA_PORT, 3000)) return false;

    String req = String("GET /events") + tokenQuery() + " HTTP/1.1\r\n" +
                 "Host: " + OODA_HOST + "\r\n" +
                 "Accept: text/event-stream\r\n" +
                 "Cache-Control: no-cache\r\n";
    if (strlen(OODA_TOKEN)) req += String("X-OODA-Token: ") + OODA_TOKEN + "\r\n";
    req += "Connection: keep-alive\r\n\r\n";
    gStream.print(req);
    gStream.setNoDelay(true);
    gLastRx = millis();
    return true;
  }

  // Handle a completed SSE line. Returns true (via *frameOut) when a blank line
  // ends a frame and its data parsed successfully.
  bool onLine(const String& line, PomoState& out, bool& gotFrame) {
    // Response status line: "HTTP/1.1 200 OK". A non-200 means auth failed etc.
    if (!gHeaders) {
      if (line.startsWith("HTTP/")) {
        if (line.indexOf(" 200") < 0) { gStream.stop(); return false; }
      } else if (line.length() == 0) {
        gHeaders = true;                 // blank line ends the HTTP headers
      }
      return true;
    }

    if (line.length() == 0) {            // blank line → dispatch the frame
      if (gData.length()) {
        PomoState next = out;            // start from current (keeps offset etc.)
        if (parseFrame(gData, next)) { out = next; gotFrame = true; }
      }
      gData = "";
      return true;
    }
    if (line.startsWith(":")) return true;             // comment / heartbeat
    if (line.startsWith("data:")) {
      int i = 5;
      if (i < (int)line.length() && line[i] == ' ') i++;  // optional space
      gData += line.substring(i);
    }
    // `retry:` / `event:` / `id:` fields are ignored — the host only sends data.
    return true;
  }

  // Drain available bytes; assemble lines; dispatch frames. Non-blocking.
  bool pumpStream(PomoState& out) {
    bool gotFrame = false;
    while (gStream.available()) {
      char c = (char)gStream.read();
      gLastRx = millis();
      if (c == '\r') continue;
      if (c == '\n') { onLine(gLine, out, gotFrame); gLine = ""; }
      else if (gLine.length() < 1024) gLine += c;      // guard against runaways
      else gLine = "";                                  // oversized line → drop
    }
    return gotFrame;
  }
}

namespace net {

void begin() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  gStatus = NET_WIFI_DOWN;
  gWifiRetry = millis();
}

bool loop(PomoState& out) {
  // ── WiFi ──────────────────────────────────────────────────────────────────
  if (WiFi.status() != WL_CONNECTED) {
    gStatus = NET_WIFI_DOWN;
    if (gStream.connected()) gStream.stop();
    if (millis() - gWifiRetry > 5000) {   // nudge a stalled association
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      gWifiRetry = millis();
    }
    return false;
  }

  // ── SSE stream ──────────────────────────────────────────────────────────────
  if (gStream.connected()) {
    bool got = pumpStream(out);
    if (!gStream.connected()) {
      // Stream ended during this pump — a non-200 response (e.g. 401 bad token)
      // or the host closing the socket. Back off before redialing so a
      // misconfigured token doesn't hammer the host.
      gStatus = NET_OFFLINE;
      gBackoff = min(gBackoff * 2, BACKOFF_MAX);
      gNextConnect = millis() + gBackoff;
      return got;
    }
    if (got) { gStatus = NET_ONLINE; gBackoff = 1000; }
    // Watchdog: the host sends `: ping` heartbeats every 20s. Silence for far
    // longer than that means a half-open socket — drop it and reconnect.
    if (millis() - gLastRx > STREAM_STALE) {
      gStream.stop();
      gStatus = NET_OFFLINE;
      gBackoff = min(gBackoff * 2, BACKOFF_MAX);
      gNextConnect = millis() + gBackoff;
    }
    return got;
  }

  // Not connected: reconnect on the backoff schedule.
  if (gStatus == NET_ONLINE) gStatus = NET_SEARCHING;
  if ((int32_t)(millis() - gNextConnect) < 0) return false;

  if (!pingHost()) {
    gStatus = NET_OFFLINE;
    gBackoff = min(gBackoff * 2, BACKOFF_MAX);
    gNextConnect = millis() + gBackoff;
    return false;
  }
  gStatus = NET_SEARCHING;               // host answered; now open the stream
  if (openStream()) {
    gStatus = NET_ONLINE;
    gBackoff = 1000;
  } else {
    gStatus = NET_OFFLINE;
    gBackoff = min(gBackoff * 2, BACKOFF_MAX);
    gNextConnect = millis() + gBackoff;
  }
  return false;
}

NetStatus status() { return gStatus; }

const char* statusText() {
  switch (gStatus) {
    case NET_WIFI_DOWN: return "no wifi";
    case NET_SEARCHING: return "searching";
    case NET_ONLINE:    return "connected";
    default:            return "offline";
  }
}

bool command(const char* cmd) {
  if (WiFi.status() != WL_CONNECTED) return false;
  int code = httpGet(String("/pomodoro/") + cmd + tokenQuery());
  return code >= 200 && code < 300;
}

} // namespace net
