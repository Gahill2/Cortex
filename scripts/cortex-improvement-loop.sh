#!/usr/bin/env bash
# Rotating Cortex improvement loop — Build → Verify → Polish → Observe.
# See docs/continuous-improvement-loop.md
#
#   npm run dev:improve-loop              # background wakes every 2m (default)
#   npm run dev:improve:status            # countdown to next wake
#   CORTEX_IMPROVE_INTERVAL=900 npm run dev:improve-loop   # slower override
#   npm run dev:improve:once              # one phase, then exit
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE_DIR="${CORTEX_IMPROVE_STATE_DIR:-$HOME/.local/state/cortex/improvement-loop}"
STATE_FILE="$STATE_DIR/state.json"
INTERVAL="${CORTEX_IMPROVE_INTERVAL:-120}"
PROGRESS_LOG_EVERY="${CORTEX_IMPROVE_PROGRESS_SEC:-15}"
ONCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --once) ONCE=1; shift ;;
    --interval) INTERVAL="${2:?}"; shift 2 ;;
    --interval=*) INTERVAL="${1#*=}"; shift ;;
    -h|--help)
      echo "Usage: $0 [--once] [--interval 120]"
      echo "Phases: build → verify → polish → observe (rotating)"
      echo "Status: npm run dev:improve:status"
      exit 0
      ;;
    *) echo "Unknown: $1" >&2; exit 1 ;;
  esac
done

mkdir -p "$STATE_DIR"

mark_stopped() {
  python3 -c "
import json, os
p = '$STATE_FILE'
d = {}
if os.path.isfile(p):
    try: d = json.load(open(p))
    except Exception: pass
d['running'] = False
d.pop('next_wake_at', None)
d.pop('remaining_sec', None)
d.pop('percent', None)
open(p, 'w').write(json.dumps(d, indent=2))
" 2>/dev/null || true
}

trap mark_stopped EXIT INT TERM

read_state() {
  if [[ -f "$STATE_FILE" ]]; then
    python3 -c "import json; print(json.load(open('$STATE_FILE')).get('phase','build'))" 2>/dev/null || echo build
  else
    echo build
  fi
}

write_state_after_wake() {
  local current="$1"
  local next
  case "$current" in
    build) next=verify ;;
    verify) next=polish ;;
    polish) next=observe ;;
    *) next=build ;;
  esac
  python3 -c "
import json, os, time
os.makedirs('$STATE_DIR', exist_ok=True)
now = time.time()
interval = int('$INTERVAL')
d = {
    'phase': '$next',
    'last': '$current',
    'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
    'next_wake_at': now + interval,
    'interval_sec': interval,
    'remaining_sec': interval,
    'percent': 0,
    'running': True,
    'pid': os.getpid(),
}
open('$STATE_FILE', 'w').write(json.dumps(d, indent=2))
"
}

update_countdown() {
  python3 -c "
import json, os, time
p = '$STATE_FILE'
if not os.path.isfile(p):
    exit(0)
d = json.load(open(p))
interval = int(d.get('interval_sec') or $INTERVAL)
next_at = float(d.get('next_wake_at') or 0)
if next_at <= 0:
    exit(0)
now = time.time()
rem = max(0, int(next_at - now))
elapsed = max(0, interval - rem)
pct = min(100, int(elapsed * 100 / interval)) if interval else 0
d['remaining_sec'] = rem
d['percent'] = pct
d['running'] = True
open(p, 'w').write(json.dumps(d, indent=2))
" 2>/dev/null || true
}

log_progress_line() {
  bash "$ROOT/scripts/cortex-improvement-status.sh" 2>/dev/null || true
}

sleep_until_next_wake() {
  local next_phase
  next_phase="$(read_state)"
  local end=$(( $(date +%s) + INTERVAL ))
  local last_log=0
  local last_pct=-1

  while (( $(date +%s) < end )); do
    update_countdown
    local now=$(date +%s)
    local rem=$(( end - now ))
    local elapsed=$(( INTERVAL - rem ))
    local pct=$(( elapsed * 100 / INTERVAL ))

    if (( now - last_log >= PROGRESS_LOG_EVERY )) || (( pct / 25 > last_pct / 25 )); then
      log_progress_line
      last_log=$now
      last_pct=$pct
    fi
    sleep 1
  done
  update_countdown
}

