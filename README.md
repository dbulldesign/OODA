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

- **Quick-add (natural language)** in the add box — type
  `Draft report tomorrow 2pm ~45m #Work @errand p1` and OODA pulls out the
  **estimate** (`~45m` / `1h`), **#project** (→ channel), **@labels**,
  **priority** (`p1`–`p4`), a **time** (`2pm`, `noon`, `at 15:30`) and a **day**
  (`today`, `tonight`, `tomorrow`, `mon`–`sun`, `next week`); the rest is the
  task name. Dated tasks land on the right day (and push the due string to
  Todoist when auto-create is on). Typing **`#`** pops a **project picker** —
  your Todoist projects and channels drop down and filter as you type; pick one
  to insert it (multi-word names supported).
- **Help guide** — the **?** button in the header (or `?` / Settings → Help &
  guide / the command palette) opens an **illustrated tour** of every feature
  with a built-in **keyboard-shortcuts** section.
- **Command palette** — **⌘K / Ctrl+K** opens a fuzzy launcher for actions
  (sync, views, Fill my day, Settings, Review…) and to jump to any of today's
  tasks. **Right-click** a task row or calendar block for its action menu.
- **Sync activity log** — a running record of Todoist and cloud syncs (and
  merge outcomes); open it from **Settings → Sync log** or by tapping the
  last-synced text in the header.
- **Keyboard shortcuts** (press `?` for the list): `n` new, `/` search,
  `j`/`k` move the selection, `space` start/pause, `x` complete, `e` edit,
  `d` delete (with Undo), `[`/`]` previous/next day, `t` today.
- **Plan / Work / Reflect** phase indicator that follows the state of the day.
- A live "now tracking" clock and a capacity bar that fills with your estimates,
  grouped by colour-coded **channels** (editable).
- **Start timer now** (in the now-tracking card, or the ⌘K palette) tracks a
  task as you go: it drops a live block on the Day view starting at the current
  time and growing until you **Stop**. Name it before, **rename it while it
  runs** (tap the name in the card), or you'll be **prompted on stop**; the
  finished block spans start→stop and the day reflows around it. When you name
  it (in the card or the stop prompt) you can type **`#`** to pick an existing
  project/channel or **create a new one** (a `#`-autocomplete works in the
  quick-add box, the now-tracking name, and the stop prompt).
- Per-task start/pause timers shown as minutes:seconds (rounded up to the next
  whole minute when a task is completed), estimates vs. actuals, and
  over-estimate warnings.
- **Search** the task list, and completed tasks drop into a collapsed
  **Completed** section at the bottom so the list stays focused. With a search
  active, **All days** searches your whole history and jumps you to any day a
  match lives on.
- **Select** (in the list controls) turns on checkboxes for **bulk actions** —
  select-all, move to tomorrow / a date, complete, or delete many tasks at once.
- **Undo** — deleting, completing, or moving a task (individually or in bulk)
  shows a toast with **Undo** so a mistaken tap is one click to reverse.
- **Move a task to another day** — pick a date in the editor, or use **Move to
  tomorrow** in a task's ⋯ menu.
- **Carry overdue** (tools row) sweeps every unfinished task from days before
  today onto today in one tap (de-duplicated).
- **Day templates** (tools row) save a day's set of tasks — with their schedule
  and pinned times — and drop them onto any day later.
- **Pin a time** — 📌 on a calendar block (or *Pin time* in the ⋯ menu) marks it
  fixed so **Auto-arrange**, **Tidy day**, and **Fill my day** flow other blocks
  around it instead of moving it.
- A shutdown note, carry-unfinished-to-tomorrow rollover, CSV/JSON export, and a
  history of past days.
- **Export ICS** (tools row) downloads your scheduled tasks as a calendar file
  (`.ics`) you can import into Google/Apple Calendar. **Backup** exports your
  whole dataset (settings + every day) to a JSON file, and **Restore** loads one
  back — handy for seeding a new device without device sync.
- **Review** (tools row) — a dashboard over the last **7 / 30 days or all time**:
  completion rate, time tracked, your **day streak**, active days,
  **estimate-vs-actual accuracy** (are you over- or under-estimating?), and a
  **time-by-channel** breakdown. Built entirely from data already on your device.
- On phones, a **bottom tab bar** (List / Day / Week / Month) and a **floating +
  button** keep navigation and capture in thumb reach; a **sticky mini-strip**
  shows the running timer and capacity once you scroll past the top, the Day
  timeline has bigger touch targets, and actions give light **haptic** feedback.
