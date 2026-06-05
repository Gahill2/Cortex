#!/usr/bin/env bash
# Legacy build-only loop. Prefer: npm run dev:improve-loop (rotating phases).
# See docs/continuous-improvement-loop.md
set -euo pipefail

INTERVAL="${CORTEX_DEV_LOOP_INTERVAL:-900}"
PROMPT='Cortex improvement loop BUILD only (legacy): read docs/cortex-dev-loop.md, implement first unchecked item, deploy if API/web changed, mark [x]. Prefer npm run dev:improve-loop for full cycle.'

echo "Cortex dev loop (build-only) armed every ${INTERVAL}s."
echo "Prefer: npm run dev:improve-loop — see docs/continuous-improvement-loop.md"
echo "Stop: pkill -f cortex-dev-loop"

while true; do
  sleep "$INTERVAL"
  echo "AGENT_LOOP_WAKE_cortex {\"prompt\":\"${PROMPT}\"}"
done