prompt_for_phase() {
  case "$1" in
    build)
      cat <<EOF
Cortex improvement loop — BUILD phase. Read docs/continuous-improvement-loop.md and docs/cortex-dev-loop.md. Implement the first unchecked backlog item (smallest complete diff). If API/web changed run npm run server:deploy from repo root (no sudo). Mark item [x] with evidence. Do not commit unless user asked.
EOF
      ;;
    verify)
      cat <<EOF
Cortex improvement loop — VERIFY phase. Read docs/continuous-improvement-loop.md. Run: frontend typecheck, backend lint, npm run server:docker:doctor, curl API health on :8080. Fix only regressions from the last build. Add new backlog lines to docs/cortex-dev-loop.md for anything else. Do not commit unless user asked.
EOF
      ;;
    polish)
      cat <<EOF
Cortex improvement loop — POLISH phase. Read docs/goal-google-app-polish.md, DESIGN.md, and styles-google-workspace.css. Ship ONE Google Workspace–quality UI improvement (max ~5 files): canvas/widgets, Tasks/Calendar density, Settings integrations, command palette, or Mail list. Hairline borders, 8px rhythm, Lucide icons, clear empty/loading states. Run typecheck if frontend changed. npm run server:deploy if web changed. Do not commit unless user asked.
EOF
      ;;
    observe)
      cat <<EOF
Cortex improvement loop — OBSERVE phase (@task-observer). Read docs/continuous-improvement-loop.md and skill-observations/log.md if present. Log at most one process insight; add/remove at most one backlog item in docs/cortex-dev-loop.md. No code changes unless trivial doc fix. Do not commit unless user asked.
EOF
      ;;
    *)
      prompt_for_phase build
      return
      ;;
  esac
}

emit_wake() {
  local phase="$1"
  local prompt
  prompt="$(prompt_for_phase "$phase")"
  write_state_after_wake "$phase"
  local payload
  payload="$(PHASE="$phase" PROMPT="$prompt" python3 -c 'import json,os; print(json.dumps({"phase":os.environ["PHASE"],"prompt":os.environ["PROMPT"]}))')"
  echo "AGENT_LOOP_WAKE_cortex_improve ${payload}"
}

run_tick() {
  local phase
  phase="$(read_state)"
  echo "[cortex-improve] phase=${phase} ($(date -Iseconds))"
  emit_wake "$phase"
  if [[ "${CORTEX_IMPROVE_EXEC:-0}" == "1" ]]; then
    if bash "$ROOT/scripts/cortex-improvement/run-tick.sh" "$phase"; then
      echo "[cortex-improve] CLI agent finished phase=${phase} ($(date -Iseconds))"
    else
      echo "[cortex-improve] CLI agent failed or skipped phase=${phase} ($(date -Iseconds))" >&2
    fi
  else
    echo "[cortex-improve] chat mode — Cursor chat agent runs this tick (act on AGENT_LOOP_WAKE_cortex_improve above)"
  fi
  log_progress_line
}

if [[ "$ONCE" -eq 1 ]]; then
  trap - EXIT INT TERM
  run_tick
  exit 0
fi

echo "[cortex-improve] Armed — wake every ${INTERVAL}s (state: $STATE_FILE)"
echo "[cortex-improve] Mode: chat (default) — Cursor chat executes each AGENT_LOOP_WAKE_cortex_improve"
echo "[cortex-improve] Progress: npm run dev:improve:status  (watch: npm run dev:improve:watch)"
echo "[cortex-improve] CLI agent instead: CORTEX_IMPROVE_EXEC=1 npm run dev:improve-loop"
echo "[cortex-improve] Stop: pkill -f cortex-improvement-loop.sh"
run_tick

while true; do
  sleep_until_next_wake
  run_tick
done
