#include "wifi_link.h"
#include "config.h"
#include <WiFi.h>
#include <WiFiClient.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

namespace {
  const bool      ENABLED = (sizeof(WIFI_SSID) > 1);   // "" → disabled at compile time

  PomoState       gState;
  LinkStatus      gStatus = LINK_DOWN;
  WiFiClient      gStream;                 // raw socket for the SSE /events feed
  String          gLine;                   // current line being assembled
  String          gData;                   // accumulated `data:` payload for a frame
  bool            gHeaders = false;         // passed the HTTP response headers yet?

  uint32_t        gNextConnect = 0;
  uint32_t        gBackoff     = 1000;
  uint32_t        gLastRx      = 0;
  uint32_t        gWifiRetry   = 0;

  const uint32_t  BACKOFF_MAX  = 15000;
  const uint32_t  STREAM_STALE = 45000;    // heartbeats come every 20s; silence → dead

  String tokenQuery() {
    if (strlen(OODA_TOKEN) == 0) return String("");
    return String("?token=") + OODA_TOKEN;
  }
  String baseUrl() { return String("http://") + OODA_HOST + ":" + OODA_PORT; }

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

  bool pingHost() {
    String body;
    if (httpGet("/ping", &body) != 200) return false;
    JsonDocument doc;
    if (deserializeJson(doc, body)) return false;
    return doc["ok"] == true && doc["name"] == "ooda-host";
  }

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

  void onLine(const String& line, bool& gotFrame) {
    if (!gHeaders) {
      if (line.startsWith("HTTP/")) {
        if (line.indexOf(" 200") < 0) { gStream.stop(); return; }
      } else if (line.length() == 0) {
        gHeaders = true;
      }
      return;
    }
    if (line.length() == 0) {                    // blank line → dispatch frame
      if (gData.length() && parseStateFrame(gData.c_str(), gState)) gotFrame = true;
      gData = "";
      return;
    }
    if (line.startsWith(":")) return;            // comment / heartbeat
    if (line.startsWith("data:")) {
      int i = 5;
      if (i < (int)line.length() && line[i] == ' ') i++;
      gData += line.substring(i);
    }
  }

  bool pumpStream() {
    bool gotFrame = false;
    while (gStream.available()) {
      char c = (char)gStream.read();
      gLastRx = millis();
      if (c == '\r') continue;
      if (c == '\n') { onLine(gLine, gotFrame); gLine = ""; }
      else if (gLine.length() < 1024) gLine += c;
      else gLine = "";
    }
    return gotFrame;
  }
}

namespace wlink {

void begin() {
  if (!ENABLED) { gStatus = LINK_DOWN; return; }
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  gStatus = LINK_DOWN;
  gWifiRetry = millis();
}

bool wlink_loop_impl() {
  if (!ENABLED) return false;

  if (WiFi.status() != WL_CONNECTED) {
    gStatus = LINK_DOWN;
    if (gStream.connected()) gStream.stop();
    if (millis() - gWifiRetry > 5000) {
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      gWifiRetry = millis();
    }
    return false;
  }

  if (gStream.connected()) {
    bool got = pumpStream();
    if (!gStream.connected()) {                 // stream ended mid-pump (401 / close)
      gStatus = LINK_SEARCHING;
      gBackoff = min(gBackoff * 2, BACKOFF_MAX);
      gNextConnect = millis() + gBackoff;
      return got;
    }
    if (got) { gStatus = LINK_ONLINE; gBackoff = 1000; }
    if (millis() - gLastRx > STREAM_STALE) {
      gStream.stop();
      gStatus = LINK_SEARCHING;
      gBackoff = min(gBackoff * 2, BACKOFF_MAX);
      gNextConnect = millis() + gBackoff;
    }
    return got;
  }

  if (gStatus == LINK_ONLINE) gStatus = LINK_SEARCHING;
  if ((int32_t)(millis() - gNextConnect) < 0) return false;

  if (!pingHost()) {
    gStatus = LINK_SEARCHING;
    gBackoff = min(gBackoff * 2, BACKOFF_MAX);
    gNextConnect = millis() + gBackoff;
    return false;
  }
  if (openStream()) { gStatus = LINK_ONLINE; gBackoff = 1000; }
  else {
    gStatus = LINK_SEARCHING;
    gBackoff = min(gBackoff * 2, BACKOFF_MAX);
    gNextConnect = millis() + gBackoff;
  }
  return false;
}

bool loop() { return wlink_loop_impl(); }

const PomoState& state() { return gState; }
LinkStatus status() { return gStatus; }

bool command(const char* cmd) {
  if (!ENABLED || WiFi.status() != WL_CONNECTED) return false;
  int code = httpGet(String("/pomodoro/") + cmd + tokenQuery());
  return code >= 200 && code < 300;
}

} // namespace wlink
