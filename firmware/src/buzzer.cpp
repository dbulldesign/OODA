#include "buzzer.h"
#include "config.h"

namespace {
  struct Note { uint16_t freq; uint16_t ms; };   // freq 0 = rest

  const Note MELODY_WORK[]  = { {880,120},{0,40},{1175,180} };            // rising: back to focus
  const Note MELODY_BREAK[] = { {988,140},{0,40},{784,140},{0,40},{659,220} }; // falling: relax
  const Note MELODY_BLIP[]  = { {1568,35} };                             // button feedback

  const Note* gSeq   = nullptr;
  uint8_t     gLen   = 0;
  uint8_t     gIdx   = 0;
  uint32_t    gUntil = 0;      // when the current note ends
  bool        gPlaying = false;

  void startNote() {
    const Note& n = gSeq[gIdx];
    if (n.freq) tone(PIN_BUZZER, n.freq);
    else        noTone(PIN_BUZZER);
    gUntil = millis() + n.ms;
  }

  void play(const Note* seq, uint8_t len) {
    gSeq = seq; gLen = len; gIdx = 0; gPlaying = true;
    startNote();
  }
}

namespace buzzer {

void begin() {
  pinMode(PIN_BUZZER, OUTPUT);
  noTone(PIN_BUZZER);
}

void loop() {
  if (!gPlaying) return;
  if ((int32_t)(millis() - gUntil) < 0) return;   // current note still sounding
  gIdx++;
  if (gIdx >= gLen) { noTone(PIN_BUZZER); gPlaying = false; return; }
  startNote();
}

void chimePhase(Phase to) {
  if (to == PHASE_WORK) play(MELODY_WORK, sizeof(MELODY_WORK) / sizeof(Note));
  else                  play(MELODY_BREAK, sizeof(MELODY_BREAK) / sizeof(Note));
}

void beep() { play(MELODY_BLIP, sizeof(MELODY_BLIP) / sizeof(Note)); }

} // namespace buzzer
