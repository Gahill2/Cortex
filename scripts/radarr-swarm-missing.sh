#!/usr/bin/env bash
# Add many torrent swarms for missing Radarr movies via Prowlarr + Radarr release search.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAS_ROOT="${NAS_DATA_ROOT:-/mnt/cortex/nas-data}"
ENV_MEDIA="${ENV_MEDIA:-$ROOT/deploy/nas/media-stack/.env}"
QBIT_USER="${QBITTORRENT_USER:-admin}"
QBIT_PASS="${QBITTORRENT_PASSWORD:-GMmr44TI8}"
SWARMS_PER_MOVIE="${SWARMS_PER_MOVIE:-8}"
MIN_SEEDERS="${MIN_SEEDERS:-1}"
MAX_ACTIVE_DL="${MAX_ACTIVE_DL:-20}"
MAX_ACTIVE_TORRENTS="${MAX_ACTIVE_TORRENTS:-30}"
SEARCH_TIMEOUT="${SEARCH_TIMEOUT:-25}"

if [[ -f "$ENV_MEDIA" ]]; then
  QBIT_USER="$(grep -E '^QBITTORRENT_USER=' "$ENV_MEDIA" 2>/dev/null | cut -d= -f2- || true)"
  QBIT_PASS="$(grep -E '^QBITTORRENT_PASSWORD=' "$ENV_MEDIA" 2>/dev/null | cut -d= -f2- || true)"
  QBIT_USER="${QBIT_USER:-admin}"
  QBIT_PASS="${QBIT_PASS:-GMmr44TI8}"
fi

RKEY="$(grep -oP '(?<=<ApiKey>)[^<]+' "$NAS_ROOT/appdata/radarr/config.xml" | head -1)"
PKEY="$(grep -oP '(?<=<ApiKey>)[^<]+' "$NAS_ROOT/appdata/prowlarr/config.xml" | head -1)"
[[ -n "$RKEY" && -n "$PKEY" ]] || { echo "[swarm] ERROR: missing Radarr/Prowlarr API keys"; exit 1; }

export RKEY PKEY QBIT_USER QBIT_PASS SWARMS_PER_MOVIE MIN_SEEDERS MAX_ACTIVE_DL MAX_ACTIVE_TORRENTS SEARCH_TIMEOUT

log() { echo "[swarm] $*"; }

if ! docker exec cortex-radarr curl -sf -u "${QBIT_USER}:${QBIT_PASS}" --max-time 8 \
  http://127.0.0.1:8089/api/v2/app/version >/dev/null 2>&1; then
  log "ERROR: qBittorrent not reachable from Radarr container"
  exit 1
fi

python3 <<'PY'
import json, os, re, subprocess, urllib.parse, urllib.request

RKEY = os.environ["RKEY"]
PKEY = os.environ["PKEY"]
QUSER = os.environ["QBIT_USER"]
QPASS = os.environ["QBIT_PASS"]
SWARMS = int(os.environ.get("SWARMS_PER_MOVIE", "8"))
MIN_SEED = int(os.environ.get("MIN_SEEDERS", "1"))
SEARCH_TIMEOUT = int(os.environ.get("SEARCH_TIMEOUT", "25"))

