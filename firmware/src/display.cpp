#include "display.h"
#include "config.h"
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

namespace {
  Adafruit_SSD1306 oled(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
  bool gReady = false;

  // ── formatting helpers ──────────────────────────────────────────────────────
  void fmtMMSS(int64_t ms, char* buf, size_t n) {
    if (ms < 0) ms = 0;
    int64_t totalSec = (ms + 999) / 1000;      // round up so it hits 00:00 at end
    long mm = (long)(totalSec / 60);
    long ss = (long)(totalSec % 60);
    if (mm > 99) mm = 99;
    snprintf(buf, n, "%02ld:%02ld", mm, ss);
  }

  void fmtToday(int64_t ms, char* buf, size_t n) {
    if (ms < 0) ms = 0;
    long totalMin = (long)(ms / 60000);
    long h = totalMin / 60, m = totalMin % 60;
    if (h > 0) snprintf(buf, n, "Today %ldh %ldm", h, m);
    else       snprintf(buf, n, "Today %ldm", m);
  }

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

  void centerText(const char* s, int size, int y) {
    oled.setTextSize(size);
    int16_t x1, y1; uint16_t w, h;
    oled.getTextBounds(s, 0, 0, &x1, &y1, &w, &h);
    oled.setCursor((OLED_WIDTH - (int)w) / 2, y);
    oled.print(s);
  }

  // ── phase icons (~16×16, top-left) ───────────────────────────────────────────
  void iconTomato(int x, int y) {
    oled.fillCircle(x + 8, y + 10, 6, SSD1306_WHITE);
    oled.drawLine(x + 8, y + 4, x + 8, y + 1, SSD1306_WHITE);
    oled.drawLine(x + 5, y + 3, x + 11, y + 3, SSD1306_WHITE);
  }
  void iconCoffee(int x, int y) {
    oled.drawRect(x + 2, y + 5, 10, 8, SSD1306_WHITE);
    oled.drawRect(x + 12, y + 6, 3, 4, SSD1306_WHITE);
    oled.drawLine(x + 5, y + 1, x + 5, y + 3, SSD1306_WHITE);
    oled.drawLine(x + 8, y + 1, x + 8, y + 3, SSD1306_WHITE);
  }
  void iconPalm(int x, int y) {
    oled.drawLine(x + 8, y + 15, x + 8, y + 6, SSD1306_WHITE);
    oled.drawLine(x + 8, y + 6, x + 3, y + 3, SSD1306_WHITE);
    oled.drawLine(x + 8, y + 6, x + 13, y + 3, SSD1306_WHITE);
    oled.drawLine(x + 8, y + 6, x + 2, y + 7, SSD1306_WHITE);
    oled.drawLine(x + 8, y + 6, x + 14, y + 7, SSD1306_WHITE);
  }
  void phaseIcon(Phase p, int x, int y) {
    switch (p) {
      case PHASE_WORK:  iconTomato(x, y); break;
      case PHASE_BREAK: iconCoffee(x, y); break;
      case PHASE_LONG:  iconPalm(x, y);   break;
      default: break;
    }
  }

  // Top-right: link source label + status glyph.
  void linkBadge(const char* source, LinkStatus st) {
    int gx = OLED_WIDTH - 8, gy = 0;         // glyph box (6×6)
    switch (st) {
      case LINK_ONLINE:    oled.fillCircle(gx + 3, gy + 3, 3, SSD1306_WHITE); break;
      case LINK_SEARCHING: oled.drawCircle(gx + 3, gy + 3, 3, SSD1306_WHITE); break;
      default:
        oled.drawLine(gx, gy, gx + 6, gy + 6, SSD1306_WHITE);
        oled.drawLine(gx + 6, gy, gx, gy + 6, SSD1306_WHITE);
        break;
    }
    if (source && source[0]) {               // small "USB"/"WiFi" left of the glyph
      oled.setTextSize(1);
      int16_t x1, y1; uint16_t w, h;
      oled.getTextBounds(source, 0, 0, &x1, &y1, &w, &h);
      oled.setCursor(gx - 3 - (int)w, 0);
      oled.print(source);
    }
  }

  // ── screens ─────────────────────────────────────────────────────────────────
  void renderIdle(const PomoState& st, int previewMin) {
    centerText("OODA", 1, 2);
    if (previewMin > 0) {
      char buf[24]; snprintf(buf, sizeof(buf), "%d min", previewMin);
      centerText(buf, 3, 20);
      centerText("turn to set \x18\x19", 1, 46);
    } else {
      centerText("Press to focus", 1, 26);
    }
    char today[24];
    fmtToday(st.valid ? st.todayMs : 0, today, sizeof(today));
    centerText(today, 1, 55);
  }

  void renderRunning(const PomoState& st) {
    phaseIcon(st.phase, 0, 0);
    oled.setTextSize(1);
    oled.setCursor(20, 4);
    oled.print(phaseLabel(st.phase));
    char mmss[8];
    fmtMMSS(st.remainingMs(), mmss, sizeof(mmss));
    centerText(mmss, 3, 22);
    char foot[24];
    if (st.phase == PHASE_WORK) snprintf(foot, sizeof(foot), "Round %d", st.round);
    else                        snprintf(foot, sizeof(foot), "after round %d", st.round);
    centerText(foot, 1, 55);
  }
}

namespace display {

void begin() {
  // Some Adafruit boards gate the STEMMA QT / I²C connector behind a power pin
  // (ESP32 Feather V2 → NEOPIXEL_I2C_POWER). Drive it high so the OLED + encoder
  // get power. Guarded so it compiles on boards without the macro.
#if defined(NEOPIXEL_I2C_POWER)
  pinMode(NEOPIXEL_I2C_POWER, OUTPUT); digitalWrite(NEOPIXEL_I2C_POWER, HIGH);
#endif
#if defined(PIN_I2C_POWER)
  pinMode(PIN_I2C_POWER, OUTPUT); digitalWrite(PIN_I2C_POWER, HIGH);
#endif
  delay(10);

  Wire.begin();                              // STEMMA QT default pins (OLED + encoder)
  gReady = oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);
  if (!gReady) return;
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextWrap(false);
  oled.clearDisplay();
  oled.display();
}

void splash(const char* line1, const char* line2) {
  if (!gReady) return;
  oled.clearDisplay();
  centerText(line1, 2, 16);
  if (line2) centerText(line2, 1, 42);
  oled.display();
}

void render(const PomoState& st, const char* source, LinkStatus status, int previewMin) {
  if (!gReady) return;
  oled.clearDisplay();

  if (!st.valid) {                           // no frame yet from either link
    centerText("OODA puck", 1, 6);
    centerText(statusWord(status), 2, 26);
  } else if (st.hasPomo) {
    renderRunning(st);
  } else {
    renderIdle(st, previewMin);
  }

  linkBadge(source, status);
  oled.display();
}

} // namespace display
