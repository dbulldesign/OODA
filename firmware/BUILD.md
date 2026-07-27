# Building & flashing the OODA Pomodoro puck

Implementation of the contract in [`README.md`](./README.md). It's an ESP32‑S3
(Arduino / PlatformIO) sketch that talks to the OODA host over **USB‑C as the
primary link** and **WiFi as an automatic fallback**. No battery — the puck is
always powered from the same USB‑C cable it communicates over.

## Parts (Adafruit)

A solder‑light STEMMA QT build: the OLED and the encoder share the I²C bus, so
they daisy‑chain with two JST cables and nothing to solder but the buzzer.

| Part | Adafruit | Notes |
|---|---|---|
| **QT Py ESP32‑S3** (8 MB, no PSRAM) | [#5426](https://www.adafruit.com/product/5426) | Native USB‑C (real USB‑CDC), WiFi, STEMMA QT. The brain + both links. |
| **128×64 monochrome OLED, STEMMA QT** | [#938](https://www.adafruit.com/product/938) (1.3″) or [#326](https://www.adafruit.com/product/326) (0.96″) | Both are **SSD1306** at I²C `0x3C`. |
| **I²C QT Rotary Encoder** (seesaw) | [#5880](https://www.adafruit.com/product/5880) | Encoder + push‑switch on the I²C bus at `0x36`. The whole UI. |
| **Piezo buzzer** | [#160](https://www.adafruit.com/product/160) | Passive; one leg to a GPIO, one to GND. |
| **STEMMA QT cables ×2** | [#4210](https://www.adafruit.com/product/4210) | QT Py → OLED → encoder. |

> Prefer a plain EC11 encoder on GPIOs instead of the I²C one? Swap the body of
> `src/controls.cpp` for a GPIO read — the rest of the firmware is unchanged.

## Wiring

Almost all of it is the STEMMA QT chain (I²C):

```
QT Py ESP32-S3  ──QT──►  OLED (SSD1306, 0x3C)  ──QT──►  Rotary encoder (seesaw, 0x36)
```

Only the buzzer is hand‑wired:

| Signal | QT Py ESP32‑S3 pin |
|---|---|
| I²C SDA / SCL | STEMMA QT connector (the board's default `Wire`) |
| Buzzer + | **A0** (GPIO 18) |
| Buzzer − | GND |
| (optional) debug UART | TX / RX pads — see `DEBUG_LOG` |

Change any of this in `src/config.h`.

## Configure

```sh
cp src/config.h.example src/config.h
$EDITOR src/config.h
```

- **USB‑only puck:** leave `WIFI_SSID ""`. Done — it talks over USB‑C.
- **With WiFi fallback:** set `WIFI_SSID` / `WIFI_PASSWORD`, `OODA_HOST` (the
  host's LAN IP), and `OODA_TOKEN` (from the OODA tray → Remote control → *On —
  allow LAN devices*).

`src/config.h` is git‑ignored, so credentials never get committed.

## Build & flash

```sh
pio run                 # compile
pio run -t upload       # flash over USB-C
```

The USB port carries the host protocol at runtime, so debug logs don't go there.
For logs, set `DEBUG_LOG 1` in `config.h` and attach a USB‑serial adapter to the
TX/RX pads (`pio device monitor` won't show puck logs on the native port).

## Turn on the host side

The puck's USB link needs the OODA host to speak serial. That's built in
(`host/control-serial.js`) and **on by default**, but it needs one optional npm
package:

```sh
cd host && npm install serialport      # optional dependency; native module
```

Then the host auto‑detects an ESP32‑S3 / Adafruit board on USB and starts
streaming state to it. Toggle it in the tray: **Remote control → USB puck**. If
`serialport` isn't installed, the item is disabled and only the WiFi/HTTP path
is available — nothing else changes.

## What you should see

1. **`OODA / puck`** splash on boot.
2. Top‑right badge shows the active link and state: **USB ●** once the host is
   streaming over the cable, or **WiFi ●** if it fell back; ○ searching, ✕ down.
3. **Idle** → "Press to focus" + today's total. Turn the knob to preview a length.
4. **Running** → phase icon (🍅 / ☕ / 🌴), a big `MM:SS`, and the round.

## Controls

| Input | Action |
|---|---|
| Short press (idle) | start a focus block |
| Short press (running) | stop it |
| Long press (≥ `LONG_PRESS_MS`) | skip to the next phase |
| Turn knob (idle) | preview a focus length (cosmetic — see note) |

The buzzer chimes when the host reports a phase change.

## How it works

Two links, one preference:

- **USB‑C (primary).** Native USB‑CDC serial. Newline‑delimited protocol:
  the puck sends `HELLO` / `START` / `STOP` / `SKIP` / `TOGGLE`; the host sends
  `{"type":"hello"}`, `{"type":"ping"}` heartbeats, and the same JSON state
  object the SSE stream uses. No token — a USB cable is physically local, the
  same way loopback HTTP needs none.
- **WiFi (fallback).** The original HTTP + SSE path, used automatically only
  when the USB link goes quiet, and dropped again the moment USB returns. WiFi
  is kept warm in the background so failover is seamless.

Either way the puck **never runs its own clock**: every frame carries the host
time (`now`) and phase end (`endsAt`), and the puck shows
`endsAt − (millis() + offset)` where `offset = now − millis()`, re‑synced on
each frame. It ticks locally between frames and re‑syncs when a new one lands.

**Knob length is a stretch goal.** OODA owns the focus length and neither the
serial nor the HTTP protocol has a per‑start length yet, so the knob only
previews a number locally — pressing still starts a standard block. When the
host gains a length parameter, send `gPreviewMin` with the start command in
`src/main.cpp`.
