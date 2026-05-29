#!/usr/bin/env bash
# One-shot: deploy only if origin/main moved (for cron/systemd timer).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="${CORTEX_DEPLOY_BRANCH:-main}"
STATE_FILE="${CORTEX_DEPLOY_STATE:-$ROOT/deploy/homelab/data/.last-deployed-sha}"

cd "$ROOT"
git fetch origin "$BRANCH" --quiet
REMOTE="$(git rev-parse "origin/${BRANCH}")"

LAST=""
[[ -f "$STATE_FILE" ]] && LAST="$(cat "$STATE_FILE")"

if [[ "$REMOTE" == "$LAST" ]]; then
  exit 0
fi

echo "[homelab-deploy-watch] New commit ${REMOTE:0:7} (was ${LAST:-none})"
"$ROOT/scripts/homelab-deploy.sh"
mkdir -p "$(dirname "$STATE_FILE")"
echo "$REMOTE" >"$STATE_FILE"
