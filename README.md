# OODA

**OODA** — a single-file daily planner that lets you plan your day, track
time against estimates, and close the day out with a short reflection. It runs
entirely in the browser with no build step and no backend.

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

Data is saved to `window.storage` when a host provides it, otherwise to the
browser's `localStorage` — so your tasks, settings, and Todoist token persist
across reloads. It falls back to in-memory only if neither is available (the
footer shows which mode is active).

## What it does

- **Plan / Work / Reflect** phase indicator that follows the state of the day.
- A live "now tracking" clock and a capacity bar that fills with your estimates,
  grouped by colour-coded **channels** (editable).
- Per-task start/pause timers shown as minutes:seconds (rounded up to the next
  whole minute when a task is completed), estimates vs. actuals, and
  over-estimate warnings.
- A shutdown note, carry-unfinished-to-tomorrow rollover, CSV/JSON export, and a
  history of past days.
- **Light / dark mode** toggle (🌙/☀️ in the header) with an animated circular
  reveal; remembers your choice and defaults to your system preference.
- A **confetti + pop** celebration when you complete a task (and an extra burst
  when the whole day is done). Respects `prefers-reduced-motion`.

## Todoist sync

OODA can pull tasks from Todoist and push completions back, talking directly
to the Todoist unified API v1 (`https://api.todoist.com/api/v1`) from the
browser. No server is involved — your token lives only in this device's storage
and is sent only to Todoist.

**Setup**

1. In Todoist go to **Settings → Integrations → Developer** and copy your
   personal **API token**.
2. In OODA click **Todoist** (in the tools row at the bottom), paste the
   token, and choose which tasks to import using a
   [Todoist filter](https://todoist.com/help/articles/introduction-to-filters)
   (default `(today | overdue)`).
3. Click **Sync now**. The token is saved, so afterwards you can use the
   **⟳ Sync Todoist** button in the header to pull anytime.

**Behaviour**

- **Pull** — matching Todoist tasks are imported as OODA tasks. The Todoist
  task's *duration* (when set) becomes the estimate, and its *project* maps to a
  channel of the same name when one exists (otherwise the first channel).
  Synced tasks are marked with a `TD` tag and are de-duplicated on re-sync.
- **Task details** — each synced task shows chips for its **project / section**,
  **due date** (red when overdue), **priority** (P1–P3), and **@labels**. Click
  the chevron to expand and see the **description**, any **links** (from the
  title or description), the full due string, comment count, and an **Open in
  Todoist** link.
- **Complete back** — when "Complete / reopen the task in Todoist…" is enabled,
  checking a synced task off here closes it in Todoist (and un-checking reopens
  it).
- **Two-way edit / create** — the pencil button on any task opens an editor for
  the title, **due date** (natural language, e.g. *tomorrow 9am*, *every Mon*),
  **priority**, **labels**, **estimate**, and **project**. For a Todoist-linked
  task, saving pushes those changes back to Todoist (renaming inline pushes too).
  For a local task, tick *Also create this task in Todoist* to create it there.
- OODA re-pulls automatically on load whenever a token is connected, and the
  **⟳ Sync Todoist** header button pulls on demand. Use **Disconnect** to remove
  the token and stop syncing.

> Note: the integration relies on Todoist's API permitting cross-origin browser
> requests, which it does (`Access-Control-Allow-Origin: *` for authenticated
> requests). The older `rest/v2` endpoints were retired by Todoist in early
> 2026; this app uses the current unified `api/v1` endpoints.

## Sync across devices (mobile ↔ desktop)

Because the app is backend-free, cross-device sync works by mirroring your whole
OODA dataset into a **private GitHub Gist** — free and reliable, no extra
hosting. Your tasks, tracked time, reflections, channels, and Todoist token all
travel; the GitHub token and the gist id stay local to each device.

**Setup**

1. Create a GitHub **personal access token** with the **`gist`** scope at
   [github.com/settings/tokens](https://github.com/settings/tokens) (classic
   token → check *gist*; or a fine-grained token with Gists read/write).
2. Click **Device sync** in the tools row, paste the token, and **Save**. On
   first sync a private gist is created and its **Sync ID** is shown.
3. On your other device, open **Device sync**, paste the **same token** (or any
   token on the same GitHub account) **and the Sync ID**, then **Pull**.

**Behaviour**

- **How often it syncs:** there's no polling clock. A **push** happens ~1.5s
  after any change (the debounce coalesces rapid edits into one write). A
  **pull** happens on page load and each time you return to the tab (skipped
  while a timer is running). You can also **Push**/**Pull** on demand from the
  dialog.
- Conflict policy is **last-write-wins**, so avoid editing the same day on two
  devices at the exact same moment. For typical phone-then-laptop use it's
  seamless.
- The gist is **private**, but treat it like any synced data — anyone with the
  token and id could read it. Use **Disconnect** to stop syncing on a device.
