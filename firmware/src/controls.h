/* Controls — Adafruit I²C QT Rotary Encoder (#5880, seesaw firmware).
 *
 * The encoder and its push switch are read over the STEMMA QT I²C bus (shared
 * with the OLED), so there are no encoder GPIOs. Turning reports a signed delta
 * (used as the idle length preview); the switch is debounced and distinguishes a
 * short press from a long press.
 */
#pragma once
#include <Arduino.h>

namespace controls {
  enum Press { PRESS_NONE, PRESS_SHORT, PRESS_LONG };

  void begin();                // call after Wire has been initialized
  void loop();                 // poll the encoder + button (throttled internally)

  bool ready();                // did the seesaw encoder respond on the bus?
  int  takeRotation();         // net detents since last call (signed); clears it
  Press takePress();           // a completed press since last call; clears it
}
