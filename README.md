# OODA

**Daybook** — a single-file daily planner that lets you plan your day, track
time against estimates, and close the day out with a short reflection. It runs
entirely in the browser with no build step and no backend.

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

Data is saved to `window.storage` when available, with an in-memory fallback
otherwise (the footer shows which mode is active).

## What it does

- **Plan / Work / Reflect** phase indicator that follows the state of the day.
- A live "now tracking" clock and a capacity bar that fills with your estimates,
  grouped by colour-coded **channels** (editable).
- Per-task start/pause timers, estimates vs. actuals, and over-estimate warnings.
- A shutdown note, carry-unfinished-to-tomorrow rollover, CSV/JSON export, and a
  history of past days.

## Todoist sync

Daybook can pull tasks from Todoist and push completions back, talking directly
to the Todoist unified API v1 (`https://api.todoist.com/api/v1`) from the
browser. No server is involved — your token lives only in this device's storage
and is sent only to Todoist.

**Setup**

1. In Todoist go to **Settings → Integrations → Developer** and copy your
   personal **API token**.
2. In Daybook click **Todoist** (in the tools row at the bottom), paste the
   token, and choose which tasks to import using a
   [Todoist filter](https://todoist.com/help/articles/introduction-to-filters)
   (default `(today | overdue)`).
3. Click **Sync now**.

**Behaviour**

- **Pull** — matching Todoist tasks are imported as daybook tasks. The Todoist
  task's *duration* (when set) becomes the estimate, and its *project* maps to a
  daybook channel of the same name when one exists (otherwise the first channel).
  Synced tasks are marked with a `TD` tag and are de-duplicated on re-sync.
- **Complete back** — when "Complete / reopen the task in Todoist…" is enabled,
  checking a synced task off here closes it in Todoist (and un-checking reopens
  it).
- Daybook re-pulls automatically on load whenever a token is connected. Use
  **Disconnect** to remove the token and stop syncing.

> Note: the integration relies on Todoist's API permitting cross-origin browser
> requests, which it does (`Access-Control-Allow-Origin: *` for authenticated
> requests). The older `rest/v2` endpoints were retired by Todoist in early
> 2026; this app uses the current unified `api/v1` endpoints.
