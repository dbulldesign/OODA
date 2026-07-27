/* Display — the SSD1306 OLED (Adafruit STEMMA QT 128×64, #938 / #326).
 *
 * Two screens, chosen by whether the host reports a running Pomodoro:
 *   - idle:    "Press to focus" + today's total (+ knob length preview)
 *   - running: phase icon + label + a big MM:SS countdown + round
 * The top-right corner shows the active link (USB / WiFi) and its state.
 */
#pragma once
#include <Arduino.h>
#include "state.h"
#include "transport.h"

namespace display {
  void begin();                // also initializes the shared I²C (Wire) bus
  // `source` is "USB"/"WiFi"/""; `previewMin` is the idle knob preview (<=0 hides).
  void render(const PomoState& st, const char* source, LinkStatus status, int previewMin);
  void splash(const char* line1, const char* line2);
}
