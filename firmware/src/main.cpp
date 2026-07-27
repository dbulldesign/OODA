/* OODA Pomodoro puck — firmware entry point.
 *
 * OODA (on the desktop host) is the source of truth for the timer. This puck:
 *   1. joins WiFi and confirms the host with GET /ping,
 *   2. subscribes to GET /events (SSE) and mirrors each state frame,
 *   3. shows the phase + a big countdown derived from the host clock,
 *   4. sends GET /pomodoro/{start,stop,skip} on the button, and
 *   5. chimes when the host reports a phase change.
 *
 * See firmware/README.md for the wire protocol and firmware/src/config.h.example
 * for the settings you fill in. All timing math trusts the host, never the
 * puck's own clock (see PomoState::remainingMs / net.cpp offset handling).
 */
#include <Arduino.h>
#include "config.h"
#include "state.h"
#include "net.h"
#include "display.h"
#include "controls.h"
#include "buzzer.h"

namespace {
  PomoState gState;

  // Phase-change tracking for the chime.
  Phase gLastPhase = PHASE_NONE;
  bool  gHaveLast  = false;

  // Idle knob "length preview" (stretch goal). OODA sets the real length in its
  // settings; the host has no per-start length yet, so this is a local preview
  // only — starting still just calls /pomodoro/start. Wire a host extension in
  // later to send this value.
  int  gPreviewMin    = PREVIEW_MIN_DEF;
  bool gPreviewActive = false;

  uint32_t gLastDraw = 0;

  void handleFrame() {
    Phase cur = gState.hasPomo ? gState.phase : PHASE_NONE;
    if (gHaveLast && cur != gLastPhase && cur != PHASE_NONE) {
      buzzer::chimePhase(cur);      // entered a new focus/break phase → chime
    }
    if (gState.hasPomo) gPreviewActive = false;   // running: drop the preview
    gLastPhase = cur;
    gHaveLast  = true;
  }

  void handleControls() {
    // Rotation → adjust idle length preview.
    int delta = controls::takeRotation();
    if (delta != 0 && !gState.hasPomo) {
      gPreviewActive = true;
      gPreviewMin += delta;
      if (gPreviewMin < PREVIEW_MIN_LO) gPreviewMin = PREVIEW_MIN_LO;
      if (gPreviewMin > PREVIEW_MIN_HI) gPreviewMin = PREVIEW_MIN_HI;
    }

    // Button.
    switch (controls::takePress()) {
      case controls::PRESS_SHORT:
        buzzer::beep();
        // We know the host's state, so map explicitly per the spec:
        // idle → start, running → stop.
        net::command(gState.hasPomo ? "stop" : "start");
        break;
      case controls::PRESS_LONG:
        buzzer::beep();
        net::command("skip");        // long-press → next phase (focus↔break)
        break;
      default:
        break;
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(50);
  Serial.println("\nOODA Pomodoro puck booting…");

  display::begin();
  display::splash("OODA", "puck");
  buzzer::begin();
  controls::begin();
  net::begin();
}

void loop() {
  // Pump each subsystem. Nothing here blocks.
  bool gotFrame = net::loop(gState);
  controls::loop();
  buzzer::loop();

  if (gotFrame) handleFrame();
  handleControls();

  // Redraw at ~10 Hz (so the local countdown ticks) or immediately on a frame.
  if (gotFrame || millis() - gLastDraw >= 100) {
    display::render(gState, net::status(), gPreviewActive ? gPreviewMin : 0);
    gLastDraw = millis();
  }
}
