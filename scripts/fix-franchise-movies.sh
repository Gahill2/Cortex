#!/usr/bin/env bash
# Fix franchise batch: rename on-disk movies, purge bad torrents, re-grab 1080p, Radarr import.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAS_ROOT="${NAS_DATA_ROOT:-/mnt/cortex/nas-data}"
MOVIES="$NAS_ROOT/media/movies"
ENV_MEDIA="$ROOT/deploy/nas/media-stack/.env"
QPASS="$(grep -E '^QBITTORRENT_PASSWORD=' "$ENV_MEDIA" 2>/dev/null | cut -d= -f2- || echo GMmr44TI8)"
RKEY="$(grep -oP '(?<=<ApiKey>)[^<]+' "$NAS_ROOT/appdata/radarr/config.xml" | head -1)"

log() { echo "[fix-franchise] $*"; }

export NAS_DATA_ROOT="$NAS_ROOT" QPASS ENV_MEDIA

log "Step 1: Move completed files into Radarr folder names"
python3 <<'PY'
import os, shutil
from pathlib import Path

NAS = Path(os.environ["NAS_DATA_ROOT"])
MOVIES = NAS / "media/movies"

FIXES = [
    (
        MOVIES / "Sinners 2025 REPACK 1080p BluRay x265 10bit TrueHD-WiKi",
        MOVIES / "Sinners (2025)",
        "Sinners (2025).mkv",
    ),
    (
        MOVIES / "Wicked 2024 1080p Bluray DDP7 1 HEVC x265-BluBirD",
        MOVIES / "Wicked (2024)",
        "Wicked (2024).mkv",
    ),
]

for src_dir, dest_dir, dest_name in FIXES:
    if not src_dir.is_dir():
        print(f"SKIP missing {src_dir.name}")
        continue
    mkvs = list(src_dir.glob("*.mkv")) + list(src_dir.glob("*.mp4"))
    if not mkvs:
        print(f"SKIP no video in {src_dir.name}")
        continue
    src = max(mkvs, key=lambda p: p.stat().st_size)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / dest_name
    if dest.exists() and dest.stat().st_size >= src.stat().st_size * 0.99:
        print(f"OK already {dest}")
    else:
        if dest.exists():
            dest.unlink()
        shutil.move(str(src), str(dest))
        print(f"MOVED {src.name} -> {dest}")
    try:
        src_dir.rmdir()
    except OSError:
        pass

# Wicked For Good — folder name already matches Radarr path
wf = MOVIES / "Wicked - For Good (2025)"
if wf.is_dir():
    print(f"OK Wicked For Good folder at {wf}")
PY

log "Step 2: qBittorrent cleanup (2160p/remux/hash junk for franchise)"
python3 <<'PY'
import json, re, subprocess, os

QPASS = os.environ["QPASS"]
ENV = os.environ.get("ENV_MEDIA", "")

def qbit_api(path, method="GET", data=None):
    cmd = [
        "docker", "exec", "cortex-radarr", "curl", "-sf", "-u", f"admin:{QPASS}",
        "-X", method, f"http://127.0.0.1:8089/api/v2{path}",
    ]
    if data:
        cmd.extend(["--data-urlencode", data[0], "--data", data[1]])
    out = subprocess.check_output(cmd, text=True)
    return json.loads(out) if out.strip() else {}

keys = [
    "hunger", "inside out", "inside.out", "zootopia", "sing", "harry", "potter",
    "top gun", "sinners", "wicked",
]
torrents = qbit_api("/torrents/info")

def is_franchise(name: str) -> bool:
    n = name.lower()
    return any(k in n for k in keys)

def is_bad(name: str) -> bool:
    n = name.lower()
    if re.fullmatch(r"[0-9a-f]{40}", n):
        return True
    if any(x in n for x in ["2160p", "2160", "4k", "remux", "uhd bluray", "complete uhd"]):
        return True
    if ".scr" in n or "cam" in n or "hdts" in n:
        return True
    return False

to_delete = []
for t in torrents:
    name = t.get("name", "")
    if not is_franchise(name):
        continue
    # Remove finished Sinners/Wicked torrents (already on disk)
    if t.get("progress", 0) >= 0.99 and any(x in name.lower() for x in ["sinners", "wicked"]):
        to_delete.append(t["hash"])
        continue
    if is_bad(name):
        to_delete.append(t["hash"])
        continue
    if re.fullmatch(r"[0-9a-f]{40}", name, re.I) and t.get("progress", 0) < 0.01:
        to_delete.append(t["hash"])

if to_delete:
    hashes = "|".join(to_delete)
    subprocess.run(
        [
            "docker", "exec", "cortex-radarr", "curl", "-sf", "-u", f"admin:{QPASS}",
            "-X", "POST", "http://127.0.0.1:8089/api/v2/torrents/delete",
            "--data-urlencode", f"hashes={hashes}",
            "--data", "deleteFiles=false",
        ],
        check=True,
    )
    print(f"Deleted {len(to_delete)} torrents from queue")
else:
    print("No franchise torrents to delete")
PY

log "Step 3: Radarr — refresh + grab 1080p for all missing franchise movies"
export RKEY
python3 <<'PY'
import json, os, re, time, urllib.parse, urllib.request

