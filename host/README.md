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

By default it loads the sibling `../index.html`. To point at a deployed build:

```bash
OODA_URL="https://your-ooda-deploy.example" npm start
```

## OS permissions

Reading other apps' window titles is privileged on some platforms:

- **macOS** — grant **Screen Recording** (for window titles) and, on some
  versions, **Accessibility** to the app under *System Settings → Privacy &
  Security*. Without them you still get the app name and idle state.
- **Windows / Linux** — generally works out of the box; Wayland Linux may
  restrict titles depending on the compositor.

If a permission is missing the host degrades gracefully (it simply logs less)
rather than crashing.

## Tuning

Edit the constants at the top of `main.js`:

- `IDLE_SECONDS` (default `60`) — how long with no input before you're marked
  away. Keep it aligned with the app's idle threshold.
- `POLL_MS` (default `4000`) — how often the foreground window is sampled.
