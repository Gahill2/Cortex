#!/usr/bin/env bash
# Copy OAuth + SMTP secrets from backend/.env → deploy/homelab/env/api.env
# (Linux equivalent of scripts/sync-homelab-integrations.ps1)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_ENV="$ROOT/backend/.env"
API_ENV="$ROOT/deploy/homelab/env/api.env"

if [[ ! -f "$BACKEND_ENV" ]]; then
  echo "Missing backend/.env — copy your old env file there first." >&2
  exit 1
fi
if [[ ! -f "$API_ENV" ]]; then
  echo "Missing deploy/homelab/env/api.env — run homelab setup first." >&2
  exit 1
fi

# shellcheck disable=SC1090
source_env() {
  local file="$1"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    [[ -z "$line" ]] && continue
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      local key="${BASH_REMATCH[1]}"
      local val="${BASH_REMATCH[2]}"
      val="${val%\"}"; val="${val#\"}"
      val="${val%\'}"; val="${val#\'}"
      export "$key=$val"
    fi
  done <"$file"
}

upsert_key() {
  local file="$1" key="$2" value="$3"
  [[ -z "$value" ]] && return
  # Quote values with spaces (e.g. Gmail app passwords)
  if [[ "$value" == *" "* ]]; then
    value="\"${value}\""
  fi
  local tmp
  tmp="$(mktemp)"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    grep -v "^${key}=" "$file" >"$tmp" || true
  else
    cp "$file" "$tmp"
  fi
  printf '%s=%s\n' "$key" "$value" >>"$tmp"
  mv "$tmp" "$file"
}

source_env "$BACKEND_ENV"

KEYS=(
  SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS
  GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET
  MICROSOFT_CLIENT_ID MICROSOFT_CLIENT_SECRET
  SPOTIFY_CLIENT_ID SPOTIFY_CLIENT_SECRET
  NOTION_CLIENT_ID NOTION_CLIENT_SECRET
  NOTION_TOKEN NOTION_PERSONAL_TOKEN NOTION_INTERNAL_TOKEN
  ANTHROPIC_API_KEY KIMI_API_KEY MOONSHOT_API_KEY KIMI_MODEL KIMI_BASE_URL OPENAI_API_KEY OPENAI_MODEL
  CANVA_APP_ID CANVA_CLIENT_ID CANVA_APP_ORIGIN CANVA_CLIENT_SECRET
  JWT_SECRET CORTEX_ENCRYPTION_KEY
  HOMELAB_SERVICE_HOST HOMELAB_NEXTCLOUD_URL HOMELAB_JELLYFIN_URL HOMELAB_IMMICH_URL
  HOMELAB_PROMETHEUS_URL HOMELAB_GRAFANA_URL
  NEXTCLOUD_URL NEXTCLOUD_USERNAME NEXTCLOUD_PASSWORD NEXTCLOUD_APP_PASSWORD
)

for k in "${KEYS[@]}"; do
  v="${!k:-}"
  if [[ -n "$v" ]]; then
    upsert_key "$API_ENV" "$k" "$v"
  fi
done

# Homelab: UI + API proxy on :8080 (or HTTPS MagicDNS after tailscale serve)
WEB_BASE="${CORTEX_FRONTEND_URL:-}"
if [[ -z "$WEB_BASE" ]]; then
  MAGIC_DNS="$(tailscale status --json 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
print((d.get('Self') or {}).get('DNSName', '').rstrip('.'))
" 2>/dev/null || true)"
  IP="$(tailscale ip -4 2>/dev/null | head -1 | tr -d '[:space:]')"
  if tailscale serve status 2>/dev/null | grep -q .; then
    WEB_BASE="https://${MAGIC_DNS}"
  elif [[ -n "$IP" ]]; then
    WEB_BASE="http://${IP}:8080"
  else
    WEB_BASE="http://127.0.0.1:8080"
  fi
fi
API_BASE="${WEB_BASE}/api"

upsert_key "$API_ENV" "CORTEX_FRONTEND_URL" "$WEB_BASE"
upsert_key "$API_ENV" "GOOGLE_REDIRECT_URI" "${API_BASE}/gmail/oauth/callback"
upsert_key "$API_ENV" "MICROSOFT_REDIRECT_URI" "${API_BASE}/microsoft/oauth/callback"
upsert_key "$API_ENV" "SPOTIFY_REDIRECT_URI" "${API_BASE}/spotify/oauth/callback"
upsert_key "$API_ENV" "NOTION_REDIRECT_URI" "${API_BASE}/notion/oauth/callback"

