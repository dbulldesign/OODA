#!/bin/bash
# SessionStart hook for the OODA project.
#
# This is a single-file static app with no package manager, tests, or build
# step, so there are no dependencies to install. Instead the hook does the one
# check that matters here: it confirms every <script> block embedded in
# index.html parses, so a broken edit is surfaced at session start.
#
# Idempotent, non-interactive, and never fails the session (always exits 0).
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

INDEX="index.html"
if [ ! -f "$INDEX" ]; then
  echo "session-start: $INDEX not found — skipping JS check."
  exit 0
fi

if ! command -v node >/dev/null 2>&1 || ! command -v python3 >/dev/null 2>&1; then
  echo "session-start: node or python3 unavailable — skipping JS syntax check."
  exit 0
fi

# Check each <script>…</script> block independently (the page has more than one:
# an inline theme bootstrap in <head> plus the main app script). Non-greedy so
# the blocks aren't merged across their boundaries.
python3 - "$INDEX" <<'PY'
import re, sys, subprocess, tempfile, os
html = open(sys.argv[1], encoding="utf-8").read()
blocks = re.findall(r"<script>(.*?)</script>", html, re.S)
if not blocks:
    print("session-start: no <script> blocks found — skipping check.")
    sys.exit(0)
bad = 0
for i, body in enumerate(blocks, 1):
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
        f.write(body); path = f.name
    try:
        r = subprocess.run(["node", "--check", path], capture_output=True, text=True)
        if r.returncode != 0:
            bad += 1
            print(f"session-start: ‼️ script block {i} has a syntax error:")
            print(r.stderr.strip())
    finally:
        os.unlink(path)
if bad == 0:
    print(f"session-start: index.html JS parses cleanly ({len(blocks)} script block(s)) ✅")
PY

exit 0
