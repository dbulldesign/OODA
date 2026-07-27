# Building & flashing the OODA Pomodoro puck

Implementation of the contract in [`README.md`](./README.md). It's an ESP32
(Arduino / PlatformIO) sketch that talks to the OODA host over **USB‑C as the
primary link** and **WiFi as an automatic fallback**. No battery — the puck is
always powered from the same USB‑C cable it communicates over.

## Parts (Adafruit)

A big 3.5″ color display in a mostly plug‑together build:

| Part | Adafruit | Notes |
|---|---|---|
| **ESP32 Feather V2 — with Headers** | [#5900](https://www.adafruit.com/product/5900) | Headers pre‑soldered. WiFi + STEMMA QT; USB‑C via a CP2102 bridge. The brain + both links. |
| **3.5″ 480×320 TFT FeatherWing** (V2) | [#3651](https://www.adafruit.com/product/3651) | Color HX8357 LCD; **stacks onto the Feather** over SPI. Resistive touch (unused — we keep the knob). |
| **I²C QT Rotary Encoder** (seesaw) | [#5880](https://www.adafruit.com/product/5880) | Encoder + push‑switch on the I²C bus at `0x36`. The whole UI. |
| **Active buzzer, 5V** | [#1536](https://www.adafruit.com/product/1536) | Self‑oscillating — a plain on/off buzz. Two legs → the Feather's A0 + GND. |
| **STEMMA QT cable** | [#4210](https://www.adafruit.com/product/4210) | Feather → encoder. |

> **The stack tradeoff.** The 3.5″ TFT is a FeatherWing, so it takes the Feather's
> stacking position — the same spot the earlier screw‑terminal wing (#2926) used.
> With the screen on, the encoder still plugs into the Feather's STEMMA QT port
> (no solder), but the **buzzer's two wires need a Feather pin** (A0 + GND). If you
> want that connection solder‑free too, seat the Feather and the TFT wing
> side‑by‑side on a [FeatherWing Doubler (#2890)](https://www.adafruit.com/product/2890),
> which breaks the pins out to header holes.

> **Why the Feather V2 and not an S3?** It ships *with headers already soldered*,
> so the wing just presses on. Its USB is a serial bridge rather than native USB —
> no difference to how the puck runs; the host sees a COM port either way.

> Want a silent, tactile buzz instead of audible? Swap in the [vibrating mini
> motor disc (#1201)](https://www.adafruit.com/product/1201) — same firmware, but
> a motor needs a driver transistor + flyback diode.

## Assembly

1. Press the **3.5″ TFT wing** onto the **Feather V2** (headers → wing socket).
2. Plug the **encoder** into the Feather's STEMMA QT port with a QT cable:

   ```
   Feather V2  ──QT──►  Rotary encoder (seesaw, 0x36)
   TFT wing    ──stacked──►  Feather (SPI: CS=15, DC=33)
   ```

3. Run the **buzzer's** two legs to the Feather pins:

| Signal | Feather V2 pin |
|---|---|
| Display | stacked TFT wing (SPI, fixed by the wing) |
| Encoder SDA / SCL | STEMMA QT connector (the board's default `Wire`) |
| Buzzer + | **A0** (GPIO 26) |
| Buzzer − | GND |
| (optional) debug UART | any free pin — see `DEBUG_LOG` |

> **TFT pins:** `TFT_CS 15` / `TFT_DC 33` are the ESP32 values from Adafruit's
> 3.5″ TFT FeatherWing guide. If the screen stays blank, check the guide's V2
> pinout for your board and update `src/config.h`.

Change any of this in `src/config.h`.

## Enclosures

Parametric 3D‑print and laser‑cut designs live in [`enclosure/`](./enclosure/) —
see that folder's README to render/print/cut and for the dimensions to verify.

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
4. **Running** → the phase label in its accent color (the category color the
   host sends, when present), a large `MM:SS`, and the round.

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
