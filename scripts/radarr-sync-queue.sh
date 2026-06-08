#!/usr/bin/env bash
# Re-link Radarr queue to qBittorrent after Docker restarts.
# qBit reports /downloads; Radarr reads /media/downloads — needs remote path mapping.
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

RKEY="$(grep -oP '(?<=<ApiKey>)[^<]+' "$NAS_ROOT/appdata/radarr/config.xml" | head -1)"
[[ -n "$RKEY" ]] || { echo "[radarr-sync] ERROR: no Radarr API key"; exit 1; }

log() { echo "[radarr-sync] $*"; }

if ! docker exec cortex-radarr curl -sf -u "${QBIT_USER}:${QBIT_PASS}" --max-time 8 \
  http://127.0.0.1:8089/api/v2/app/version >/dev/null 2>&1; then
  log "WARN: qBittorrent not reachable from Radarr — start media stack first"
  exit 1
fi

export RKEY QBIT_USER QBIT_PASS

python3 <<PY
import json, os, urllib.request

RKEY = os.environ["RKEY"]
QUSER = os.environ["QBIT_USER"]
QPASS = os.environ["QBIT_PASS"]
BASE = "http://127.0.0.1:7878/api/v3"

def api(path, method="GET", data=None):
    headers = {"X-Api-Key": RKEY}
    body = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode()
    req = urllib.request.Request(f"{BASE}{path}", data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
        return json.loads(raw) if raw else {}

mappings = api("/remotepathmapping")
want = {"host": "127.0.0.1", "remotePath": "/downloads/", "localPath": "/media/downloads/"}
if not any(m.get("remotePath") == want["remotePath"] for m in mappings):
    api("/remotepathmapping", "POST", want)
    print("Added remote path mapping /downloads/ -> /media/downloads/")
else:
    print("Remote path mapping OK")

dc = api("/downloadclient/1")
dc["enable"] = True
for f in dc.get("fields", []):
    if f["name"] == "host":
        f["value"] = "127.0.0.1"
    elif f["name"] == "port":
        f["value"] = 8089
    elif f["name"] == "username":
        f["value"] = QUSER
    elif f["name"] == "password":
        f["value"] = QPASS
    elif f["name"] == "movieCategory":
        f["value"] = "radarr"
api("/downloadclient/1", "PUT", dc)
api("/downloadclient/test", "POST", dc)
print("Download client tested OK")

for cmd in ("RefreshMonitoredDownloads", "ProcessMonitoredDownloads"):
    api("/command", "POST", {"name": cmd})

q = api("/queue")
print(f"Queue: {q.get('totalRecords', 0)} items")

# Only monitor missing movies — skip re-downloads for library you already have.
movies = api("/movie")
for m in movies:
    want = not m.get("hasFile")
    if m.get("monitored") != want:
        m["monitored"] = want
        api(f"/movie/{m['id']}", "PUT", m)
owned = {m["title"].lower(): m for m in movies if m.get("hasFile")}
missing_ids = {m["id"] for m in movies if not m.get("hasFile")}
remove_q = [r["id"] for r in q.get("records", []) if r.get("movieId") not in missing_ids]
if remove_q:
    for i in range(0, len(remove_q), 50):
        api("/queue/bulk", "DELETE", {
            "ids": remove_q[i : i + 50],
            "removeFromClient": True,
            "blocklist": False,
            "skipRedownload": True,
        })
    print(f"Removed {len(remove_q)} queue items for already-owned movies")
print(f"Monitored: {sum(1 for m in movies if m.get('monitored'))} missing only")
PY

log "Open: http://100.104.120.29:7878/activity/queue (hard-refresh if UI looks empty)"
