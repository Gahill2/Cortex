#!/usr/bin/env bash
# Reset Cortex ↔ Nextcloud: sync env, trusted domains, restart API.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_ENV="$ROOT/deploy/homelab/env/api.env"
COMPOSE_DIR="$ROOT/deploy/homelab"

echo "==> Syncing homelab integration env (Nextcloud + Pi-hole URLs)..."
if [[ -f "$ROOT/backend/.env" ]]; then
  bash "$ROOT/scripts/sync-homelab-integrations.sh"
else
  echo "    (skip sync — no backend/.env; using existing api.env)"
fi

echo "==> Nextcloud trusted domains..."
bash "$ROOT/scripts/nextcloud-trusted-domains.sh"

if [[ ! -f "$COMPOSE_DIR/.env" ]]; then
  echo "Missing deploy/homelab/.env" >&2
  exit 1
fi

echo "==> Restarting cortex-api + cortex-web (loads api.env + Drive UI)..."
cd "$COMPOSE_DIR"
if ! docker compose --env-file .env up -d --build cortex-api cortex-web 2>&1; then
  echo ""
  echo "Docker restart failed (permission?). Run manually:"
  echo "  cd deploy/homelab && docker compose --env-file .env up -d --build cortex-api cortex-web"
  echo "  # or: sudo docker compose ..."
fi

echo "==> Waiting for API health..."
for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${API_PORT:-4000}/api/health/live" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "==> Cloud status probe..."
docker exec cortex-homelab-cortex-api-1 node --input-type=module -e "
import { getCloudStatus } from './dist/src/features/nextcloud/nextcloud-service.js';
const s = await getCloudStatus();
console.log('connected:', s.connected);
console.log('baseUrl:', s.baseUrl);
if (s.message) console.log('message:', s.message);
process.exit(s.connected ? 0 : 1);
" 2>/dev/null || {
  echo "    API image may be stale — run: cd deploy/homelab && docker compose --env-file .env up -d --build cortex-api"
  exit 1
}

echo ""
echo "Cloud connection reset OK. Open Cortex → Cloud tab and refresh."
