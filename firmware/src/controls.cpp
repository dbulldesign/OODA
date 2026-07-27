#include "controls.h"
#include "config.h"
#include "debug.h"
#include <Wire.h>
#include <Adafruit_seesaw.h>

namespace {
  Adafruit_seesaw ss;
  bool     gReady    = false;
  int32_t  gLastPos  = 0;
  int      gRotAccum = 0;       // detents not yet taken

  // Button debounce + short/long-press detection (seesaw switch is active-low).
  bool     gStable   = true;    // debounced level (true = released)
  bool     gRaw      = true;
  uint32_t gEdgeAt   = 0;
  uint32_t gDownAt   = 0;
  bool     gLongSent = false;
  controls::Press gPending = controls::PRESS_NONE;

  uint32_t gLastPoll = 0;
  const uint32_t POLL_MS     = 5;    // I²C poll cadence
  const uint32_t DEBOUNCE_MS = 25;
}

namespace controls {

void begin() {
  // The encoder owns the I²C bus now (the display moved to SPI). Enable the
  // Feather's STEMMA QT power rail, then start Wire. Guarded so it compiles on
  // boards without the power-pin macro.
#if defined(NEOPIXEL_I2C_POWER)
  pinMode(NEOPIXEL_I2C_POWER, OUTPUT); digitalWrite(NEOPIXEL_I2C_POWER, HIGH);
#endif
#if defined(PIN_I2C_POWER)
  pinMode(PIN_I2C_POWER, OUTPUT); digitalWrite(PIN_I2C_POWER, HIGH);
#endif
  delay(10);
  Wire.begin();

  gReady = ss.begin(SEESAW_ADDR);
  if (!gReady) { LOG("seesaw encoder not found at 0x%02X\n", SEESAW_ADDR); return; }
  ss.pinMode(SEESAW_SWITCH, INPUT_PULLUP);
  gLastPos = ss.getEncoderPosition();
  gStable = gRaw = true;
}

void loop() {
  if (!gReady) return;
  if (millis() - gLastPoll < POLL_MS) return;
  gLastPoll = millis();

  // ── rotation ────────────────────────────────────────────────────────────────
  int32_t pos = ss.getEncoderPosition();
  int32_t d = pos - gLastPos;
  if (d != 0) {
    gLastPos = pos;
#if ENC_INVERT
    d = -d;
#endif
    gRotAccum += (int)d;
  }

  // ── button (active-low through the seesaw) ───────────────────────────────────
  bool level = ss.digitalRead(SEESAW_SWITCH);   // true = released, false = pressed
  if (level != gRaw) { gRaw = level; gEdgeAt = millis(); }

  if (level != gStable && (millis() - gEdgeAt) > DEBOUNCE_MS) {
    gStable = level;
    if (!gStable) {                    // pressed
      gDownAt = millis();
      gLongSent = false;
    } else {                           // released
      if (!gLongSent) gPending = PRESS_SHORT;
    }
  }

  // Fire the long-press as soon as the hold threshold passes (responsive feel).
  if (!gStable && !gLongSent && (millis() - gDownAt) >= LONG_PRESS_MS) {
    gLongSent = true;
    gPending  = PRESS_LONG;
  }
}

bool ready() { return gReady; }

int takeRotation() {
  int d = gRotAccum;
  gRotAccum = 0;
  return d;
}

Press takePress() {
  Press p = gPending;
  gPending = PRESS_NONE;
  return p;
}

} // namespace controls
