#!/usr/bin/env bash
# Execute one improvement-loop phase with Cursor Agent (local workspace).
#   bash scripts/cortex-improvement/run-tick.sh build
#   npm run dev:improve:run -- verify
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE_DIR="${CORTEX_IMPROVE_STATE_DIR:-$HOME/.local/state/cortex/improvement-loop}"
LOCK_FILE="$STATE_DIR/tick.lock"
PHASE="${1:-$(python3 -c "import json; print(json.load(open('$STATE_DIR/state.json')).get('last','build'))" 2>/dev/null || echo build)}"
LOG_DIR="$STATE_DIR/ticks"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$LOG_DIR/${TS}-${PHASE}.log"

mkdir -p "$LOG_DIR"

if [[ -f "$LOCK_FILE" ]]; then
  old_pid="$(cat "$LOCK_FILE" 2>/dev/null || echo "")"
  if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
    echo "[cortex-improve] skip — tick already running (pid $old_pid)"
    exit 0
  fi
  rm -f "$LOCK_FILE"
fi

echo $$ >"$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT INT TERM

first_unchecked() {
  grep -m1 '^- \[ \]' "$ROOT/docs/cortex-dev-loop.md" 2>/dev/null | sed 's/^- \[ \] //' || echo "(none — add items to docs/cortex-dev-loop.md)"
}

common_rules() {
  cat <<'RULES'
Rules for this tick:
- Work in /home/greyhill/Documents/Cortex (this repo). Smallest complete diff.
- Read DESIGN.md for tokens, spacing, and visual hierarchy before UI edits.
- Do NOT commit, push, or open PRs unless the user explicitly asked.
- Do NOT edit deploy/homelab/env/api.env secrets or backend/.env credentials.
- Homelab deploy after API/web changes: npm run server:deploy (never sudo docker compose).
- Verify frontend with npm run typecheck if you touch frontend/.
- Mark completed backlog items [x] in docs/cortex-dev-loop.md with a short evidence note.
RULES
}

build_prompt() {
  local item
  item="$(first_unchecked)"
  cat <<EOF
Cortex continuous improvement — BUILD phase.

$(common_rules)

Backlog: docs/cortex-dev-loop.md
Goals: docs/GOALS.md, docs/goal-prompt-production-ready.md, docs/goal-greyhill-brain-knowledge-os.md

Implement the FIRST unchecked backlog item (or the highest-priority unchecked if the first needs manual/sudo):
  → ${item}

Ship the smallest change that fully completes that item. Update the checkbox when done.
EOF
}

verify_prompt() {
  cat <<EOF
Cortex continuous improvement — VERIFY phase.

$(common_rules)

Run and fix ONLY regressions from recent changes:
1. cd frontend && npm run typecheck
2. cd backend && npm run lint
3. npm run server:docker:doctor
4. curl -sf http://127.0.0.1:8080/api/health | head -c 600

If something fails, fix it. If pre-existing debt remains, add ONE line to docs/cortex-dev-loop.md — do not scope-creep.
EOF
}

polish_prompt() {
  cat <<EOF
Cortex continuous improvement — POLISH phase (Google-app quality).

$(common_rules)

Read docs/goal-google-app-polish.md, DESIGN.md, styles-google-workspace.css.
Pick ONE unchecked item from the polish checklist (or the roughest visible surface).
Max ~5 files. Match Google Calendar/Tasks: hairline borders, 36px controls, inline toolbars, clear empty states.

Priority: Home canvas + At a glance, then Settings integrations, Tasks/Calendar, Mail, AI.
Run npm run typecheck if frontend changed. npm run server:deploy if web bundle changed.
EOF
}

observe_prompt() {
  cat <<EOF
Cortex continuous improvement — OBSERVE phase (@task-observer mindset).

$(common_rules)

1. Skim docs/cortex-dev-loop.md — add OR remove at most ONE backlog item based on real debt or completed work.
2. If skill-observations/log.md exists under task-observer, note at most one insight (or skip if nothing new).
3. Avoid code changes unless a one-line doc fix in docs/ is clearly needed.
EOF
}

prompt_for_phase() {
  case "$PHASE" in
    build) build_prompt ;;
    verify) verify_prompt ;;
    polish) polish_prompt ;;
    observe) observe_prompt ;;
    *) echo "Unknown phase: $PHASE" >&2; exit 1 ;;
  esac
}

can_run_agent() {
  if [[ "${CORTEX_IMPROVE_EXEC:-1}" == "0" ]]; then
    echo "[cortex-improve] exec disabled (CORTEX_IMPROVE_EXEC=0)"
    return 1
  fi
  if ! command -v cursor >/dev/null 2>&1; then
    echo "[cortex-improve] cursor CLI not found — install Cursor or set CORTEX_IMPROVE_EXEC=0"
    return 1
  fi
  local status
  status="$(cursor agent status 2>&1 || true)"
  if echo "$status" | grep -qi 'not logged in' && [[ -z "${CURSOR_API_KEY:-}" ]]; then
    echo "[cortex-improve] cursor agent not logged in — run once: cursor agent login"
    echo "[cortex-improve] or set CURSOR_API_KEY (see scripts/cortex-improvement/.env.example)"
    return 1
  fi
  return 0
}

run_cursor_agent() {
  local prompt_file
  prompt_file="$(mktemp)"
  prompt_for_phase >"$prompt_file"

  {
    echo "=== cortex-improve tick ${PHASE} @ $(date -Iseconds) ==="
    echo "--- prompt ---"
    cat "$prompt_file"
    echo "--- agent output ---"
  } >>"$LOG_FILE"

  cd "$ROOT"
  # -p --print: scriptable; --trust: workspace; --yolo: run shell without prompts
  if cursor agent -p --trust --yolo --output-format text "$(cat "$prompt_file")" >>"$LOG_FILE" 2>&1; then
    echo "[cortex-improve] tick ${PHASE} done → $LOG_FILE"
  else
    echo "[cortex-improve] tick ${PHASE} failed (see $LOG_FILE)" >&2
    rm -f "$prompt_file"
    exit 1
  fi
  rm -f "$prompt_file"
}

if ! can_run_agent; then
  exit 0
fi

echo "[cortex-improve] starting agent (${PHASE})… log: $LOG_FILE"
run_cursor_agent
