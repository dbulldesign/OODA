/* OODA Pomodoro puck — firmware entry point.
 *
 * OODA (on the desktop host) is the source of truth for the timer. This puck is
 * a remote face for it:
 *   1. talks to the host over USB-C (native USB-CDC serial) as the PRIMARY link,
 *      and falls back to WiFi automatically when USB is quiet,
 *   2. mirrors each state frame, deriving the countdown from the host clock,
 *   3. sends start/stop/skip from the one knob, and
 *   4. chimes when the host reports a phase change.
 *
 * See firmware/README.md for the wire protocol, firmware/BUILD.md for the
 * Adafruit parts + wiring, and firmware/src/config.h.example for the settings.
 */
#include <Arduino.h>
#include "config.h"
#include "debug.h"
#include "state.h"
#include "link.h"
#include "display.h"
#include "controls.h"
#include "buzzer.h"

namespace {
  Phase gLastPhase = PHASE_NONE;
  bool  gHaveLast  = false;

  // Idle knob "length preview" (stretch goal). OODA sets the real length; there
  // is no per-start length on the host yet, so this is a local preview only —
  // starting still just sends "start". Send gPreviewMin along once the host and
  // its serial/HTTP protocol gain a length parameter.
  int  gPreviewMin    = PREVIEW_MIN_DEF;
  bool gPreviewActive = false;

  uint32_t gLastDraw = 0;

  void handleFrame() {
    const PomoState& st = link::state();
    Phase cur = st.hasPomo ? st.phase : PHASE_NONE;
    if (gHaveLast && cur != gLastPhase && cur != PHASE_NONE) buzzer::chimePhase(cur);
    if (st.hasPomo) gPreviewActive = false;
    gLastPhase = cur;
    gHaveLast  = true;
  }

  void handleControls() {
    int delta = controls::takeRotation();
    if (delta != 0 && !link::state().hasPomo) {
      gPreviewActive = true;
      gPreviewMin += delta;
      if (gPreviewMin < PREVIEW_MIN_LO) gPreviewMin = PREVIEW_MIN_LO;
      if (gPreviewMin > PREVIEW_MIN_HI) gPreviewMin = PREVIEW_MIN_HI;
    }

    switch (controls::takePress()) {
      case controls::PRESS_SHORT:
        buzzer::beep();
        link::command(link::state().hasPomo ? "stop" : "start");   // idle→start, running→stop
        break;
      case controls::PRESS_LONG:
        buzzer::beep();
        link::command("skip");                                     // long-press → next phase
        break;
      default: break;
    }
  }
}

void setup() {
  LOG_BEGIN();
  LOG("\nOODA Pomodoro puck booting...\n");

  display::begin();                 // starts the shared I²C bus
  display::splash("OODA", "puck");
  buzzer::begin();
  controls::begin();                // seesaw encoder shares that I²C bus
  link::begin();                    // USB (primary) + WiFi (fallback)
}

void loop() {
  bool changed = link::loop();
  controls::loop();
  buzzer::loop();

  if (changed) handleFrame();
  handleControls();

  // Redraw at ~10 Hz (so the local countdown ticks) or immediately on a change.
  if (changed || millis() - gLastDraw >= 100) {
    display::render(link::state(), link::sourceText(), link::status(),
                    gPreviewActive ? gPreviewMin : 0);
    gLastDraw = millis();
  }
}
