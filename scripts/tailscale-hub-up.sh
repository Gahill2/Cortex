#!/usr/bin/env bash
# Start Cortex + InsForge on the Tailscale hub (Linux / ZimaBoard).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_DIR="$ROOT/deploy/tailscale-hub"
VENDOR="$ROOT/vendor/insforge/docker-compose.prod.yml"
ENV_FILE="$COMPOSE_DIR/.env"
ENV_EXAMPLE="$COMPOSE_DIR/.env.example"
API_ENV="$COMPOSE_DIR/env/api.env"
API_EXAMPLE="$COMPOSE_DIR/env/api.env.example"

if [[ ! -f "$VENDOR" ]]; then
  echo "vendor/insforge missing — running hub:sync ..."
  bash "$ROOT/scripts/sync-insforge.sh"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "Created deploy/tailscale-hub/.env — set TAILSCALE_HOST and secrets."
fi

if [[ ! -f "$API_ENV" ]]; then
  mkdir -p "$COMPOSE_DIR/env"
  cp "$API_EXAMPLE" "$API_ENV"
  echo "Created deploy/tailscale-hub/env/api.env from example."
fi

cd "$COMPOSE_DIR"
docker compose --env-file .env up -d --build

HOST_NAME="cortex-zima"
if [[ -f "$ENV_FILE" ]]; then
  val="$(grep -E '^[[:space:]]*TAILSCALE_HOST[[:space:]]*=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d ' "'\''')"
  [[ -n "$val" ]] && HOST_NAME="$val"
fi

echo ""
echo "Tailscale hub stack starting (first build can take 15–30+ min)."
echo "  Postgres:        postgresql://postgres:<password>@${HOST_NAME}:5432/cortex"
echo "  InsForge Auth:   http://${HOST_NAME}:7131"
echo "  InsForge API:    http://${HOST_NAME}:7130"
echo "  Cortex API:      http://${HOST_NAME}:4000/api/health"
echo "  Cortex Web:      http://${HOST_NAME}:8080"
echo ""
echo "Other devices: cp backend/.env.tailscale.example backend/.env then npm run db:migrate && npm run dev:web"
echo "Guide: docs/insforge-tailscale.md"
