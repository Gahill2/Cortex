#!/usr/bin/env bash
# Deploy / refresh Cortex homelab after git changes (run on the hub server).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_DIR="$ROOT/deploy/homelab"
BRANCH="${CORTEX_DEPLOY_BRANCH:-main}"
LOG_TAG="[homelab-deploy $(date -Iseconds)]"

log() { echo "$LOG_TAG $*"; }

cd "$ROOT"

if [[ -d .git ]]; then
  log "Fetching origin/${BRANCH}..."
  git fetch origin "$BRANCH" --quiet
  LOCAL="$(git rev-parse HEAD)"
  REMOTE="$(git rev-parse "origin/${BRANCH}")"
  if [[ "$LOCAL" != "$REMOTE" ]]; then
    log "Updating ${LOCAL:0:7} → ${REMOTE:0:7}"
    git pull --ff-only origin "$BRANCH"
  else
    log "Already at latest ${LOCAL:0:7}"
  fi
fi

if [[ -f "$ROOT/backend/.env" && -x "$ROOT/scripts/sync-homelab-integrations.sh" ]]; then
  log "Syncing integrations from backend/.env..."
  "$ROOT/scripts/sync-homelab-integrations.sh" || true
fi

log "Rebuilding and restarting Docker stack..."
cd "$COMPOSE_DIR"
docker compose --env-file .env up -d --build --remove-orphans

log "Running Prisma migrations..."
cd "$ROOT"
npm run db:migrate --silent 2>/dev/null || npm run db:migrate

for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:8080/api/health/live" >/dev/null 2>&1; then
    log "API healthy."
    exit 0
  fi
  sleep 2
done

log "WARNING: API health check timed out — check: docker compose -f deploy/homelab logs cortex-api"
exit 1
