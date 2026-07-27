# Building & flashing the OODA Pomodoro puck

Implementation of the contract in [`README.md`](./README.md). It's an ESP32
(Arduino / PlatformIO) sketch that talks to the OODA host over **USB‑C as the
primary link** and **WiFi as an automatic fallback**. No battery — the puck is
always powered from the same USB‑C cable it communicates over.

## Parts (Adafruit) — a no‑soldering build

Everything either plugs in (STEMMA QT) or screws down (a terminal‑block wing), so
the whole device goes together **without an iron**:

| Part | Adafruit | Notes |
|---|---|---|
| **ESP32 Feather V2 — with Headers** | [#5900](https://www.adafruit.com/product/5900) | Headers pre‑soldered, so it drops into the wing. WiFi + STEMMA QT; USB‑C via a CP2102 bridge. The brain + both links. |
| **Terminal Block Breakout FeatherWing** (assembled) | [#2926](https://www.adafruit.com/product/2926) | Screw terminals for every Feather pin. The Feather seats on top; the buzzer + power clamp in. |
| **128×64 monochrome OLED, STEMMA QT** | [#938](https://www.adafruit.com/product/938) (1.3″) or [#326](https://www.adafruit.com/product/326) (0.96″) | Both are **SSD1306** at I²C `0x3C`. |
| **I²C QT Rotary Encoder** (seesaw) | [#5880](https://www.adafruit.com/product/5880) | Encoder + push‑switch on the I²C bus at `0x36`. The whole UI. |
| **Active buzzer, 5V** | [#1536](https://www.adafruit.com/product/1536) | Self‑oscillating — a plain on/off buzz. Its two legs clamp into the A0 + GND screw terminals. |
| **STEMMA QT cables ×2** | [#4210](https://www.adafruit.com/product/4210) | Feather → OLED → encoder. |

> **Why the Feather V2 and not an S3?** The V2 ships *with headers already
> soldered*, which is what makes the wing solderless. Its USB is a serial bridge
> rather than native USB — no difference to how the puck runs; the host just sees
> a COM port either way.

> Want a silent, tactile buzz instead of an audible one? Swap in the [vibrating
> mini motor disc (#1201)](https://www.adafruit.com/product/1201) — same on/off
> firmware, but a motor needs a driver transistor + flyback diode.

> Prefer a plain EC11 encoder instead of the I²C one? Swap the body of
> `src/controls.cpp` for a GPIO read (into three more screw terminals) — the rest
> of the firmware is unchanged.

## Assembly (no soldering)

1. Seat the **Feather V2** on the **Terminal Block Wing** (headers → socket).
2. Daisy‑chain the I²C bus with STEMMA QT cables — nothing to solder:

   ```
   Feather V2  ──QT──►  OLED (SSD1306, 0x3C)  ──QT──►  Rotary encoder (seesaw, 0x36)
   ```

3. Clamp the buzzer into the screw terminals:

| Signal | Feather V2 pin (screw terminal) |
|---|---|
| I²C SDA / SCL | STEMMA QT connector (the board's default `Wire`) |
| Buzzer + | **A0** (GPIO 26) |
| Buzzer − | GND |
| (optional) debug UART | any free terminals — see `DEBUG_LOG` |

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
debug UART pins (`pio device monitor` on the USB port won't show puck logs — it
would collide with the host link).

## Turn on the host side

The puck's USB link needs the OODA host to speak serial. That's built in
(`host/control-serial.js`) and **on by default**, but it needs one optional npm
package:

```sh
cd host && npm install serialport      # optional dependency; native module
```

Then the host auto‑detects the puck on USB (it knows the Espressif, Adafruit,
Silicon Labs, and CH340 USB vendor IDs) and starts streaming state to it. Toggle it in the tray: **Remote control → USB puck**. If
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

The buzzer buzzes when the host reports a phase change — two short buzzes
entering focus, one long buzz entering a break.

## How it works

Two links, one preference:

- **USB‑C (primary).** USB serial (a CP2102 bridge on the Feather V2, at
  115200 baud). Newline‑delimited protocol:
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
