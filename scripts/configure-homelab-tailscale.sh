#!/usr/bin/env bash
# Point homelab UI/API at this machine's Tailscale address (port 8080 = UI + /api proxy).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_DIR="$ROOT/deploy/homelab"
ENV_FILE="$COMPOSE_DIR/.env"
API_ENV="$COMPOSE_DIR/env/api.env"

TAILSCALE_HOST="${1:-}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing deploy/homelab/.env — copy .env.example and set POSTGRES_PASSWORD first." >&2
  exit 1
fi
if [[ ! -f "$API_ENV" ]]; then
  echo "Missing deploy/homelab/env/api.env — copy env/api.env.example first." >&2
  exit 1
fi

if [[ -z "$TAILSCALE_HOST" ]]; then
  TAILSCALE_HOST="$(tailscale ip -4 2>/dev/null | head -1 | tr -d '[:space:]')"
fi
if [[ ! "$TAILSCALE_HOST" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Could not detect Tailscale IPv4. Usage: $0 [100.x.x.x]" >&2
  exit 1
fi

MAGIC_DNS="$(tailscale status --json 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
name = (d.get('Self') or {}).get('DNSName') or ''
print(name.rstrip('.'))
" 2>/dev/null || true)"

set_env_key() {
  local file="$1" key="$2" value="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    echo "${key}=${value}" >>"$file"
  fi
}

WEB_BASE="http://${TAILSCALE_HOST}:8080"
API_BASE="${WEB_BASE}/api"

echo "Configuring homelab Tailscale hub at ${TAILSCALE_HOST} ..."
set_env_key "$ENV_FILE" "VITE_API_BASE_URL" "$API_BASE"

CORS="${WEB_BASE},http://127.0.0.1:8080,http://localhost:8080,http://127.0.0.1:5173,http://localhost:5173"
if [[ -n "$MAGIC_DNS" ]]; then
  CORS="${CORS},http://${MAGIC_DNS}:8080"
fi

set_env_key "$API_ENV" "CORTEX_FRONTEND_URL" "$WEB_BASE"
set_env_key "$API_ENV" "CORS_ORIGINS" "$CORS"
set_env_key "$API_ENV" "GOOGLE_REDIRECT_URI" "${API_BASE}/gmail/oauth/callback"
set_env_key "$API_ENV" "SPOTIFY_REDIRECT_URI" "${API_BASE}/spotify/oauth/callback"
set_env_key "$API_ENV" "MICROSOFT_REDIRECT_URI" "${API_BASE}/microsoft/oauth/callback"
set_env_key "$API_ENV" "NOTION_REDIRECT_URI" "${API_BASE}/notion/oauth/callback"

cd "$COMPOSE_DIR"
docker compose --env-file .env up -d --build cortex-web cortex-api

echo ""
echo "Tailscale homelab ready."
echo "  App (any device on tailnet):  ${WEB_BASE}"
if [[ -n "$MAGIC_DNS" ]]; then
  echo "  MagicDNS:                     http://${MAGIC_DNS}:8080"
fi
echo "  API health:                   ${API_BASE}/health"
echo "  Postgres (dev/Prisma):        postgresql://cortex:<password>@${TAILSCALE_HOST}:5432/cortex"
echo ""
echo "Update OAuth consoles to match redirect URIs in deploy/homelab/env/api.env"
