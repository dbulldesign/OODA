#include "display.h"
#include "config.h"
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_HX8357.h>

namespace {
  Adafruit_HX8357 tft = Adafruit_HX8357(TFT_CS, TFT_DC, TFT_RST);
  bool gReady = false;
  int  W = 480, H = 320;

  // ── palette (RGB565 via tft.color565) ────────────────────────────────────────
  uint16_t BG, INK, MUT, PANEL;
  uint16_t hex565(uint32_t c) { return tft.color565((c >> 16) & 0xFF, (c >> 8) & 0xFF, c & 0xFF); }

  // Accent for a phase: the host's category color when present, else a sensible
  // default per phase.
  uint16_t accentFor(const PomoState& st) {
    if (st.hasColor) return hex565(st.color);
    switch (st.phase) {
      case PHASE_WORK:  return hex565(0xE2503B);   // tomato
      case PHASE_BREAK: return hex565(0x4C9A8E);   // teal
      case PHASE_LONG:  return hex565(0x4C7AC9);   // blue
      default:          return hex565(0x5AB4A6);
    }
  }

  // ── redraw bookkeeping ────────────────────────────────────────────────────────
  // Full repaint only when this signature changes; otherwise just the clock.
  struct Sig {
    bool     valid, hasPomo;
    int      phase, round, preview, statusI;
    int64_t  today;
    uint32_t accent;
    uint8_t  srcHash;
  };
  Sig  gSig;
  bool gHaveSig = false;
  char gClock[8] = "";

  // Reserved band for the big countdown (running screen).
  const int CLOCK_Y = 108, CLOCK_H = 120, CLOCK_SIZE = 12;   // size 12 → 96px tall glyphs

  uint8_t srcHash(const char* s) { uint8_t h = 0; for (; s && *s; ++s) h = h * 31 + (uint8_t)*s; return h; }

  const char* phaseLabel(Phase p) {
    switch (p) {
      case PHASE_WORK:  return "FOCUS";
      case PHASE_BREAK: return "BREAK";
      case PHASE_LONG:  return "LONG BREAK";
      default:          return "";
    }
  }
  const char* statusWord(LinkStatus s) {
    switch (s) { case LINK_ONLINE: return "connected"; case LINK_SEARCHING: return "searching"; default: return "offline"; }
  }

  void fmtMMSS(int64_t ms, char* buf, size_t n) {
    if (ms < 0) ms = 0;
    int64_t total = (ms + 999) / 1000;
    long mm = (long)(total / 60), ss = (long)(total % 60);
    if (mm > 99) mm = 99;
    snprintf(buf, n, "%02ld:%02ld", mm, ss);
  }
  void fmtToday(int64_t ms, char* buf, size_t n) {
    if (ms < 0) ms = 0;
    long t = (long)(ms / 60000), h = t / 60, m = t % 60;
    if (h > 0) snprintf(buf, n, "Today  %ldh %ldm", h, m);
    else       snprintf(buf, n, "Today  %ldm", m);
  }

  // Draw text horizontally centered at row y (top), given size + color.
  void centerText(const char* s, int size, int y, uint16_t color) {
    tft.setTextSize(size);
    tft.setTextColor(color);
    int16_t x1, y1; uint16_t w, h;
    tft.getTextBounds(s, 0, 0, &x1, &y1, &w, &h);
    tft.setCursor((W - (int)w) / 2, y);
    tft.print(s);
  }

  // Link badge, top-right: "USB"/"WiFi" + a status dot.
  void drawBadge(const char* source, LinkStatus st) {
    uint16_t c = (st == LINK_ONLINE) ? hex565(0x5BC46A)
               : (st == LINK_SEARCHING) ? hex565(0xE0A83A) : hex565(0xE2503B);
    int r = 7, cx = W - 16, cy = 20;
    tft.fillCircle(cx, cy, r, c);
    if (source && source[0]) {
      tft.setTextSize(2);
      tft.setTextColor(MUT);
      int16_t x1, y1; uint16_t w, h;
      tft.getTextBounds(source, 0, 0, &x1, &y1, &w, &h);
      tft.setCursor(cx - r - 8 - (int)w, cy - h / 2);
      tft.print(source);
    }
  }

