# Building & flashing the OODA Pomodoro puck

This is the implementation of the contract in [`README.md`](./README.md). It's an
ESP32 (Arduino) sketch built with [PlatformIO](https://platformio.org/).

## 1. Wire it up

Default pinout (matches the README wiring table; change in `src/config.h`):

| Signal | ESP32 GPIO |
|---|---|
| OLED SDA | GPIO 21 |
| OLED SCL | GPIO 22 |
| OLED VCC / GND | 3V3 / GND |
| Encoder CLK (A) | GPIO 32 |
| Encoder DT (B) | GPIO 33 |
| Encoder SW (button) | GPIO 25 |
| Buzzer + | GPIO 26 |
| Buzzer − | GND |

Parts: any WROOM-32 devkit, an SSD1306 128×64 I²C OLED, an EC11 rotary encoder
with push switch, and a passive buzzer.

## 2. Configure

Copy the template and fill in your WiFi, host IP/port, and the LAN token from the
OODA tray menu (**Remote control → On — allow LAN devices** copies a URL with the
`?token=…`):

```sh
cp src/config.h.example src/config.h
$EDITOR src/config.h
```

`src/config.h` is git-ignored, so your credentials never get committed.

## 3. Build & flash

```sh
pio run                 # compile
pio run -t upload       # flash over USB
pio device monitor      # serial log @ 115200
```

The `platformio.ini` pins the ESP32 platform and pulls the libraries
automatically: Adafruit SSD1306 + GFX, ArduinoJson v7, and ESP32Encoder.

> Using the Arduino IDE instead? Install those four libraries, set the board to
> your ESP32 devkit, and add the `src/*.cpp` / `src/*.h` files plus your
> `config.h` to a sketch folder.

## 4. What you should see

1. **`OODA / puck`** splash on boot.
2. **`searching` / `connected`** as it finds the host (`GET /ping`) and opens the
   SSE stream (`GET /events`). The top-right glyph shows link state (● live,
   ○ searching, ✕ down).
3. **Idle** → "Press to focus" and today's total. Turn the knob to preview a
   length (local preview only — see note below).
4. **Running** → a phase icon (🍅 focus / ☕ break / 🌴 long), a big `MM:SS`
   countdown, and the round.

## Controls

| Input | Action |
|---|---|
| Short press (idle) | `GET /pomodoro/start` |
| Short press (running) | `GET /pomodoro/stop` |
| Long press (≥ `LONG_PRESS_MS`) | `GET /pomodoro/skip` |
| Turn knob (idle) | Preview a focus length (cosmetic) |

The buzzer chimes when the host reports a phase change (a rising two-note motif
entering focus, a falling one entering a break).

## Notes

- **The puck never runs the clock.** OODA is the source of truth. Every frame
  carries the host clock (`now`) and phase end (`endsAt`); the puck computes
  `offset = now − millis()` and shows `endsAt − (millis() + offset)`, so the
  countdown stays correct even as the ESP32 clock drifts, and re-syncs on each
  frame.
- **Knob length is a stretch goal.** OODA sets the focus length in its own
  settings and the host has no per-start length parameter yet, so the knob only
  previews a number locally — pressing still calls plain `/pomodoro/start`. When
  the host gains a length parameter, send `gPreviewMin` along with the start
  command in `main.cpp`.
- **Resilience.** If WiFi or the host drops, the puck shows `no wifi` / `offline`
  and reconnects with exponential backoff (capped at 15 s). A stalled stream
  (no data or heartbeat for 45 s) is treated as dead and redialed. Nothing in
  the loop blocks.
