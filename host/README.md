# OODA desktop host (optional)

OODA runs as a web page, and browsers are **sandboxed from the operating
system** — a website can't read your other apps or your email. This small
[Electron](https://www.electronjs.org/) wrapper removes that limit: it runs
OODA in a desktop window and feeds it **real activity** — the foreground app
and its window title, plus away/idle state — through the same
`window.activity` bridge the app already looks for. Run it and the app's
**Settings → Activity** panel switches to *"Desktop host connected — apps
logged automatically."* No change to the web app is required.

## How it works

- `main.js` samples the **foreground window** every few seconds via
  [`get-windows`](https://www.npmjs.com/package/get-windows) and reads **idle
  time** from Electron's built-in `powerMonitor` (no extra native dependency).
- It forwards each change — `{app, title}`, or `{idle:true}` after ~60s idle —
  to the page. It only sends when the window (or idle state) actually changes,
  so each app switch becomes exactly one timed segment.
- `preload.js` exposes `window.activity.subscribe(cb)`. OODA subscribes on
  startup and **auto-categorizes** every event (Email, Meetings, Coding,
  Design, …) and times it into the daily timeline.

The window title is what makes email tracking work: switching to *"Inbox —
Outlook"* is filed under 📧 Email, *"Zoom Meeting"* under 📹 Meetings, and so
on. Everything stays local — the host never sends anything over the network.

## Run it

```bash
cd host
npm install
npm start          # opens OODA in a desktop window and starts tracking
```

By default it loads the **live deployed app**
(`https://dbulldesign.github.io/OODA/`), so the UI **updates itself** whenever a
new version ships — the app is a PWA that caches itself and shows its own
*"new version available → Update & reload"* prompt. If the site can't be
reached on first launch it falls back to the copy bundled in the app, and once
cached it works offline.

This means you only need to build and reinstall the `.exe` when the **tracking
wrapper itself** changes (`main.js` / `preload.js`) — everyday UI updates arrive
on their own.

Override the target (any URL, or a local file for fully-offline use):

```bash
OODA_URL="https://your-ooda-deploy.example" npm start
OODA_URL="../index.html" npm start
```

## System tray

While running, the host keeps an icon in the Windows **taskbar notification
area (system tray)**:

- Its **tooltip** shows what's being captured right now (e.g. *"OODA —
  capturing: Outlook — Inbox"*, or *"capture paused"*).
- **Right-click** for a menu: the current status, **Pause / Resume capturing**,
  **Show OODA**, and **Quit**.
- **Click** the icon to bring the OODA window back.

Closing the window **minimizes to the tray** rather than quitting, so tracking
keeps running in the background. Pausing tells the app to close the current
segment (stops the clock) until you resume. Quit fully exits from the tray menu.

The **window title** also updates live to what's being captured (e.g.
*"OODA ⏺ Outlook — Inbox"*), so it shows on the **taskbar button**, the title
bar, and in Alt-Tab — visible without hovering the tray.

> Windows 11 hides taskbar-button labels by default (icon only). To see the
> live title text on the taskbar button itself, set *Settings → Personalization
> → Taskbar → Taskbar behaviors → Combine taskbar buttons and hide labels* to
> **Never**. The title bar and Alt-Tab always show it regardless.

## Package a Windows installer

[`electron-builder`](https://www.electron.build/) is wired up to produce a
Windows **NSIS `.exe` installer**. The web app (`index.html`, `sw.js`,
`manifest.json`, `icons/`) is copied in as `extraResources` and loaded from
there when packaged. The app icon is `build/icon.ico`.

```bash
cd host
npm install
npm run pack     # quick unpacked build in dist/ (no installer) — good for testing
npm run dist     # full Windows installer (.exe) in dist/
```

Run this **on Windows** (electron-builder targets the OS it runs on). If you're
not on a Windows machine, use the CI workflow below instead. `get-windows` is a
native module and is kept unpacked from the asar archive so it loads correctly
in the packaged app.

### Build in CI (no Windows machine needed)

`.github/workflows/host-windows.yml` builds the installer on a GitHub-hosted
Windows runner. Push a tag to trigger it:

```bash
git tag host-v1.2.0
git push origin host-v1.2.0
```

The `.exe` is uploaded as a workflow artifact and attached to a GitHub Release
for that tag. You can also run it on demand from the **Actions** tab
(*Build Windows host → Run workflow*).

### Regenerating the icon

`build/icon.ico` is committed, so you don't need to rebuild it. To regenerate
it from the OODA bulb art (renders 16–256px and packs a multi-resolution
`.ico`):

```bash
node build/make-ico.cjs
```

## OS permissions

On **Windows** the foreground app name, window title, and idle time are
available out of the box — no special permission to grant. If anything ever
can't be read, the host degrades gracefully (it simply logs less) rather than
crashing.

The first launch of an unsigned installer triggers a **SmartScreen** warning;
choose *More info → Run anyway*. Code-signing (for a warning-free install) needs
a Windows code-signing certificate and is optional.

## Tuning

Edit the constants at the top of `main.js`:

- `IDLE_SECONDS` (default `60`) — how long with no input before you're marked
  away. Keep it aligned with the app's idle threshold.
- `POLL_MS` (default `4000`) — how often the foreground window is sampled.
