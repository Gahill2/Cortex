#!/usr/bin/env bash
# Wire Radarr + Sonarr + Prowlarr + qBittorrent for Jellyfin (/media/movies, /media/tv).
# Run after media-stack is up: npm run media:setup-arr
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAS_ROOT="${NAS_DATA_ROOT:-/mnt/cortex/nas-data}"
ENV_MEDIA="${ENV_MEDIA:-$ROOT/deploy/nas/media-stack/.env}"
QBIT_USER="${QBITTORRENT_USER:-admin}"
QBIT_PASS="${QBITTORRENT_PASSWORD:-GMmr44TI8}"

read_key() {
  grep -oP '(?<=<ApiKey>)[^<]+' "$NAS_ROOT/appdata/$1/config.xml" | head -1
}

PKEY=$(read_key prowlarr)
RKEY=$(read_key radarr)
SKEY=$(read_key sonarr)

log() { echo "[media-arr] $*"; }
api() { curl -sf "$@"; }

if ! docker ps --format '{{.Names}}' | grep -qx cortex-gluetun; then
  log "Start media stack: cd deploy/nas/media-stack && docker compose --env-file .env up -d"
  exit 1
fi

if docker exec cortex-gluetun sh -c 'wget -qO- --timeout=8 https://am.i.mullvad.net/json 2>/dev/null' | grep -q '"ip"'; then
  ip=$(docker exec cortex-gluetun wget -qO- --timeout=8 https://am.i.mullvad.net/json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ip','?'), d.get('city',''), d.get('country',''))" 2>/dev/null || echo "?")
  log "VPN (Gluetun) exit IP: $ip"
else
  log "WARN: could not verify VPN IP — check: docker logs cortex-gluetun"
fi

if ! docker exec cortex-radarr curl -sf -o /dev/null --max-time 5 http://127.0.0.1:8089/ 2>/dev/null; then
  log "qBittorrent UI down — clearing stale lock (common after unclean stop)"
  docker exec cortex-qbittorrent rm -f /config/qBittorrent/lockfile /config/qBittorrent/ipc-socket 2>/dev/null || true
  sleep 4
fi
if ! docker exec cortex-radarr curl -sf -o /dev/null --max-time 5 http://127.0.0.1:8089/ 2>/dev/null; then
  log "WARN: qBittorrent web UI not responding on :8089"
  log "  Fix: cd deploy/nas/media-stack && docker compose --env-file .env restart qbittorrent"
  log "  Or: npm run server:docker:fix-once && docker compose restart"
fi

# Ensure Web UI password matches QBIT_PASS (avoids random temp password each restart)
if docker exec cortex-radarr curl -sf -u "${QBIT_USER}:${QBIT_PASS}" --max-time 5 http://127.0.0.1:8089/api/v2/app/version >/dev/null 2>&1; then
  log "qBittorrent API OK (${QBIT_USER})"
else
  TEMP=$(docker logs cortex-qbittorrent 2>&1 | grep -oP 'temporary password is provided for this session: \K\S+' | tail -1 || true)
  if [[ -n "${TEMP:-}" ]]; then
    docker exec cortex-radarr sh -c "
      COOKIE=/tmp/qbc-setup
      curl -sf -c \"\$COOKIE\" -X POST 'http://127.0.0.1:8089/api/v2/auth/login' -d 'username=${QBIT_USER}&password=${TEMP}'
      curl -sf -b \"\$COOKIE\" -X POST 'http://127.0.0.1:8089/api/v2/app/setPreferences' -d 'json={\"web_ui_password\":\"${QBIT_PASS}\"}'
    " && log "Set qBittorrent Web UI password from QBITTORRENT_PASSWORD"
  else
    log "WARN: qBittorrent auth failed — set Web UI password in UI, then re-run npm run media:setup-arr"
  fi
fi

python3 <<PY
import json, urllib.request, urllib.error

PKEY, RKEY, SKEY = "$PKEY", "$RKEY", "$SKEY"
QUSER, QPASS = "$QBIT_USER", "$QBIT_PASS"

def req(url, key, method="GET", data=None):
    h = {"X-Api-Key": key, "Content-Type": "application/json"}
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode(errors="replace")
        raise SystemExit(f"HTTP {e.code} {url}: {err[:300]}")

# --- Root folders ---
for name, key, path, port in [
    ("Radarr", RKEY, "/media/movies", 7878),
    ("Sonarr", SKEY, "/media/tv", 8989),
]:
    roots = req(f"http://127.0.0.1:{port}/api/v3/rootfolder", key)
    if not any(r.get("path") == path for r in roots):
        req(f"http://127.0.0.1:{port}/api/v3/rootfolder", key, "POST", {
            "path": path,
            "accessible": True,
            "freeSpace": 1000000000000,
            "unmappedFolders": [],
        })
        print(f"Added {name} root: {path}")
    else:
        print(f"{name} root OK: {path}")

# --- qBittorrent client ---
schema = req("http://127.0.0.1:7878/api/v3/downloadclient/schema", RKEY)
qb = next(s for s in schema if s["implementation"] == "QBittorrent")
for app_name, key, port in [("Radarr", RKEY, 7878), ("Sonarr", SKEY, 8989)]:
    clients = req(f"http://127.0.0.1:{port}/api/v3/downloadclient", key)
    if clients:
        print(f"{app_name} download client already configured")
        continue
    qb["enable"] = True
    qb["name"] = "qBittorrent"
    qb["priority"] = 1
    qb["removeCompletedDownloads"] = True
    qb["removeFailedDownloads"] = True
    for f in qb["fields"]:
        n = f["name"]
        if n == "host":
            f["value"] = "localhost"
        elif n == "port":
            f["value"] = 8089
        elif n == "username":
            f["value"] = QUSER
        elif n == "password":
            f["value"] = QPASS
        elif n == "movieCategory":
            f["value"] = "radarr"
        elif n == "tvCategory":
            f["value"] = "sonarr"
    req(f"http://127.0.0.1:{port}/api/v3/downloadclient", key, "POST", qb)
    print(f"Added qBittorrent to {app_name}")

# --- Prowlarr -> Radarr/Sonarr ---
apps = req("http://127.0.0.1:9696/api/v1/applications", PKEY)
existing = {a.get("name") for a in apps}

def add_app(schema_list, impl, name, base_url, api_key):
    if name in existing:
        print(f"Prowlarr app OK: {name}")
        return
    app = next(s for s in schema_list if s["implementation"] == impl)
    app["enable"] = True
    app["name"] = name
    for f in app["fields"]:
        if f["name"] == "prowlarrUrl":
            f["value"] = "http://localhost:9696"
        elif f["name"] == "baseUrl":
            f["value"] = base_url
        elif f["name"] == "apiKey":
            f["value"] = api_key
    req("http://127.0.0.1:9696/api/v1/applications", PKEY, "POST", app)
    print(f"Linked Prowlarr → {name}")

app_schema = req("http://127.0.0.1:9696/api/v1/applications/schema", PKEY)
add_app(app_schema, "Radarr", "Radarr", "http://localhost:7878", RKEY)
add_app(app_schema, "Sonarr", "Sonarr", "http://localhost:8989", SKEY)

# --- Indexers (if none) ---
indexers = req("http://127.0.0.1:9696/api/v1/indexer", PKEY)
if not indexers:
    idx_schema = req("http://127.0.0.1:9696/api/v1/indexer/schema", PKEY)
    for impl in ("Yts",):
        cand = [s for s in idx_schema if s.get("implementation") == impl]
        if not cand:
            continue
        idx = cand[0]
        idx["enable"] = True
        idx["appProfileId"] = 1
        idx["name"] = idx.get("name") or impl
        try:
            req("http://127.0.0.1:9696/api/v1/indexer", PKEY, "POST", idx)
            print(f"Added indexer: {idx['name']}")
        except SystemExit as e:
            print(f"WARN: skipped indexer {impl}: {e}")
    if req("http://127.0.0.1:9696/api/v1/indexer", PKEY):
        req("http://127.0.0.1:9696/api/v1/indexer/sync", PKEY, "POST", {})
        print("Synced indexers to Radarr/Sonarr")
    else:
        print("WARN: no indexers — add one in Prowlarr UI (Settings → Indexers)")
else:
    print(f"Prowlarr indexers: {len(indexers)} configured")
PY

log "Done. Add content via Radarr/Sonarr (see docs/radarr-torrents-quickstart.md)"