def radarr(path, method="GET", data=None):
    headers = {"X-Api-Key": RKEY}
    body = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode()
    req = urllib.request.Request(f"http://localhost:7878/api/v3{path}", data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read()
        return json.loads(raw) if raw else {}

def prowlarr(query):
    q = urllib.parse.quote(query)
    out = subprocess.check_output([
        "curl", "-sf", "--max-time", str(SEARCH_TIMEOUT),
        "-H", f"X-Api-Key: {PKEY}",
        f"http://localhost:9696/api/v1/search?query={q}&type=search",
    ], text=True)
    return json.loads(out) if out.strip() else []

def qbit_post(cmd, data=None):
    args = [
        "docker", "exec", "cortex-radarr", "curl", "-sf", "-u", f"{QUSER}:{QPASS}",
        "-X", "POST", f"http://127.0.0.1:8089/api/v2/{cmd}",
    ]
    if data:
        args += ["-d", data]
    subprocess.run(args, check=True, capture_output=True)

def qbit_get(path):
    out = subprocess.check_output([
        "docker", "exec", "cortex-radarr", "curl", "-sf", "-u", f"{QUSER}:{QPASS}",
        f"http://127.0.0.1:8089/api/v2/{path}",
    ], text=True)
    return json.loads(out)

def info_hash(item):
    h = (item.get("infoHash") or "").lower()
    if h:
        return h
    guid = item.get("guid") or ""
    m = re.search(r"btih:([a-fA-F0-9]{40})", guid, re.I)
    return m.group(1).lower() if m else None

def magnet_for(item, h):
    guid = item.get("guid") or ""
    if guid.startswith("magnet:"):
        return guid
    title = urllib.parse.quote(item.get("title") or "torrent")
    return f"magnet:?xt=urn:btih:{h}&dn={title}"

def title_tokens(title):
    stop = {"the", "a", "an", "and", "of", "part", "ii", "iii", "iv", "at", "in", "on"}
    return [t for t in re.findall(r"[a-z0-9]+", title.lower()) if t not in stop and len(t) > 1]

def matches_movie(result_title, movie_title, year):
    t = result_title.lower()
    if str(year) not in t:
        return False
    tokens = title_tokens(movie_title)
    if not tokens:
        return False
    joined = re.sub(r"[^a-z0-9]+", " ", t)
    for tok in tokens[: min(3, len(tokens))]:
        if tok not in joined:
            return False
    bad = {
        "red": ["under the red hood", "red dead", "red means", "code red"],
        "sing": ["sing street", "sing 2"],
        "mulan": ["mulan ii", "mulan 2"],
        "top gun": ["top gun maverick"] if year == 1986 else [],
    }
    key = movie_title.lower()
    for phrase in bad.get(key, []):
        if phrase in t:
            return False
    if "collection" in t and len(tokens) <= 2:
        return False
    return True

def score_release(title, seeders):
    t = title.lower()
    s = seeders * 10
    if "1080p" in t:
        s += 30
    if "x264" in t or "h264" in t:
        s += 25
    if "bluray" in t or "blu-ray" in t or "brrip" in t:
        s += 15
    if "webrip" in t or "web-dl" in t or "webdl" in t:
        s += 10
    if "2160p" in t or "4k" in t or "uhd" in t:
        s -= 10
    if "remux" in t:
        s -= 20
    if "x265" in t or "hevc" in t:
        s -= 5
    if any(x in t for x in ("dub", "dublado", "latino", "ita ", " hindi")):
        s -= 50
    return s

def queries_for(title, year):
    short = title.replace("Harry Potter and the ", "Harry Potter ")
    return list(dict.fromkeys([
        f"{title} {year}",
        f"{title} {year} 1080p",
        f"{short} {year} x264",
        f"{short} {year} bluray",
        f"{title} {year} webrip",
    ]))

# Raise qBit parallelism
prefs = qbit_get("app/preferences")
for key, val in (("max_active_downloads", int(os.environ.get("MAX_ACTIVE_DL", "20"))),
                 ("max_active_torrents", int(os.environ.get("MAX_ACTIVE_TORRENTS", "30"))),
                 ("max_active_uploads", 10)):
    prefs[key] = val
payload = urllib.parse.urlencode({"json": json.dumps(prefs)})
try:
    qbit_post("app/setPreferences", payload)
    print(f"qBit parallel: {prefs['max_active_downloads']} downloads, {prefs['max_active_torrents']} torrents")
except subprocess.CalledProcessError:
    print("WARN: could not tune qBit limits")

torrents = qbit_get("torrents/info")
existing = {t["hash"].lower(): t for t in torrents}

movies = radarr("/movie")
missing = [m for m in movies if not m.get("hasFile")]
movie_ids = [m["id"] for m in missing]
if movie_ids:
    radarr("/command", "POST", {"name": "MoviesSearch", "movieIds": movie_ids})
    print(f"Radarr MoviesSearch: {len(movie_ids)} missing titles")

added = 0
grabbed = 0
removed_stalled = 0

for m in sorted(missing, key=lambda x: x["title"]):
    title, year, mid = m["title"], m["year"], m["id"]
    pool = {}
    for q in queries_for(title, year):
        try:
            for r in prowlarr(q):
                h = info_hash(r)
                if not h:
                    continue
                pool[h] = r
        except (subprocess.CalledProcessError, json.JSONDecodeError, Exception) as e:
            print(f"  search warn ({q[:40]}): {e}")

    # Radarr indexer releases (often different from Prowlarr aggregate)
    try:
        for r in radarr(f"/release?movieId={mid}"):
            h = info_hash(r) or (r.get("infoUrl") or "")
            guid = r.get("guid") or ""
            m2 = re.search(r"btih:([a-fA-F0-9]{40})", guid, re.I)
            h = m2.group(1).lower() if m2 else None
            if h:
                pool[h] = r
    except Exception:
        pass

    candidates = []
    for h, r in pool.items():
        rtitle = r.get("title") or ""
        if not matches_movie(rtitle, title, year):
            continue
        seeders = int(r.get("seeders") or 0)
        if seeders < MIN_SEED:
            continue
        candidates.append((score_release(rtitle, seeders), seeders, rtitle, h, r))

    candidates.sort(key=lambda x: (-x[0], -x[1]))
    picks = candidates[:SWARMS]
    new_picks = [p for p in picks if p[3] not in existing]

    # Drop dead stalled torrents for this movie if we have better swarms
    title_l = title.lower()
    for h, t in list(existing.items()):
        name = t["name"].lower()
        if str(year) not in name:
            continue
        if not any(tok in name for tok in title_tokens(title)[:2]):
            continue
        prog = t.get("progress", 0)
        state = t.get("state", "")
        if prog < 0.05 and state in ("stalledDL", "metaDL", "missingFiles", "queuedDL"):
            best_seed = picks[0][1] if picks else 0
            if best_seed >= 3 and h not in {p[3] for p in new_picks}:
                try:
                    qbit_post("torrents/delete", f"hashes={h}&deleteFiles=false")
                    removed_stalled += 1
                    del existing[h]
                except subprocess.CalledProcessError:
                    pass

    if not new_picks and not picks:
        print(f"NONE {title} ({year})")
        continue

    print(f"\n{title} ({year}) — {len(new_picks)} new / {len(picks)} total swarms")
    for _, seeders, rtitle, h, r in new_picks:
        magnet = magnet_for(r, h)
        data = urllib.parse.urlencode({
            "urls": magnet,
            "category": "radarr",
            "paused": "false",
        })
        try:
            qbit_post("torrents/add", data)
            existing[h] = {"hash": h, "name": rtitle}
            added += 1
            print(f"  + [{seeders}S] {rtitle[:72]}")
        except subprocess.CalledProcessError as e:
            print(f"  ! add failed: {rtitle[:50]}")

    # Radarr grab top 2 releases (sends to qBit via download client)
    for rel in picks[:2]:
        r = rel[4]
        if r.get("downloadAllowed") is False:
            continue
        body = dict(r)
        body["movieId"] = mid
        try:
            radarr("/release", "POST", body)
            grabbed += 1
            print(f"  ~ radarr grab [{rel[1]}S] {rel[2][:60]}")
        except Exception:
            pass

# Resume everything
try:
    hashes = "|".join(t["hash"] for t in qbit_get("torrents/info"))
    if hashes:
        qbit_post("torrents/resume", f"hashes={hashes}")
except subprocess.CalledProcessError:
    pass

radarr("/command", "POST", {"name": "RefreshMonitoredDownloads"})
radarr("/command", "POST", {"name": "ProcessMonitoredDownloads"})

final = qbit_get("torrents/info")
active = sum(1 for t in final if "dl" in t.get("state", "").lower() or t.get("state") == "downloading")
print(f"\nDone: +{added} qBit torrents, {grabbed} Radarr grabs, -{removed_stalled} stalled removed")
print(f"qBit now: {len(final)} torrents, ~{active} downloading")
PY

log "qBit: http://100.104.120.29:8089 — Radarr queue: http://100.104.120.29:7878/activity/queue"
