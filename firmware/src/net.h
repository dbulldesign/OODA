/* Net — everything that talks to the OODA host.
 *
 *   - WiFi connect / reconnect
 *   - GET /ping                     (discovery; confirms we found an OODA host)
 *   - GET /events                   (SSE stream, parsed line-by-line, non-blocking)
 *   - GET /pomodoro/{start,stop,skip,toggle}
 *
 * The SSE reader never blocks: net::loop() drains whatever bytes are available
 * each pass and dispatches a frame when it sees the blank line that ends one.
 * If the socket drops or the host is unreachable it reconnects with backoff and
 * reports status via net::status() so the display can show searching/offline.
 */
#pragma once
#include <Arduino.h>
#include "state.h"

enum NetStatus {
  NET_WIFI_DOWN,   // not associated with an AP
  NET_SEARCHING,   // WiFi up, looking for / not yet streaming from the host
  NET_ONLINE,      // SSE stream is open and delivering frames
  NET_OFFLINE      // host was reachable-ish but the stream keeps failing
};

namespace net {
  // Called once from setup(). Kicks off WiFi; does not block on it.
  void begin();

  // Called every loop(). Pumps WiFi state, the SSE reader, and reconnects.
  // Returns true if a fresh frame was parsed into `out` this pass.
  bool loop(PomoState& out);

  NetStatus status();
  const char* statusText();

  // Fire a Pomodoro command. Non-blocking-ish (one short HTTP GET). Returns
  // true if the host answered 2xx.
  bool command(const char* cmd);   // "start" | "stop" | "skip" | "toggle"
}
