/* Buzzer — non-blocking on/off buzzes.
 *
 * Drives the pin HIGH/LOW in short patterns — no tones or melodies. This suits
 * an ACTIVE buzzer (Adafruit #1536: self-oscillating, buzzes whenever powered)
 * or a vibration motor; a passive piezo won't sound on plain DC. buzzer::loop()
 * steps through the active pattern without ever blocking, so the countdown keeps
 * ticking while it buzzes.
 */
#pragma once
#include <Arduino.h>
#include "state.h"

namespace buzzer {
  void begin();
  void loop();                 // call every pass; steps the active buzz pattern
  void chimePhase(Phase to);   // buzz appropriate to the phase we entered
  void beep();                 // one short blip (button feedback)
}
