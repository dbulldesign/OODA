/* link — the transport manager.
 *
 * Runs both links every pass and presents a single view to the rest of the
 * firmware. USB is PREFERRED: whenever the USB link is online its state and
 * commands win; the moment it goes quiet we fall through to WiFi automatically,
 * and back to USB as soon as it returns. WiFi is kept warm in the background so
 * failover is seamless.
 */
#pragma once
#include <Arduino.h>
#include "transport.h"

enum LinkSource { SRC_NONE, SRC_USB, SRC_WIFI };

namespace link {
  void begin();
  bool loop();                 // true if the displayed state changed this pass

  const PomoState& state();
  LinkStatus  status();        // status of the active (or preferred) link
  LinkSource  source();        // which link is currently driving the display
  const char* sourceText();    // "USB" | "WiFi" | ""

  bool command(const char* cmd);   // routed to the active link
}
