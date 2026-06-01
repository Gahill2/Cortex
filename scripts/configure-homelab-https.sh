#!/usr/bin/env bash
# After Tailscale Serve is enabled on your tailnet, expose Cortex with HTTPS and rebuild web/API env.
# 1. Enable Serve: open the URL from `tailscale serve 8080` (admin console link)
# 2. Run: tailscale serve --bg 8080
# 3. Run: ./scripts/configure-homelab-https.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_DIR="$ROOT/deploy/homelab"
ENV_FILE="$COMPOSE_DIR/.env"
API_ENV="$COMPOSE_DIR/env/api.env"

MAGIC_DNS="$(tailscale status --json 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
print((d.get('Self') or {}).get('DNSName', '').rstrip('.'))
" 2>/dev/null || true)"

# Optional override from deploy/homelab/.env (CORTEX_PUBLIC_HOST=cortex.yourdomain.com)
if [[ -f "$ENV_FILE" ]]; then
  CUSTOM_HOST="$(grep -E '^CORTEX_PUBLIC_HOST=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d ' \"' || true)"
  [[ -n "$CUSTOM_HOST" ]] && PUBLIC_HOST="$CUSTOM_HOST"
fi
PUBLIC_HOST="${PUBLIC_HOST:-$MAGIC_DNS}"

if [[ -z "$PUBLIC_HOST" ]]; then
  echo "Could not read MagicDNS name. Is Tailscale connected?" >&2
  exit 1
fi

if ! tailscale serve status 2>/dev/null | grep -q .; then
  echo "Tailscale Serve is not configured on this machine yet." >&2
  echo "  1. Enable Serve on your tailnet (visit the link from: tailscale serve 8080)" >&2
  echo "  2. tailscale serve --bg 8080" >&2
  echo "  3. Re-run this script" >&2
  exit 1
fi

WEB_BASE="https://${PUBLIC_HOST}"
API_BASE="${WEB_BASE}/api"

set_env_key() {
  local file="$1" key="$2" value="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    echo "${key}=${value}" >>"$file"
  fi
}

echo "Configuring homelab for HTTPS at ${WEB_BASE} ..."

set_env_key "$ENV_FILE" "VITE_API_BASE_URL" ""

IP="$(tailscale ip -4 2>/dev/null | head -1 | tr -d '[:space:]')"
CORS="${WEB_BASE}"
[[ -n "$MAGIC_DNS" ]] && CORS="${CORS},http://${MAGIC_DNS}:8080"
[[ -n "$IP" ]] && CORS="${CORS},http://${IP}:8080,https://${IP}"
CORS="${CORS},http://127.0.0.1:8080,http://localhost:8080"

set_env_key "$API_ENV" "CORTEX_FRONTEND_URL" "$WEB_BASE"
set_env_key "$API_ENV" "CORS_ORIGINS" "$CORS"
set_env_key "$API_ENV" "GOOGLE_REDIRECT_URI" "${API_BASE}/gmail/oauth/callback"
set_env_key "$API_ENV" "SPOTIFY_REDIRECT_URI" "${API_BASE}/spotify/oauth/callback"
set_env_key "$API_ENV" "MICROSOFT_REDIRECT_URI" "${API_BASE}/microsoft/oauth/callback"
set_env_key "$API_ENV" "NOTION_REDIRECT_URI" "${API_BASE}/notion/oauth/callback"

cd "$COMPOSE_DIR"
docker compose --env-file .env up -d --build cortex-web cortex-api

echo ""
echo "HTTPS homelab ready."
echo "  App:  ${WEB_BASE}"
echo "  API:  ${API_BASE}/health"
echo ""
echo "Update Google/OAuth consoles to use https:// redirect URIs in deploy/homelab/env/api.env"
