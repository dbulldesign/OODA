#include "transport.h"
#include <ArduinoJson.h>

bool parseStateFrame(const char* json, PomoState& out) {
  JsonDocument doc;
  if (deserializeJson(doc, json)) return false;

  out.valid   = true;
  out.paused  = doc["paused"] | false;
  out.todayMs = doc["todayMs"].as<int64_t>();
  strlcpy(out.status, doc["status"] | "", sizeof(out.status));

  JsonObject pomo = doc["pomo"];
  if (pomo.isNull()) {
    out.hasPomo = false;
    out.phase   = PHASE_NONE;
    out.endsAt  = 0;
    out.round   = 0;
  } else {
    out.hasPomo = true;
    out.phase   = phaseFromStr(pomo["phase"] | "");
    out.endsAt  = pomo["endsAt"].as<int64_t>();
    out.round   = pomo["round"] | 0;
  }

  // Clock-skew correction: offset = now - millis().  (README countdown math.)
  int64_t nowHost = doc["now"].as<int64_t>();
  if (nowHost > 0) out.offset = nowHost - (int64_t)millis();
  return true;
}