- A single **⚙ Settings** button (in the header, plus a footer link) gathers
  everything that used to be a long tools row — **Todoist**, **Device sync**,
  **Lock keys**, **Display**, **Review**, **Templates**, **Carry overdue**,
  **Edit channels**, and **Export / Backup / Restore** — grouped in one dialog.
  Next to the header sync button, **Todoist** and **Sync** status pills show a
  green dot when connected (tap either to manage it).
- Responsive **mobile and desktop** layouts (the Day view goes two-column on wide
  screens; phones get a single-column, touch-sized layout). A **Display** option
  (tools row) adds a **fill-the-screen** wide mode and a **text/UI size** control
  for big monitors, a **Task details** control (reveal each task's details **on
  click / on hover / always**, and pick exactly which fields show — project,
  due, priority, labels, description, links, sub-tasks, channel, time, estimate,
  tracked), a **Density** toggle (comfortable / compact row spacing), and
  an **Accent color** picker that recolors primary actions, the active tab, and
  the FAB. View changes and day navigation **cross-fade** where supported, and on
  pointer devices a task row's action buttons stay subtle until you hover.
- **List / Day / Week views** and **day navigation** (‹ › and **Today** by the
  date). Pick any day to plan it.
  - **List**: sort by manual order, due date, project, channel, or name; filter
    to a single channel / project / @tag.
  - **Day** (Sunsama-style): a time-blocked calendar that **snaps to 30-minute**
    slots. **Drag a task from Unscheduled** onto the timeline, tap-a-task-then-
    tap-a-time, or **tap an empty slot to add a new task** there. **Drag blocks to
    move**, **drag the bottom edge to resize** (sets the estimate), and
    overlapping blocks lay out **side by side**. Blocks are coloured by channel
    with a live "now" line. The header shows a **scheduled-vs-capacity** bar and
    adjustable **day start/end** hours. Turn on **Auto-arrange** to have new/moved
    tasks push conflicting blocks down automatically, or hit **Tidy day** to pack
    everything back-to-back. **Fill my day** auto-places your unscheduled tasks
    into open slots with parameters (start from now or day start, order, break
    length, default length, stop at capacity). **Drag a block back onto the
    Unscheduled list to remove it from the calendar.** Scheduling also works from
    the editor's **Schedule at** field, and the editor has an **↩ Unschedule**
    button to send a task back to Unscheduled. Tapping an event in Day / Week /
    Month opens its details. Over-capacity is flagged in **orange**.
    On **large screens** the Day view becomes a **three-pane** layout —
    Unscheduled · timeline · a **details inspector** for the selected block
    (click to select, double-click to edit) with Start/Complete/Pin/Unschedule/
    Edit/Delete actions; `j`/`k` and the arrow keys drive it from the keyboard.
  - **3-day** (toggle in the Day header, *1 day / 3 days*): the same time-grid
    across three day columns sharing one axis. Drag a block up/down to change its
    time or **across columns to change its day**, drag to Unscheduled to remove
    it, tap an empty slot to add, and tap a column header to jump to that day.
  - **Week**: a 7-day overview of each day's tasks and scheduled times; tap a day
    to jump in and plan it.
- Each task row has a **⋯ menu** (Edit / schedule, Details, Delete) next to the
  ▶ start and ✓ done buttons.
- **Block reminders** — turn on *Remind me 5 min before each scheduled block* in
  **Display** to get a browser notification ahead of each timed task (today).
  Reminders re-arm as you reschedule; they need the tab open and notification
  permission.
- **Light / dark mode** toggle (🌙/☀️ in the header) with an animated circular
  reveal; remembers your choice and defaults to your system preference.
- A **full-screen celebration** when you complete a task (and an extra burst
  when the whole day is done). Pick the style in **Display** → *Completion
  celebration*: **Confetti**, **Fireworks**, **Party 🎉**, **Stars ✨**,
  **Balloons 🎈**, or **None** — tap one to preview. Icons across the app have
  springy hover/press micro-animations (the running ▶ pulses). Everything
  respects `prefers-reduced-motion`.

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
- **Push times back** — enable *Push my scheduled block times back to Todoist* in
  the Todoist dialog and scheduling a synced task in the Day view sets its **due
  time** in Todoist. You can also push a single task on demand from its ⋯ menu
  (*Push time → Todoist*).
- **Complete back** — when "Complete / reopen the task in Todoist…" is enabled,
  checking a synced task off here closes it in Todoist (and un-checking reopens
  it).
