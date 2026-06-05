#!/usr/bin/env bash
# Fix Radarr / Sonarr / Prowlarr / qBittorrent logins for Tailscale (100.x) access.
# - *arr: no login prompt on tailnet (trust CGNAT + auth off)
# - qBittorrent: set stable Web UI password from env
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAS_ROOT="${NAS_DATA_ROOT:-/mnt/cortex/nas-data}"
ENV_MEDIA="${ENV_MEDIA:-$ROOT/deploy/nas/media-stack/.env}"
QBIT_USER="${QBITTORRENT_USER:-admin}"
QBIT_PASS="${QBITTORRENT_PASSWORD:-GMmr44TI8}"

if [[ -f "$ENV_MEDIA" ]]; then
  QBIT_USER="$(grep -E '^QBITTORRENT_USER=' "$ENV_MEDIA" 2>/dev/null | cut -d= -f2- || true)"
  QBIT_PASS="$(grep -E '^QBITTORRENT_PASSWORD=' "$ENV_MEDIA" 2>/dev/null | cut -d= -f2- || true)"
  QBIT_USER="${QBIT_USER:-admin}"
  QBIT_PASS="${QBIT_PASS:-GMmr44TI8}"
fi

read_key() {
  grep -oP '(?<=<ApiKey>)[^<]+' "$NAS_ROOT/appdata/$1/config.xml" | head -1
}

export RKEY="$(read_key radarr)"
export SKEY="$(read_key sonarr)"
export PKEY="$(read_key prowlarr)"

log() { echo "[media-auth] $*"; }

python3 <<'PY'
import json, os, urllib.request

def put(port, key, path, patch):
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}{path}",
        method="GET",
        headers={"X-Api-Key": key},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        cfg = json.load(r)
    cfg.update(patch)
    body = json.dumps(cfg).encode()
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}{path}",
        data=body,
        method="PUT",
        headers={"X-Api-Key": key, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

patch = {
    "authenticationMethod": "none",
    "authenticationRequired": "disabledForLocalAddresses",
    "trustCgnatIpAddresses": True,
}
for name, port, key in [
    ("Radarr", 7878, os.environ["RKEY"]),
    ("Sonarr", 8989, os.environ["SKEY"]),
]:
    out = put(port, key, "/api/v3/config/host", patch)
    print(
        f"{name}: auth={out.get('authenticationMethod')} "
        f"required={out.get('authenticationRequired')} "
        f"trustCgnat={out.get('trustCgnatIpAddresses')}"
    )

req = urllib.request.Request(
    "http://127.0.0.1:9696/api/v1/config/host",
    method="GET",
    headers={"X-Api-Key": os.environ["PKEY"]},
)
with urllib.request.urlopen(req, timeout=30) as r:
    cfg = json.load(r)
cfg.update(patch)
body = json.dumps(cfg).encode()
req = urllib.request.Request(
    "http://127.0.0.1:9696/api/v1/config/host",
    data=body,
    method="PUT",
    headers={"X-Api-Key": os.environ["PKEY"], "Content-Type": "application/json"},
)
with urllib.request.urlopen(req, timeout=30) as r:
    out = json.load(r)
print(
    f"Prowlarr: auth={out.get('authenticationMethod')} "
    f"required={out.get('authenticationRequired')} "
    f"trustCgnat={out.get('trustCgnatIpAddresses')}"
)
PY

if docker exec cortex-radarr curl -sf -u "${QBIT_USER}:${QBIT_PASS}" --max-time 5 \
  http://127.0.0.1:8089/api/v2/app/version >/dev/null 2>&1; then
  log "qBittorrent login OK (${QBIT_USER})"
else
  TEMP=$(docker logs cortex-qbittorrent 2>&1 | grep -oP 'temporary password is provided for this session: \K\S+' | tail -1 || true)
  if [[ -n "${TEMP:-}" ]]; then
    docker exec cortex-radarr sh -c "
      COOKIE=/tmp/qbc-auth
      curl -sf -c \"\$COOKIE\" -X POST 'http://127.0.0.1:8089/api/v2/auth/login' -d 'username=${QBIT_USER}&password=${TEMP}'
      curl -sf -b \"\$COOKIE\" -X POST 'http://127.0.0.1:8089/api/v2/app/setPreferences' -d 'json={\"web_ui_password\":\"${QBIT_PASS}\"}'
    "
    log "Set qBittorrent password → use ${QBIT_USER} / (from QBITTORRENT_PASSWORD in media-stack/.env)"
  else
    log "WARN: qBittorrent auth failed — run: docker exec cortex-qbittorrent rm -f /config/qBittorrent/lockfile /config/qBittorrent/ipc-socket"
  fi
fi

for app in radarr sonarr prowlarr; do
  f="$NAS_ROOT/appdata/$app/config.xml"
  [[ -f "$f" ]] || continue
  if ! grep -q '<TrustCgnatIpAddresses>True</TrustCgnatIpAddresses>' "$f"; then
    if grep -q '<TrustCgnatIpAddresses>' "$f"; then
      sed -i 's|<TrustCgnatIpAddresses>.*</TrustCgnatIpAddresses>|<TrustCgnatIpAddresses>True</TrustCgnatIpAddresses>|' "$f"
    else
      sed -i 's|</Config>|  <TrustCgnatIpAddresses>True</TrustCgnatIpAddresses>\n</Config>|' "$f"
    fi
  fi
  sed -i \
    -e 's|<AuthenticationMethod>.*</AuthenticationMethod>|<AuthenticationMethod>None</AuthenticationMethod>|' \
    -e 's|<AuthenticationRequired>.*</AuthenticationRequired>|<AuthenticationRequired>DisabledForLocalAddresses</AuthenticationRequired>|' \
    "$f"
done
log "Restart *arr if UI still prompts for login: cd deploy/nas/media-stack && docker compose restart radarr sonarr prowlarr"
log "Done. *arr: no login on Tailscale; qBittorrent: ${QBIT_USER} + QBITTORRENT_PASSWORD in media-stack/.env"
