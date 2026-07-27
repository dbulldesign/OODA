#include "link.h"
#include "serial_link.h"
#include "wifi_link.h"

namespace {
  PomoState  gState;
  LinkStatus gStatus = LINK_DOWN;
  LinkSource gSource = SRC_NONE;
}

namespace link {

void begin() {
  slink::begin();
  wlink::begin();
}

bool loop() {
  // Pump both links so each maintains its own connection independently.
  bool sGot = slink::loop();
  bool wGot = wlink::loop();

  LinkStatus s = slink::status();
  LinkStatus w = wlink::status();

  LinkSource newSource;
  LinkStatus newStatus;
  const PomoState* active = nullptr;
  bool got = false;

  if (s == LINK_ONLINE) {                 // USB wins whenever it's live
    newSource = SRC_USB; newStatus = LINK_ONLINE; active = &slink::state(); got = sGot;
  } else if (w == LINK_ONLINE) {          // otherwise fall through to WiFi
    newSource = SRC_WIFI; newStatus = LINK_ONLINE; active = &wlink::state(); got = wGot;
  } else {                                // neither online
    newSource = gSource;                  // keep showing the last driver
    newStatus = (s == LINK_SEARCHING || w == LINK_SEARCHING) ? LINK_SEARCHING : LINK_DOWN;
  }

  bool switched = (newSource != gSource) || (newStatus != gStatus);
  gSource = newSource;
  gStatus = newStatus;
  if (active) gState = *active;

  return got || switched;
}

const PomoState& state()   { return gState; }
LinkStatus status()        { return gStatus; }
LinkSource source()        { return gSource; }
const char* sourceText() {
  switch (gSource) { case SRC_USB: return "USB"; case SRC_WIFI: return "WiFi"; default: return ""; }
}

bool command(const char* cmd) {
  // Send over whichever link is driving; prefer USB if both happen to be up.
  if (slink::status() == LINK_ONLINE) return slink::command(cmd);
  if (wlink::status() == LINK_ONLINE) return wlink::command(cmd);
  // Nothing online — try USB first (cable is likely there), then WiFi.
  return slink::command(cmd) || wlink::command(cmd);
}

} // namespace link
