/* serial_link — the USB-C link to the OODA host (PRIMARY).
 *
 * Native USB-CDC on the ESP32-S3. Line protocol (newline-delimited):
 *
 *   puck → host :  HELLO | START | STOP | SKIP | TOGGLE
 *   host → puck :  {"type":"hello",...} | {"type":"ping"} | { …state object… }
 *
 * No token: a USB cable is physically local, so it's trusted the same way the
 * host trusts loopback. The link keeps its own last-known PomoState; loop()
 * returns true whenever a fresh state frame arrived.
 */
#pragma once
#include <Arduino.h>
#include "transport.h"

namespace slink {
  void begin();
  bool loop();                 // true if a fresh state frame parsed this pass
  const PomoState& state();
  LinkStatus status();
  bool command(const char* cmd);   // "start" | "stop" | "skip" | "toggle"
}