- **Sub-tasks** — expanding a synced task's details loads its Todoist
  **sub-tasks** as a checklist; ticking one closes it in Todoist (unticking
  reopens it). Loaded on demand and cached per task.
- **Two-way edit / create** — the pencil button on any task opens an editor for
  the title, **due date** (natural language, e.g. *tomorrow 9am*, *every Mon*),
  **priority**, **labels**, **estimate**, and **project**. For a Todoist-linked
  task, saving pushes those changes back to Todoist (renaming inline pushes too).
  For a local task, tick *Also create this task in Todoist* to create it there.
- **Upcoming & recurring on their due days** — with *Show upcoming & recurring
  tasks on their due days* enabled (default on, in the Todoist dialog), OODA also
  places dated and recurring Todoist tasks onto their **due day** for the next
  three weeks, so they appear in the **Day / Week / Month** views ahead of time
  and move with you if you reschedule them in Todoist. Note that Todoist only
  exposes a recurring task's **next** occurrence, so a daily-repeating task shows
  on its next due day (not literally every day) and rolls forward as you complete
  it. Overdue items stay surfaced on today via the main filter.
- OODA re-pulls automatically on load, **every ~5 minutes in the background**,
  and when you return to the tab; the **⟳ Sync Todoist** header button pulls on
  demand. (Background pulls only run while you're viewing today, so imported
  tasks land on the right day.) Use **Disconnect** to remove the token and stop
  syncing.

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
- Conflict policy is a **per-day merge**: each day record (and the config)
  carries an `updatedAt` stamp, and on pull the **newer** copy of each day wins
  rather than the whole dataset being overwritten. So editing *different* days on
  two devices both survive; if a device held newer days than the cloud it pushes
  the merged result back so both converge. Editing the **same** day on two
  devices at once still resolves to the most recently saved version of that day.
- The gist is **private**, but treat it like any synced data — anyone with the
  token and id could read it. Use **Disconnect** to stop syncing on a device.

## Choosing what syncs from Todoist

The **Which tasks to pull** field in the Todoist dialog is a normal
[Todoist filter](https://todoist.com/help/articles/introduction-to-filters), so
you decide exactly what comes in and there are one-tap presets. Combine terms
with `&` (and) / `|` (or):

| Goal | Filter |
|------|--------|
| Today + anything overdue (default) | `(today \| overdue)` |
| Just today | `today` |
| The week ahead | `7 days` |
| Everything with a label | `@OODA` |
| A single project | `#Work` |
| A project, high priority only | `#Work & p1` |
| Errands due today | `today & @errand` |

Imported tasks land in today's list and map to the **channel** whose name
matches their Todoist **project** (otherwise the first channel).

That filter only drives the *automatic* pull. To grab **any** task on demand,
open the Todoist dialog and click **Browse…**: leave the box blank to list
**all** active tasks (or type any filter), then tick exactly the ones to import.
Tasks are grouped by project and already-imported ones are shown as added.

## Offline

OODA is offline-first and installable (it ships a service worker + web
manifest, so you can "Add to Home Screen"):

- The app **loads and runs with no connection** — add/track/complete tasks as
  usual; everything is saved locally.
- **In-app updates** — when a new version is deployed, the open app (including
  the installed PWA) shows a **"new version available"** bar; tap **Update &
  reload** to activate it and reload into the new version. Each deploy is stamped
  with a unique version (`1.1.<build>`) automatically, and the current version
  number is shown in the tools-row footer and the Settings dialog.
- Todoist changes you make offline (completions, edits, new tasks) are **queued
  and flush automatically when you're back online**; the header shows a count of
  pending changes.
- The header shows your **last sync time** and an **Offline** badge, and the
  **⟳ Sync now** button (or reconnecting) triggers a sync. Offline edits are
  pushed before any pull so they're never clobbered.

## Locking your keys with a password (optional)

By default the Todoist and GitHub tokens are saved in plaintext in this
browser's storage. If you'd rather not leave them readable, click **Lock keys**
in the tools row and set a password:

- The tokens are encrypted with **AES‑GCM**, using a key derived from your
  password via **PBKDF2** (150k iterations). Only the ciphertext is stored on
  the device — the password itself is never saved.
- You **unlock once per session** with your password; the keys then live in
  memory only. Your tasks and time tracking work whether or not you've unlocked.
- There's **no recovery**: if you forget the password, choose **Forget keys** and
  re-enter your tokens. You can **change the password**, **lock now**, or
  **remove encryption** from the same dialog while unlocked.
- While encryption is on, the Todoist token is kept **device-local** (it's no
  longer included in the synced gist), so set it on each device.