  // Repaint just the countdown band with the current MM:SS.
  void drawClock(const PomoState& st) {
    tft.fillRect(0, CLOCK_Y, W, CLOCK_H, BG);
    centerText(gClock, CLOCK_SIZE, CLOCK_Y + (CLOCK_H - CLOCK_SIZE * 8) / 2, accentFor(st));
  }

  // Full repaint of the current screen.
  void drawFull(const PomoState& st, const char* source, LinkStatus status, int previewMin) {
    tft.fillScreen(BG);
    drawBadge(source, status);

    if (!st.valid) {
      centerText("OODA puck", 4, 70, INK);
      centerText(statusWord(status), 5, 150, MUT);
      return;
    }

    if (st.hasPomo) {
      uint16_t accent = accentFor(st);
      tft.fillRect(0, 0, W, 8, accent);                 // top accent stripe
      centerText(phaseLabel(st.phase), 4, 40, accent);
      drawClock(st);                                    // the big MM:SS
      char foot[24];
      if (st.phase == PHASE_WORK) snprintf(foot, sizeof(foot), "Round %d", st.round);
      else                        snprintf(foot, sizeof(foot), "after round %d", st.round);
      centerText(foot, 3, 262, MUT);
    } else {
      centerText("OODA", 4, 34, INK);
      if (previewMin > 0) {
        char buf[16]; snprintf(buf, sizeof(buf), "%d min", previewMin);
        centerText(buf, 9, 120, accentFor(st));
        centerText("turn to set", 2, 214, MUT);
      } else {
        centerText("Press to focus", 4, 140, INK);
      }
      char today[28];
      fmtToday(st.todayMs, today, sizeof(today));
      centerText(today, 3, 270, MUT);
    }
  }

  Sig sigOf(const PomoState& st, const char* source, LinkStatus status, int previewMin) {
    Sig s;
    s.valid = st.valid; s.hasPomo = st.hasPomo;
    s.phase = st.phase; s.round = st.round; s.preview = previewMin;
    s.statusI = (int)status; s.today = st.todayMs;
    s.accent = st.hasColor ? st.color : (uint32_t)st.phase | 0x1000000; // phase-derived, distinct from colors
    s.srcHash = srcHash(source);
    return s;
  }
  bool sigEq(const Sig& a, const Sig& b) {
    return a.valid==b.valid && a.hasPomo==b.hasPomo && a.phase==b.phase && a.round==b.round &&
           a.preview==b.preview && a.statusI==b.statusI && a.today==b.today &&
           a.accent==b.accent && a.srcHash==b.srcHash;
  }
}

namespace display {

void begin() {
  tft.begin();
  tft.setRotation(TFT_ROTATION);
  W = tft.width(); H = tft.height();
  gReady = true;
  BG    = tft.color565(10, 12, 16);
  INK   = tft.color565(240, 240, 236);
  MUT   = tft.color565(120, 130, 140);
  PANEL = tft.color565(24, 26, 32);
  tft.fillScreen(BG);
}

void splash(const char* line1, const char* line2) {
  if (!gReady) return;
  tft.fillScreen(BG);
  centerText(line1, 7, 110, INK);
  if (line2) centerText(line2, 3, 190, MUT);
}

void render(const PomoState& st, const char* source, LinkStatus status, int previewMin) {
  if (!gReady) return;

  Sig s = sigOf(st, source, status, previewMin);
  if (!gHaveSig || !sigEq(s, gSig)) {          // layout changed → full repaint
    fmtMMSS(st.remainingMs(), gClock, sizeof(gClock));
    drawFull(st, source, status, previewMin);
    gSig = s; gHaveSig = true;
    return;
  }

  // Same layout: only the running countdown ticks — repaint just its band when
  // the displayed MM:SS actually changes (about once a second).
  if (st.hasPomo) {
    char now[8];
    fmtMMSS(st.remainingMs(), now, sizeof(now));
    if (strcmp(now, gClock) != 0) {
      strlcpy(gClock, now, sizeof(gClock));
      drawClock(st);
    }
  }
}

} // namespace display
