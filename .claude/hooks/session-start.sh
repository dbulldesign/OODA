#!/bin/bash
# SessionStart hook for the Daybook (OODA) project.
#
# This is a single-file static app with no package manager, tests, or build
# step, so there are no dependencies to install. Instead the hook does the one
# check that matters here: it confirms the JavaScript embedded in index.html
# still parses, so a broken edit is surfaced at session start.
#
# Idempotent, non-interactive, and never fails the session (always exits 0).
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

INDEX="index.html"
if [ ! -f "$INDEX" ]; then
  echo "session-start: $INDEX not found — skipping JS check."
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "session-start: node not available — skipping JS syntax check."
  exit 0
fi

TMP="$(mktemp /tmp/daybook-XXXXXX.js)"
trap 'rm -f "$TMP"' EXIT

# Pull the contents of the first <script>...</script> block out of index.html.
if command -v python3 >/dev/null 2>&1; then
  python3 - "$INDEX" > "$TMP" <<'PY'
import re, sys
html = open(sys.argv[1], encoding="utf-8").read()
m = re.search(r"<script>(.*)</script>", html, re.S)
sys.stdout.write(m.group(1) if m else "")
PY
else
  # Fallback: sed between the script tags.
  sed -n '/<script>/,/<\/script>/p' "$INDEX" | sed '1d;$d' > "$TMP"
fi

if [ ! -s "$TMP" ]; then
  echo "session-start: could not extract embedded script — skipping check."
  exit 0
fi

if node --check "$TMP"; then
  echo "session-start: index.html embedded JS parses cleanly ✅"
else
  echo "session-start: ‼️ index.html embedded JS has a syntax error (see above)."
fi

exit 0
