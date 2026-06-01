#!/usr/bin/env bash
# Restart Cortex homelab with freshly built images (avoids sudo-owned container permission errors).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_DIR="$ROOT/deploy/homelab"
NETWORK="cortex-homelab_default"
API_ENV="$COMPOSE_DIR/env/api.env"
NGINX_PROD="$COMPOSE_DIR/nginx/production.conf"

cd "$COMPOSE_DIR"

# Load postgres creds for DATABASE_URL
set -a
# shellcheck source=/dev/null
source .env
set +a

echo "Building images..."
docker compose --env-file .env build cortex-api cortex-web

echo "Starting postgres if needed..."
docker compose --env-file .env up -d postgres

if [[ -f "$ROOT/backend/.env" && -x "$ROOT/scripts/sync-homelab-integrations.sh" ]]; then
  echo "Syncing integrations..."
  "$ROOT/scripts/sync-homelab-integrations.sh" || true
fi

DB_URL="postgresql://${POSTGRES_USER:-cortex}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-cortex}"

echo "Recreating cortex-api-v2..."
docker rm -f cortex-api-v2 2>/dev/null || true
docker run -d \
  --name cortex-api-v2 \
  --network "$NETWORK" \
  --env-file "$API_ENV" \
  -e "DATABASE_URL=$DB_URL" \
  -e HOST=0.0.0.0 \
  -e PORT=4000 \
  -e CORTEX_API_DATA_DIR=/app/data \
  -v "$COMPOSE_DIR/data/api:/app/data" \
  -v "$ROOT:/vault:rw" \
  --add-host host.docker.internal:host-gateway \
  --restart unless-stopped \
  cortex-homelab-cortex-api:latest

echo "Recreating cortex-web-v2 on :8083..."
docker rm -f cortex-web-v2 2>/dev/null || true
docker run -d \
  --name cortex-web-v2 \
  --network "$NETWORK" \
  -p 8083:80 \
  -v "$NGINX_PROD:/etc/nginx/conf.d/default.conf:ro" \
  --restart unless-stopped \
  cortex-homelab-cortex-web:latest

echo "Pointing Tailscale Serve to :8083..."
tailscale serve --bg --https=443 http://127.0.0.1:8083 2>/dev/null || true

echo ""
docker ps --filter name=cortex-api-v2 --filter name=cortex-web-v2 --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo ""
curl -sf http://127.0.0.1:8083/api/health/live && echo " — local OK" || echo "Health check failed"
echo "Production: https://cortex.tail4f977b.ts.net"
