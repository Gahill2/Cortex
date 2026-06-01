#!/usr/bin/env bash
# Deploy / refresh Cortex homelab after git or source changes (run on the hub server).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_DIR="$ROOT/deploy/homelab"
BRANCH="${CORTEX_DEPLOY_BRANCH:-main}"
LOG_TAG="[homelab-deploy $(date -Iseconds)]"
STATE_DIR="$("$ROOT/scripts/homelab-deploy-state-dir.sh")"
STATE_SHA="$STATE_DIR/.last-deployed-sha"
STATE_HASH="$STATE_DIR/.last-deployed-source-hash"
DOCKER="$ROOT/scripts/homelab-docker-compose.sh"

log() { echo "$LOG_TAG $*"; }

mkdir -p "$("$ROOT/scripts/homelab-deploy-state-dir.sh")" >/dev/null

cd "$ROOT"

if [[ -d .git ]]; then
  log "Fetching origin/${BRANCH}..."
  git fetch origin "$BRANCH" --quiet 2>/dev/null || true
  LOCAL="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
  if git rev-parse "origin/${BRANCH}" >/dev/null 2>&1; then
    REMOTE="$(git rev-parse "origin/${BRANCH}")"
    if [[ "$LOCAL" != "$REMOTE" ]] && git merge-base --is-ancestor "$LOCAL" "$REMOTE" 2>/dev/null; then
      log "Fast-forward ${LOCAL:0:7} → ${REMOTE:0:7}"
      git pull --ff-only origin "$BRANCH"
      LOCAL="$REMOTE"
    elif [[ "$LOCAL" != "$REMOTE" ]]; then
      log "Local HEAD ${LOCAL:0:7} (origin/${BRANCH}=${REMOTE:0:7}) — deploying current checkout"
    else
      log "At latest ${LOCAL:0:7}"
    fi
  fi
else
  LOCAL="unknown"
fi

if [[ -f "$ROOT/backend/.env" && -x "$ROOT/scripts/sync-homelab-integrations.sh" ]]; then
  log "Syncing integrations from backend/.env..."
  "$ROOT/scripts/sync-homelab-integrations.sh" || true
fi

log "Rebuilding and restarting Docker stack..."
"$DOCKER" up -d --build --remove-orphans

log "Running Prisma migrations..."
cd "$ROOT"
npm run db:migrate --silent 2>/dev/null || npm run db:migrate || true

for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:8080/api/health/live" >/dev/null 2>&1; then
    log "API healthy."
    echo "$LOCAL" >"$STATE_SHA"
    "$ROOT/scripts/homelab-source-hash.sh" >"$STATE_HASH"
    exit 0
  fi
  sleep 2
done

log "WARNING: API health check timed out — check: docker compose -f deploy/homelab logs cortex-api"
exit 1
