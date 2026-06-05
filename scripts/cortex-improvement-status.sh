#!/usr/bin/env bash
# One-line improvement loop status (countdown to next wake).
#   npm run dev:improve:status
#   npm run dev:improve:status -- --watch   # refresh every 1s
set -euo pipefail

STATE_DIR="${CORTEX_IMPROVE_STATE_DIR:-$HOME/.local/state/cortex/improvement-loop}"
STATE_FILE="$STATE_DIR/state.json"
WATCH=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --watch|-w) WATCH=1; shift ;;
    -h|--help)
      echo "Usage: $0 [--watch]"
      exit 0
      ;;
    *) echo "Unknown: $1" >&2; exit 1 ;;
  esac
done

print_status() {
  python3 - "$STATE_FILE" <<'PY'
import json, os, sys, time, subprocess

path = sys.argv[1]
running = subprocess.run(
    ["pgrep", "-f", "scripts/cortex-improvement-loop.sh"],
    capture_output=True,
).returncode == 0

data = {}
if os.path.isfile(path):
    try:
        data = json.load(open(path))
    except Exception:
        pass

phase = data.get("phase", "build")
last = data.get("last", "—")
at = data.get("at", "—")
interval = int(data.get("interval_sec") or 120)
next_at = float(data.get("next_wake_at") or 0)
now = time.time()

if not running:
    print(f"[cortex-improve] STOPPED | last wake: {last} @ {at} | next phase would be: {phase}")
    sys.exit(1)

if next_at <= 0:
    rem = interval
    pct = 0
else:
    rem = max(0, int(next_at - now))
    elapsed = max(0, interval - rem)
    pct = min(100, int(elapsed * 100 / interval)) if interval else 0

m, s = divmod(rem, 60)
bar_filled = pct // 10
bar = "█" * bar_filled + "░" * (10 - bar_filled)
print(
    f"[cortex-improve] RUNNING | next: {phase} in {m}:{s:02d} [{bar}] {pct}% | last: {last} @ {at}"
)
PY
}

if [[ "$WATCH" -eq 1 ]]; then
  while true; do
    print_status || true
    sleep 1
  done
else
  print_status
fi
