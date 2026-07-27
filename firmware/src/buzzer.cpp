#include "buzzer.h"
#include "config.h"

namespace {
  struct Step { bool on; uint16_t ms; };     // a segment: buzzer on or off, for ms

  // Distinct buzz patterns so you can tell phases apart by feel/ear.
  const Step PAT_WORK[]  = { {true,110},{false,90},{true,110} };  // two short buzzes → focus
  const Step PAT_BREAK[] = { {true,340} };                        // one long buzz  → break
  const Step PAT_BLIP[]  = { {true,25} };                         // tiny blip      → button

  const Step* gSeq   = nullptr;
  uint8_t     gLen   = 0;
  uint8_t     gIdx   = 0;
  uint32_t    gUntil = 0;
  bool        gPlaying = false;

  void applyStep() {
    digitalWrite(PIN_BUZZER, gSeq[gIdx].on ? HIGH : LOW);
    gUntil = millis() + gSeq[gIdx].ms;
  }
  void play(const Step* seq, uint8_t len) {
    gSeq = seq; gLen = len; gIdx = 0; gPlaying = true;
    applyStep();
  }
}

namespace buzzer {

void begin() {
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);
}

void loop() {
  if (!gPlaying) return;
  if ((int32_t)(millis() - gUntil) < 0) return;    // current segment still running
  gIdx++;
  if (gIdx >= gLen) { digitalWrite(PIN_BUZZER, LOW); gPlaying = false; return; }
  applyStep();
}

void chimePhase(Phase to) {
  if (to == PHASE_WORK) play(PAT_WORK,  sizeof(PAT_WORK)  / sizeof(Step));
  else                  play(PAT_BREAK, sizeof(PAT_BREAK) / sizeof(Step));
}

void beep() { play(PAT_BLIP, sizeof(PAT_BLIP) / sizeof(Step)); }

} // namespace buzzer
