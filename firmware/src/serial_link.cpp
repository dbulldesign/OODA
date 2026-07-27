#include "serial_link.h"
#include "config.h"
#include "debug.h"
#include <ArduinoJson.h>

namespace {
  PomoState gState;
  String    gLine;
  uint32_t  gLastRx   = 0;      // last byte from the host
  uint32_t  gLastHello = 0;     // last HELLO we sent while searching
  bool      gSeenHost = false;  // received a hello/state since the port opened

  // Is the USB port usable? On a native USB-CDC chip the Serial bool reflects
  // DTR (a program has the port open); on a USB-serial bridge (Feather V2) it's
  // just "UART initialized" and is always true — which is fine, because on a
  // bridge we judge the link by whether host frames are actually arriving (see
  // status()), not by this flag. Recent inbound bytes also count as open.
  bool portOpen() { return (bool)HOST_SERIAL || (millis() - gLastRx < SERIAL_STALE_MS); }

  void handleLine(const String& line, bool& gotFrame) {
    if (line.length() == 0) return;

    if (line[0] == '{') {                       // JSON from the host
      // Peek at an optional "type" tag to route hello/ping vs. a state object.
      JsonDocument doc;
      if (deserializeJson(doc, line)) return;   // ignore malformed lines
      const char* type = doc["type"] | "";
      if (!strcmp(type, "hello")) { gSeenHost = true; return; }
      if (!strcmp(type, "ping"))  { gSeenHost = true; return; }
      // Otherwise it's a state object — reparse via the shared parser.
      if (parseStateFrame(line.c_str(), gState)) { gSeenHost = true; gotFrame = true; }
    }
    // (Host never sends anything else; non-JSON lines are ignored.)
  }
}

namespace slink {

void begin() {
  HOST_SERIAL.begin(HOST_SERIAL_BAUD);   // no-op baud for native USB-CDC
  gLine.reserve(512);
  gLastRx = millis();
}

bool loop() {
  bool gotFrame = false;

  if (!portOpen()) {                     // nobody has the port open
    gSeenHost = false;
    return false;
  }

  while (HOST_SERIAL.available()) {
    char c = (char)HOST_SERIAL.read();
    gLastRx = millis();
    if (c == '\r') continue;
    if (c == '\n') { handleLine(gLine, gotFrame); gLine = ""; }
    else if (gLine.length() < 512) gLine += c;
    else gLine = "";                     // runaway line → drop
  }

  // Announce ourselves whenever we're not actively receiving — on first connect
  // and again if the link drops — so the host's serial bridge replies and
  // (re)starts streaming state.
  if (status() != LINK_ONLINE && millis() - gLastHello > SERIAL_HELLO_MS) {
    HOST_SERIAL.print("HELLO\n");
    gLastHello = millis();
  }

  return gotFrame;
}

const PomoState& state() { return gState; }

LinkStatus status() {
  if (!portOpen()) return LINK_DOWN;
  if (gSeenHost && (millis() - gLastRx) < SERIAL_STALE_MS) return LINK_ONLINE;
  return LINK_SEARCHING;
}

bool command(const char* cmd) {
  if (!portOpen()) return false;
  if      (!strcmp(cmd, "start"))  HOST_SERIAL.print("START\n");
  else if (!strcmp(cmd, "stop"))   HOST_SERIAL.print("STOP\n");
  else if (!strcmp(cmd, "skip"))   HOST_SERIAL.print("SKIP\n");
  else if (!strcmp(cmd, "toggle")) HOST_SERIAL.print("TOGGLE\n");
  else return false;
  return true;
}

} // namespace slink
