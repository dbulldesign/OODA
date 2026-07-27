/* wifi_link — the WiFi link to the OODA host (FALLBACK).
 *
 * Same behavior as the original firmware: GET /ping to discover the host, a raw
 * WiFiClient reading the SSE /events stream line-by-line, and one-shot GETs for
 * /pomodoro/{start,stop,skip,toggle}. Reconnects with backoff; never blocks.
 *
 * Disabled entirely when WIFI_SSID is empty (a USB-only puck). Keeps its own
 * last-known PomoState; loop() returns true when a fresh frame arrived.
 */
#pragma once
#include <Arduino.h>
#include "transport.h"

namespace wlink {
  void begin();
  bool loop();                 // true if a fresh state frame parsed this pass
  const PomoState& state();
  LinkStatus status();
  bool command(const char* cmd);   // "start" | "stop" | "skip" | "toggle"
}
