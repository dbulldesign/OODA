/* PomoState — the puck's mirror of the OODA host state.
 *
 * OODA is the source of truth; the puck never runs its own clock. Each SSE
 * `data:` frame is parsed into one of these, and the display derives the
 * live countdown from it using the host clock (see remainingMs()).
 */
#pragma once
#include <Arduino.h>

enum Phase { PHASE_NONE, PHASE_WORK, PHASE_BREAK, PHASE_LONG };

struct PomoState {
  bool    valid    = false;   // have we parsed at least one frame?
  bool    paused   = false;   // OODA capture paused (not the pomodoro)

  // Pomodoro (null on the host → hasPomo == false → idle screen).
  bool    hasPomo  = false;
  Phase   phase    = PHASE_NONE;
  int64_t endsAt   = 0;       // phase end, host epoch ms
  int     round    = 0;       // 1-based focus round in the current set

  // Activity / totals.
  int64_t todayMs  = 0;       // total tracked time today, ms
  char    status[40] = "";    // current activity/capture label

  // Clock-skew correction (README "Countdown math").
  //   offset       = now - millis()            (host clock vs. local, ms)
  //   remaining_ms = endsAt - (millis()+offset) (clamped at 0)
  int64_t offset   = 0;

  // Milliseconds left in the current phase, right now, clamped at 0.
  int64_t remainingMs() const {
    if (!hasPomo) return 0;
    int64_t rem = endsAt - ((int64_t)millis() + offset);
    return rem > 0 ? rem : 0;
  }
};

inline Phase phaseFromStr(const char* s) {
  if (!s) return PHASE_NONE;
  if (!strcmp(s, "work"))  return PHASE_WORK;
  if (!strcmp(s, "break")) return PHASE_BREAK;
  if (!strcmp(s, "long"))  return PHASE_LONG;
  return PHASE_NONE;
}
