#!/usr/bin/env bash
# Move finished videos from downloads → movies/tv, register in Radarr/Sonarr (unmonitored),
# so Jellyfin shows them and *arr won't search/download again.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAS_ROOT="${NAS_DATA_ROOT:-/mnt/cortex/nas-data}"
export NAS_DATA_ROOT="$NAS_ROOT"

log() { echo "[media-import] $*"; }

log "Step 1: organize downloads → library folders"
bash "$ROOT/scripts/organize-jellyfin-downloads.sh"

read_key() {
  grep -oP '(?<=<ApiKey>)[^<]+' "$NAS_ROOT/appdata/$1/config.xml" | head -1
}

export RKEY="$(read_key radarr)"
export SKEY="$(read_key sonarr)"

python3 <<'PY'
import json, os, re, urllib.parse, urllib.request
from pathlib import Path

NAS = Path(os.environ["NAS_DATA_ROOT"])
MOVIES = NAS / "media/movies"
TV = NAS / "media/tv"
RKEY, SKEY = os.environ["RKEY"], os.environ["SKEY"]
VIDEO = {".mkv", ".mp4", ".avi", ".m4v", ".mov", ".webm"}


def req(url, key, method="GET", data=None):
    h = {"X-Api-Key": key, "Content-Type": "application/json"}
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(url, data=body, headers=h, method=method)
    with urllib.request.urlopen(r, timeout=60) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else {}


def largest_video(folder: Path):
    best = None
    size = 0
    for p in folder.rglob("*"):
        if p.suffix.lower() in VIDEO and p.is_file():
            st = p.stat().st_size
            if st > size:
                size, best = st, p
    return best


def clean_lookup(name: str) -> str:
    n = re.sub(r"\[[^\]]+\]", "", name)
    n = re.sub(r"\{[^}]+\}", "", n)
    n = re.sub(r"www\.UIndex\.org\s*-\s*", "", n, flags=re.I)
    n = re.sub(r"[._]+", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


# --- Radarr: add each movie folder (unmonitored, no search) ---
profiles = req("http://127.0.0.1:7878/api/v3/qualityprofile", RKEY)
qpid = profiles[0]["id"] if profiles else 1
roots = req("http://127.0.0.1:7878/api/v3/rootfolder", RKEY)
root = roots[0]["path"] if roots else "/media/movies"
existing = {m.get("tmdbId") for m in req("http://127.0.0.1:7878/api/v3/movie", RKEY)}

added = skipped = 0
for folder in sorted(MOVIES.iterdir()):
    if not folder.is_dir() or folder.name == "Steve-Movies":
        continue
    vf = largest_video(folder)
    if not vf or vf.stat().st_size < 50_000_000:
        continue
    term = clean_lookup(folder.name)
    try:
        hits = req(
            "http://127.0.0.1:7878/api/v3/movie/lookup?term="
            + urllib.parse.quote(term),
            RKEY,
        )
    except Exception as e:
        print(f"SKIP lookup {folder.name}: {e}")
        continue
    if not hits:
        print(f"WARN no TMDB match: {folder.name}")
        continue
    movie = hits[0]
    tid = movie.get("tmdbId")
    if tid in existing:
        skipped += 1
        continue
    movie.update(
        {
            "qualityProfileId": qpid,
            "rootFolderPath": root,
            "monitored": False,
            "addOptions": {"searchForMovie": False, "monitor": "movieOnly"},
        }
    )
    try:
        req("http://127.0.0.1:7878/api/v3/movie", RKEY, "POST", movie)
        existing.add(tid)
        added += 1
        print(f"Radarr + unmonitored: {movie.get('title')} ({movie.get('year')})")
    except Exception as e:
        print(f"SKIP add {folder.name}: {e}")

for cmd in ("DownloadedMoviesScan", "RescanMovies"):
    try:
        req("http://127.0.0.1:7878/api/v3/command", RKEY, "POST", {"name": cmd})
    except Exception as e:
        print(f"Radarr command {cmd}: {e}")
print(f"Radarr: added {added}, already had {skipped}")

# --- Sonarr: refresh series that already have episode files ---
sonarr_series = req("http://127.0.0.1:8989/api/v3/series", SKEY)
sonarr_ids = {s["title"] for s in sonarr_series}
for show_dir in sorted(TV.iterdir()):
    if not show_dir.is_dir():
        continue
    if not any(show_dir.rglob("*.mkv")) and not any(show_dir.rglob("*.mp4")):
        continue
    title = show_dir.name
    if title in sonarr_ids:
        continue
    try:
        hits = req(
            "http://127.0.0.1:8989/api/v3/series/lookup?term="
            + urllib.parse.quote(title),
            SKEY,
        )
    except Exception as e:
        print(f"Sonarr SKIP lookup {title}: {e}")
        continue
    if not hits:
        print(f"Sonarr WARN no match: {title}")
        continue
    s = hits[0]
    s.update(
        {
            "qualityProfileId": qpid,
            "rootFolderPath": "/media/tv",
            "monitored": False,
            "seasonFolder": True,
            "addOptions": {"searchForMissingEpisodes": False},
        }
    )
    try:
        req("http://127.0.0.1:8989/api/v3/series", SKEY, "POST", s)
        print(f"Sonarr + unmonitored: {s.get('title')}")
    except Exception as e:
        print(f"Sonarr SKIP {title}: {e}")

try:
    req("http://127.0.0.1:8989/api/v3/command", SKEY, "POST", {"name": "RescanSeries"})
    print("Sonarr rescan triggered")
except Exception as e:
    print(f"Sonarr rescan: {e}")
PY

log "Step 3: Jellyfin library scan (if API key in appdata)"
JELLYFIN_CONFIG="$NAS_ROOT/appdata/jellyfin/config"
if [[ -d "$JELLYFIN_CONFIG" ]]; then
  log "  Dashboard → Libraries → Scan all libraries"
fi

log "Done."
log "RED / Red 2: not on disk (qBittorrent: missingFiles). Re-download after 2TB wire finishes, or drop torrents and add only in Radarr once."
