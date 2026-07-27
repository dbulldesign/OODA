/* Controls — rotary encoder (EC11) + push switch.
 *
 * Turning reports a signed delta (used as the idle length preview). The switch
 * is debounced and distinguishes a short press from a long press so main.cpp
 * can map short→start/stop and long→skip.
 */
#pragma once
#include <Arduino.h>

namespace controls {
  enum Press { PRESS_NONE, PRESS_SHORT, PRESS_LONG };

  void begin();
  void loop();                 // call every pass; polls the button

  int  takeRotation();         // net detents since last call (signed); clears it
  Press takePress();           // a completed press since last call; clears it
}
