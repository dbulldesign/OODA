# OODA physical Pomodoro puck — firmware

This folder is for the firmware of a small physical Pomodoro timer that drives
(and mirrors) the Pomodoro in the OODA app. The device does **not** run its own
timer logic — OODA is the source of truth. The puck sends commands and shows
the countdown OODA reports back, so the phone, desktop HUD, activity log, and
puck all stay in sync.

Nothing is built here yet. This README is the **contract** the firmware targets:
the host endpoint it talks to, the message formats, a parts list, and a
suggested wiring. Start the firmware in a fresh chat pointed at this file.

---

## Architecture

```
  ┌─────────────┐   HTTP GET /pomodoro/start|stop|skip|toggle   ┌──────────────────┐
  │  ESP32 puck │ ────────────────────────────────────────────► │  OODA desktop    │
  │ (WiFi)      │                                                │  host (Electron) │
  │  OLED       │ ◄──────────  SSE  /events  (live state) ─────  │                  │
  │  knob+btn   │                                                │  drives ──► OODA │
  │  buzzer     │                                                │  web app pomo    │
  └─────────────┘                                                └──────────────────┘
```

The host runs a tiny HTTP + Server-Sent-Events server (`host/control.js`). The
puck issues commands over plain HTTP GET and subscribes to `/events` for live
state. OODA's Pomodoro engine (in the web app) actually runs the clock; the
host relays commands into it and relays its state back out.

---

## Enabling the endpoint (host side — already built)

In the OODA desktop host tray menu → **Remote control (physical timer)**:

- **Off** (default) — no port open.
- **On — this PC only** — binds `127.0.0.1` (for a Stream Deck / script on the
  same machine; a separate WiFi device can NOT reach this).
- **On — allow LAN devices** — binds `0.0.0.0` so a puck on the same WiFi can
  reach it, and generates a **shared token**. Picking this copies a ready URL
  (with `?token=…`) to the clipboard.

Default port: **7420** (configurable in `settings.json` as `controlPort`).

---

## Wire protocol

Base URL: `http://<host-ip>:7420/`

### Auth
- Requests from **loopback** (127.0.0.1) never need a token.
- Requests from **any other address** (i.e. the puck over WiFi) require the
  token, sent as either:
  - query param: `?token=<TOKEN>`, or
  - header: `X-OODA-Token: <TOKEN>`
- Missing/wrong token on a remote request → `401`.

### Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/ping` | none | Discovery. `{ok:true, name:"ooda-host", version:"1.12.0"}` |
| GET | `/state` | yes* | Current state snapshot (JSON, see below) |
| GET | `/events` | yes* | SSE stream; one JSON `data:` frame per state change |
| GET | `/pomodoro/start` | yes* | Start a focus block if none is running |
| GET | `/pomodoro/stop` | yes* | Stop the running Pomodoro |
| GET | `/pomodoro/skip` | yes* | Skip to the next phase (focus↔break) |
| GET | `/pomodoro/toggle` | yes* | Start if stopped, stop if running |

\* loopback exempt from the token, as above.

### State object (from `/state` and each `/events` frame)

```jsonc
{
  "version": "1.12.0",
  "paused": false,                // OODA capture paused (not the pomodoro)
  "status": "Focus",              // current activity/capture label
  "category": "Deep work",        // activity category name, or null
  "color": "#4C9A8E",             // category color hex, or null
  "todayMs": 5400000,             // total tracked time today, ms
  "startedAt": 1785128000000,     // current activity start, epoch ms
  "pomo": {                       // null when no Pomodoro is running
    "phase": "work",              // "work" | "break" | "long"
    "endsAt": 1785129500000,      // phase end, epoch ms (HOST clock)
    "round": 1                    // 1-based focus round in the current set
  },
  "now": 1785128000000            // host clock at send time (for skew correction)
}
```

### Countdown math (important)
`endsAt` and `now` are the **host's** epoch-ms clock. The puck's own clock will
drift, so don't trust it. On each frame, compute an offset and derive remaining:

