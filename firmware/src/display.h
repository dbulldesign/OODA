/* Display — the 3.5" 480×320 color TFT FeatherWing (#3651, HX8357).
 *
 * Two screens, chosen by whether the host reports a running Pomodoro:
 *   - idle:    "Press to focus" + today's total (+ knob length preview)
 *   - running: phase label + a big MM:SS countdown + round, in the phase's
 *              accent color (the category color the host sends, when present)
 * The top-right corner shows the active link (USB / WiFi) and its state.
 *
 * Full-screen repaints only happen when the layout changes; between them just
 * the countdown digits repaint each second, so the SPI TFT stays responsive.
 */
#pragma once
#include <Arduino.h>
#include "state.h"
#include "transport.h"

namespace display {
  void begin();
  // `source` is "USB"/"WiFi"/""; `previewMin` is the idle knob preview (<=0 hides).
  void render(const PomoState& st, const char* source, LinkStatus status, int previewMin);
  void splash(const char* line1, const char* line2);
}
