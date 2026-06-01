#!/usr/bin/env bash
# Deploy only when git HEAD, origin/main, or source tree changed (for cron/systemd timer).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="${CORTEX_DEPLOY_BRANCH:-main}"
STATE_DIR="$("$ROOT/scripts/homelab-deploy-state-dir.sh")"
STATE_SHA="$STATE_DIR/.last-deployed-sha"
STATE_HASH="$STATE_DIR/.last-deployed-source-hash"

mkdir -p "$STATE_DIR"

cd "$ROOT"

LAST_SHA=""
[[ -f "$STATE_SHA" ]] && LAST_SHA="$(cat "$STATE_SHA")"
LAST_HASH=""
[[ -f "$STATE_HASH" ]] && LAST_HASH="$(cat "$STATE_HASH")"

git fetch origin "$BRANCH" --quiet 2>/dev/null || true
HEAD_SHA="$(git rev-parse HEAD 2>/dev/null || echo none)"
ORIGIN_SHA=""
if git rev-parse "origin/${BRANCH}" >/dev/null 2>&1; then
  ORIGIN_SHA="$(git rev-parse "origin/${BRANCH}")"
fi
SOURCE_HASH="$("$ROOT/scripts/homelab-source-hash.sh")"

# Deploy if: never deployed, HEAD moved, origin moved ahead of last deploy, or source files changed
NEED=0
REASON=""

if [[ -z "$LAST_SHA" && -z "$LAST_HASH" ]]; then
  NEED=1
  REASON="first deploy"
elif [[ "$HEAD_SHA" != "$LAST_SHA" ]]; then
  NEED=1
  REASON="HEAD ${HEAD_SHA:0:7} (was ${LAST_SHA:0:7})"
elif [[ -n "$ORIGIN_SHA" && "$ORIGIN_SHA" != "$LAST_SHA" ]]; then
  NEED=1
  REASON="origin/${BRANCH} ${ORIGIN_SHA:0:7} (deployed ${LAST_SHA:0:7})"
elif [[ "$SOURCE_HASH" != "$LAST_HASH" ]]; then
  NEED=1
  REASON="source tree changed (uncommitted edits)"
fi

if [[ "$NEED" -eq 0 ]]; then
  exit 0
fi

echo "[homelab-deploy-watch] Deploying: $REASON"
"$ROOT/scripts/homelab-deploy.sh"