RKEY = os.environ["RKEY"]

def radarr(method, path, data=None):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(
        f"http://127.0.0.1:7878/api/v3{path}", data=body,
        headers={"X-Api-Key": RKEY, "Content-Type": "application/json"}, method=method)
    with urllib.request.urlopen(req, timeout=180) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else {}

def score(r):
    t = (r.get("title") or "").lower()
    if any(x in t for x in [".scr", "cam", "hdts", "hdcam"]):
        return -999
    if any(x in t for x in ["2160p", "2160", "4k", "remux", "uhd bluray", "complete uhd"]):
        return 2
    s = min(r.get("seeders", 0), 100)
    if "1080p" in t:
        s += 50
    elif "720p" in t:
        s += 20
    if any(x in t for x in ["bluray", "webrip", "web-dl", "webdl"]):
        s += 20
    if "x265" in t or "hevc" in t:
        s += 10
    sz = r.get("size") or 0
    if 1e9 < sz < 9e9:
        s += 5
    if sz > 15e9:
        s -= 20
    return s

keys = ["hunger", "inside out", "zootopia", "sing", "harry", "potter", "top gun", "sinners", "wicked"]
movies = [
    m for m in radarr("GET", "/movie")
    if any(k in m.get("title", "").lower() for k in keys)
]

# Refresh movies that may already be on disk
for m in movies:
    radarr("POST", "/command", {"name": "RefreshMovie", "movieIds": [m["id"]]})
time.sleep(3)
radarr("POST", "/command", {"name": "DownloadedMoviesScan"})
time.sleep(5)

need = [m for m in movies if not m.get("hasFile")]
print(f"Missing after scan: {len(need)} / {len(movies)}")

for i in range(0, len(need), 8):
    chunk = [m["id"] for m in need[i : i + 8]]
    radarr("POST", "/command", {"name": "MoviesSearch", "movieIds": chunk})
    time.sleep(4)
time.sleep(25)

grabbed = failed = 0
for m in need:
    m = radarr("GET", f"/movie/{m['id']}")
    if m.get("hasFile"):
        continue
    releases = radarr("GET", f"/release?movieId={m['id']}")
    if not releases:
        print(f"NO RELEASES: {m['title']}")
        failed += 1
        continue
    pick = max(releases, key=score)
    if score(pick) < 15:
        print(f"WEAK: {m['title']}")
        failed += 1
        continue
    try:
        radarr("POST", "/release", pick)
        grabbed += 1
        print(f"GRAB: {m['title']} <- {pick.get('title', '')[:65]}")
        time.sleep(1)
    except Exception as e:
        print(f"FAIL {m['title']}: {e}")
        failed += 1

print(f"Grabbed {grabbed}, failed/no release {failed}")
radarr("POST", "/command", {"name": "DownloadedMoviesScan"})
PY

log "Step 4: Jellyfin library refresh"
if [[ -f "$ENV_MEDIA" ]]; then
  set -a
  # shellcheck source=/dev/null
  source <(grep -E '^JELLYFIN_API_KEY=' "$ENV_MEDIA" 2>/dev/null || true)
  set +a
fi
JKEY="${JELLYFIN_API_KEY:-}"
if [[ -z "$JKEY" && -f "$NAS_ROOT/appdata/jellyfin/config/data/jellyfin.db" ]]; then
  JKEY="$(DB="$NAS_ROOT/appdata/jellyfin/config/data/jellyfin.db" python3 -c "
import sqlite3, os
try:
    r = sqlite3.connect(os.environ['DB']).execute(
        'SELECT AccessToken FROM ApiKeys ORDER BY DateLastActivity DESC LIMIT 1'
    ).fetchone()
    print(r[0] if r else '')
except Exception:
    print('')
")"
fi
IP="$(tailscale ip -4 2>/dev/null | head -1 || echo 127.0.0.1)"
if [[ -n "$JKEY" ]]; then
  curl -sf -X POST -H "X-Emby-Token: $JKEY" "http://${IP}:8096/Library/Refresh" >/dev/null && log "Jellyfin scan triggered"
fi

log "Step 5: Status"
export RKEY
python3 <<'PY'
import json, os, urllib.request
RKEY = os.environ["RKEY"]
req = urllib.request.Request("http://127.0.0.1:7878/api/v3/movie", headers={"X-Api-Key": RKEY})
movies = json.loads(urllib.request.urlopen(req).read())
keys = ["hunger", "inside out", "zootopia", "sing", "harry", "potter", "top gun", "sinners", "wicked"]
batch = [m for m in movies if any(k in m.get("title", "").lower() for k in keys)]
ok = [m for m in batch if m.get("hasFile")]
miss = [m for m in batch if not m.get("hasFile")]
print(f"Radarr: {len(ok)}/{len(batch)} installed")
for m in sorted(ok, key=lambda x: x["title"]):
    print(f"  OK {m['title']} ({m.get('year')})")
if miss:
    print("Still missing:")
    for m in sorted(miss, key=lambda x: x["title"]):
        print(f"  -- {m['title']} ({m.get('year')})")
PY

log "Done."