```
offset      = now  - millis()                 // once per frame is fine
remaining_ms = endsAt - (millis() + offset)    // clamp at 0
```

Display `remaining_ms` counting down locally between frames; re-sync it every
time a new SSE frame arrives (frames come on phase changes, not every second).

### Example (from a laptop, loopback)
```
curl http://127.0.0.1:7420/ping
curl http://127.0.0.1:7420/state
curl http://127.0.0.1:7420/pomodoro/toggle
curl -N http://127.0.0.1:7420/events        # -N = don't buffer, watch it stream
```
From the puck over WiFi, add `?token=<TOKEN>` to each.

---

## Suggested hardware

| Part | Notes | ~Cost |
|---|---|---|
| ESP32 dev board | Any WROOM-32 devkit (WiFi built in). A Pico W works too but the sketch below assumes ESP32/Arduino. | $5–8 |
| SSD1306 OLED 128×64 (I²C) | Shows phase + big countdown. | $3–4 |
| Rotary encoder w/ push switch (EC11) | Turn = set minutes / pick action; press = start/stop. | $1–2 |
| Passive buzzer | Chime at phase end. | $0.50 |
| Dupont wires / small perfboard | | $2 |
| (optional) 3D-printed or laser-cut shell | Tomato-shaped is on-brand. | — |

Total ≈ **$15–25**.

### Suggested wiring (ESP32 devkit default pinout — change freely in firmware)

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

---

## Firmware behavior spec (what the new chat should build)

1. **Connect** to WiFi (SSID/pass + host IP/port/token in a `config.h`).
2. On boot, `GET /ping` to confirm the host; show "connected"/"searching".
3. **Subscribe** to `/events`; parse each `data:` JSON frame into the state.
4. **Display:**
   - No `pomo` → idle screen ("Press to focus", today's total from `todayMs`).
   - `pomo.phase === "work"` → 🍅 + big `MM:SS` counting down (from `endsAt`/`now`).
   - `break`/`long` → ☕/🌴 + countdown, different accent.
5. **Controls:**
   - Button press (idle) → `GET /pomodoro/start`.
   - Button press (running) → `GET /pomodoro/stop`.
   - Long-press → `GET /pomodoro/skip`.
   - (optional) Turn the knob while idle to preview/choose a length — but note
     length is set in OODA's settings today; a per-start length would need a
     small host-side extension, so treat knob-sets-duration as a stretch goal.
6. **Buzzer**: chime when `phase` changes (compare to the previous frame).
7. **Resilience**: if the SSE socket drops, reconnect with backoff; if the host
   is unreachable, show "offline" and keep retrying. Never hang.

### Libraries (Arduino / PlatformIO)
- `WiFi.h` (ESP32 core)
- `HTTPClient.h` for the one-shot command GETs
- A raw `WiFiClient` for the `/events` stream (read line-by-line; SSE is just
  `data: {json}\n\n` frames — no library needed), **or** an ESP32 SSE/EventSource
  library if you prefer
- `Adafruit_SSD1306` + `Adafruit_GFX` for the OLED
- A lightweight JSON parser: `ArduinoJson`
- An encoder helper: `ESP32Encoder` (or debounce two GPIOs by hand)

### Security notes
- LAN mode is token-gated but the traffic is plain HTTP on your local network —
  fine for a home network, not for untrusted networks. Keep the token private;
  regenerate it by toggling remote control off and back to LAN.
- The endpoint only exposes Pomodoro controls + read-only state — no file, task,
  or account access.

---

## Kickoff prompt for the firmware chat

> Build ESP32 (Arduino) firmware in `firmware/` for a physical OODA Pomodoro
> puck. It talks to the OODA host control endpoint documented in
> `firmware/README.md`: subscribe to `GET /events` (SSE JSON state), and send
> `GET /pomodoro/{start,stop,skip,toggle}` on button input, with `?token=` for
> LAN. OLED shows the phase + countdown (derive remaining from `pomo.endsAt`
> and `now`); buzzer chimes on phase change. Use the wiring table in the README
> as the default pinout and put WiFi/host/token in a `config.h`.
