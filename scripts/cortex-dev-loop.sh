#!/usr/bin/env bash
# Self-paced Cortex dev loop — emits wake sentinel for Cursor agent (see docs/cortex-dev-loop.md).
set -euo pipefail

INTERVAL="${CORTEX_DEV_LOOP_INTERVAL:-900}"
PROMPT='Continue Cortex dev loop: read docs/cortex-dev-loop.md, implement the first unchecked item, deploy if API/web changed, update checkboxes. Do not ask the user unless Azure/Microsoft secrets are required.'

echo "Cortex dev loop armed (fallback every ${INTERVAL}s). Prompt runs on each wake."
echo "Stop: kill this shell or pkill -f cortex-dev-loop"

while true; do
  sleep "$INTERVAL"
  echo "AGENT_LOOP_WAKE_cortex {\"prompt\":\"${PROMPT}\"}"
done
