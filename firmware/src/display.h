/* Display — the SSD1306 OLED.
 *
 * Two screens, chosen by whether the host reports a running Pomodoro:
 *   - idle:    "Press to focus" + today's total (+ knob length preview)
 *   - running: phase icon + label + a big MM:SS countdown + round
 * A small status glyph in the top-right shows the connection state.
 */
#pragma once
#include <Arduino.h>
#include "state.h"
#include "net.h"

namespace display {
  void begin();
  // Render the current frame. `previewMin` is the idle knob preview (minutes);
  // pass <=0 to hide it.
  void render(const PomoState& st, NetStatus net, int previewMin);
  void splash(const char* line1, const char* line2);
}