CORS="${WEB_BASE},http://127.0.0.1:8080,http://localhost:8080,http://127.0.0.1:5173,http://localhost:5173"
MAGIC_DNS="$(tailscale status --json 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
print((d.get('Self') or {}).get('DNSName', '').rstrip('.'))
" 2>/dev/null || true)"
IP="$(tailscale ip -4 2>/dev/null | head -1 | tr -d '[:space:]')"
[[ -n "$MAGIC_DNS" ]] && CORS="${CORS},http://${MAGIC_DNS}:8080,https://${MAGIC_DNS}"
[[ -n "$IP" ]] && CORS="${CORS},http://${IP}:8080"
upsert_key "$API_ENV" "CORS_ORIGINS" "$CORS"

# Nextcloud: API container uses host gateway; phones/browsers use Tailscale IP
TS_IP_NC="$(tailscale ip -4 2>/dev/null | head -1 | tr -d '[:space:]' || true)"
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}' | tr -d '[:space:]' || true)"
upsert_key "$API_ENV" "NEXTCLOUD_URL" "http://host.docker.internal:8081"
if [[ -n "$TS_IP_NC" ]]; then
  upsert_key "$API_ENV" "HOMELAB_NEXTCLOUD_URL" "http://${TS_IP_NC}:8081"
elif [[ -n "$LAN_IP" ]]; then
  upsert_key "$API_ENV" "HOMELAB_NEXTCLOUD_URL" "http://${LAN_IP}:8081"
fi

if [[ -n "${NEXTCLOUD_USERNAME:-}" ]]; then
  echo "Nextcloud: run scripts/nextcloud-trusted-domains.sh if Cloud tab shows trusted domain errors."
fi

if [[ -n "${SMTP_USER:-}" && -n "${SMTP_PASS:-}" ]]; then
  upsert_key "$API_ENV" "CORTEX_OTP_DEV_FALLBACK" "0"
  echo "SMTP found — disabled CORTEX_OTP_DEV_FALLBACK (real email OTP)."
else
  echo "No SMTP_USER/SMTP_PASS in backend/.env — keeping on-screen OTP fallback."
fi

# Pi-hole + iCloud (NAS stacks)
PIHOLE_ENV="$ROOT/deploy/nas/pihole/.env"
if [[ -f "$PIHOLE_ENV" ]]; then
  source_env "$PIHOLE_ENV"
  [[ -n "${PIHOLE_WEBPASSWORD:-}" ]] && upsert_key "$API_ENV" "HOMELAB_PIHOLE_API_PASSWORD" "$PIHOLE_WEBPASSWORD"
  TS_IP="$(tailscale ip -4 2>/dev/null | head -1 | tr -d '[:space:]' || true)"
  if [[ -n "$TS_IP" ]]; then
    upsert_key "$API_ENV" "HOMELAB_PIHOLE_URL" "http://${TS_IP}:8090"
  elif [[ -n "${PIHOLE_TAILSCALE_IP:-}" ]]; then
    upsert_key "$API_ENV" "HOMELAB_PIHOLE_URL" "http://${PIHOLE_TAILSCALE_IP}:8090"
  fi
fi
ICLOUD_ENV="$ROOT/deploy/nas/icloudpd/.env"
if [[ -f "$ICLOUD_ENV" ]]; then
  source_env "$ICLOUD_ENV"
  [[ -n "${ICLOUD_APPLE_ID:-}" ]] && upsert_key "$API_ENV" "HOMELAB_ICLOUD_APPLE_ID" "$ICLOUD_APPLE_ID"
fi

echo ""
echo "Synced integration keys → deploy/homelab/env/api.env"
echo "  Web:     $WEB_BASE"
echo "  Gmail:   ${API_BASE}/gmail/oauth/callback"
echo "  Outlook: ${API_BASE}/microsoft/oauth/callback"
echo ""
echo "Add those redirect URIs in Google Cloud + Azure if not already registered."
echo "Restart API:"
echo "  cd deploy/homelab && docker compose --env-file .env up -d cortex-api"
