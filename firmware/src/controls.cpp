#include "controls.h"
#include "config.h"
#include <ESP32Encoder.h>

namespace {
  ESP32Encoder gEnc;
  int64_t      gLastCount = 0;

  // Button debounce + short/long-press detection.
  bool     gStable   = true;    // debounced level (HIGH = released, pull-up)
  bool     gRaw      = true;
  uint32_t gEdgeAt   = 0;       // last raw change time
  uint32_t gDownAt   = 0;       // when the current press began
  bool     gLongSent = false;   // long-press already emitted for this hold
  controls::Press gPending = controls::PRESS_NONE;

  const uint32_t DEBOUNCE_MS = 25;
}

namespace controls {

void begin() {
  ESP32Encoder::useInternalWeakPullResistors = puType::up;
  gEnc.attachHalfQuad(PIN_ENC_CLK, PIN_ENC_DT);
  gEnc.clearCount();
  gLastCount = 0;

  pinMode(PIN_ENC_SW, INPUT_PULLUP);
  gStable = gRaw = digitalRead(PIN_ENC_SW);
}

void loop() {
  // ── button ──────────────────────────────────────────────────────────────────
  bool level = digitalRead(PIN_ENC_SW);
  if (level != gRaw) { gRaw = level; gEdgeAt = millis(); }

  if (level != gStable && (millis() - gEdgeAt) > DEBOUNCE_MS) {
    gStable = level;
    if (gStable == LOW) {                 // pressed (active-low)
      gDownAt = millis();
      gLongSent = false;
    } else {                              // released
      if (!gLongSent) gPending = PRESS_SHORT;   // long already fired on hold?
    }
  }

  // Emit the long-press as soon as the hold threshold is crossed, so a held
  // button feels responsive instead of waiting for release.
  if (gStable == LOW && !gLongSent && (millis() - gDownAt) >= LONG_PRESS_MS) {
    gLongSent = true;
    gPending  = PRESS_LONG;
  }
}

int takeRotation() {
  int64_t c = gEnc.getCount() / 2;        // halfQuad → 2 counts per detent
  int delta = (int)(c - gLastCount);
  gLastCount = c;
  return delta;
}

Press takePress() {
  Press p = gPending;
  gPending = PRESS_NONE;
  return p;
}

} // namespace controls
