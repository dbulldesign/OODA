/* transport.h — shared basics for the two links (USB serial + WiFi).
 *
 * Both links parse the same OODA state object into a PomoState and report a
 * common status, so the link manager can treat them uniformly and prefer USB.
 */
#pragma once
#include <Arduino.h>
#include "state.h"

enum LinkStatus {
  LINK_DOWN,       // no transport (WiFi not associated / USB host not attached)
  LINK_SEARCHING,  // transport up, but no OODA host talking yet
  LINK_ONLINE      // receiving state frames from the host
};

// Parse one OODA state object (raw JSON) into `out`, including the clock-skew
// offset from its `now` field. Returns false on malformed JSON. Shared by both
// links so the wire schema lives in exactly one place.
bool parseStateFrame(const char* json, PomoState& out);
