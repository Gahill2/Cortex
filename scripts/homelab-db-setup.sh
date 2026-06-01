#!/usr/bin/env bash
# Initialize Cortex Postgres on the homelab server (migrate + optional seed).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_DIR="$ROOT/deploy/homelab"
ENV_FILE="$COMPOSE_DIR/.env"

cd "$COMPOSE_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy from .env.example and set POSTGRES_PASSWORD." >&2
  exit 1
fi

echo "Starting Postgres (if not running)…"
docker compose --env-file .env up -d postgres

echo "Waiting for Postgres…"
for i in $(seq 1 30); do
  if docker compose --env-file .env exec -T postgres pg_isready -U cortex -d cortex >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

POSTGRES_USER="${POSTGRES_USER:-cortex}"
POSTGRES_DB="${POSTGRES_DB:-cortex}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

# Read password from .env for host-side migrate
PG_PASS="$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d ' \"')"
ENC_PASS="$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$PG_PASS''', safe=''))")"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${ENC_PASS}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}"

echo "Running Prisma migrations…"
cd "$ROOT/backend"
npm run db:migrate

echo ""
echo "Cortex database ready."
echo "  DATABASE_URL (host): postgresql://${POSTGRES_USER}:****@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}"
echo "  Docker API uses: postgres:5432 inside compose network"
echo ""
echo "Next: docker compose --env-file .env up -d cortex-api cortex-web  (from deploy/homelab)"
