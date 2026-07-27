/* Buzzer — non-blocking chimes on a passive buzzer.
 *
 * chimePhase() picks a short melody per phase (work vs. break) and buzzer::loop()
 * steps through the notes without ever blocking, so the countdown keeps ticking
 * while it plays.
 */
#pragma once
#include <Arduino.h>
#include "state.h"

namespace buzzer {
  void begin();
  void loop();                 // call every pass; steps the active melody
  void chimePhase(Phase to);   // chime appropriate to the phase we entered
  void beep();                 // one short blip (button feedback)
}
