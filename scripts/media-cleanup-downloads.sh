#!/usr/bin/env bash
# Remove duplicate / already-imported download folders and matching qBittorrent torrents.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAS_ROOT="${NAS_DATA_ROOT:-/mnt/cortex/nas-data}"
DL="$NAS_ROOT/media/downloads"
MOV="$NAS_ROOT/media/movies"
ENV_MEDIA="$ROOT/deploy/nas/media-stack/.env"
QPASS="$(grep -E '^QBITTORRENT_PASSWORD=' "$ENV_MEDIA" 2>/dev/null | cut -d= -f2- || true)"

export NAS_ROOT QPASS

python3 <<'PY'
import json, os, re, shutil, subprocess
from collections import defaultdict
from pathlib import Path

NAS = Path(os.environ["NAS_ROOT"])
DL = NAS / "media/downloads"
MOV = NAS / "media/movies"
QPASS = os.environ.get("QPASS", "")

ALIASES = {
    "harry potter and the philosophers stone": "harry potter and the sorcerers stone",
    "harry potter and the philosopher's stone": "harry potter and the sorcerers stone",
    "harry potter and the sorcerer's stone": "harry potter and the sorcerers stone",
    "five nights at freddys": "five nights at freddy's",
    "five nights at freddy's - o pesadelo sem fim": "five nights at freddy's",
    "five nights at freddys - o pesadelo sem fim": "five nights at freddy's",
    "five nights at freddys - o pesadelo sem fim 2023": "five nights at freddy's",
    "the hunger games mockingjay part 1": "the hunger games mockingjay - part 1",
    "the hunger games mockingjay   part 1": "the hunger games mockingjay - part 1",
    "top gun maverick": "top gun - maverick",
    "harry potter and the deathly hallows-part 1": "harry potter and the deathly hallows part 1",
    "harry potter and the deathly hallows - part 1": "harry potter and the deathly hallows part 1",
    "harry potter and the deathly hallows part 1": "harry potter and the deathly hallows part 1",
    "harry potter and the half blood prince extended edition": "harry potter and the half-blood prince",
    "harry potter and the chamber of secrets extended cut": "harry potter and the chamber of secrets",
    "mulan": "mulan",
}

def log(msg):
    print(f"[cleanup] {msg}", flush=True)

def extract_year(name: str) -> str | None:
    for pat in [r"\((\d{4})\)", r"\[(\d{4})\]", r"(?:^|[.\s])(19\d{2}|20\d{2})(?:[.\s\[]|$)"]:
        m = re.search(pat, name)
        if m:
            return m.group(1)
    return None

def extract_title(name: str) -> str:
    n = name
    n = re.sub(r"\[[^\]]+\]", "", n)
    n = re.sub(r"\{[^}]+\}", "", n)
    n = re.sub(r"\([^)]*\)", "", n)
    n = re.sub(r"www\.UIndex\.org\s*-\s*", "", n, flags=re.I)
    n = re.sub(r"^[.\s]+", "", n)
    n = re.sub(r"[._]+", " ", n)
    n = re.sub(r"\s+", " ", n).strip().lower()
    n = re.sub(
        r"\b(1080p|2160p|4k|bluray|webrip|web-dl|x265|hevc|hdr|imax|repack|extended|complete|uhd|bdrip|brrip|remux|hybrid|dual|ma|webdl|yts|tigole|atmos|ddp|aac|dts|10bit|7\.1|5\.1).*$",
        "",
        n,
        flags=re.I,
    )
    n = re.sub(r"\s+", " ", n).strip()
    return ALIASES.get(n, n)

def norm_key(name: str) -> str:
    year = extract_year(name)
    title = extract_title(name)
    if "harry potter" in title:
        for slug, canon in [
            ("sorcerer", "harry potter and the sorcerers stone"),
            ("philosopher", "harry potter and the sorcerers stone"),
            ("chamber of secrets", "harry potter and the chamber of secrets"),
            ("prisoner of azkaban", "harry potter and the prisoner of azkaban"),
            ("goblet of fire", "harry potter and the goblet of fire"),
            ("order of the phoenix", "harry potter and the order of the phoenix"),
            ("half-blood", "harry potter and the half-blood prince"),
            ("half blood", "harry potter and the half-blood prince"),
            ("deathly hallows part 2", "harry potter and the deathly hallows part 2"),
            ("deathly hallows - part 2", "harry potter and the deathly hallows part 2"),
            ("deathly hallows part 1", "harry potter and the deathly hallows part 1"),
            ("deathly hallows - part 1", "harry potter and the deathly hallows part 1"),
        ]:
            if slug in title:
                title = canon
                break
    return f"{title}|{year or '????'}"

def ffprobe_ok(path: Path) -> bool:
    if not path.is_file():
        return False
    try:
        sz = path.stat().st_size
    except OSError:
        return False
    if sz < 50_000_000:
        return False
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
        return bool(out) and float(out) >= 60
    except (subprocess.CalledProcessError, ValueError):
        return False

def best_video(folder: Path) -> tuple[int, Path | None]:
    best = (0, None)
    for fp in folder.rglob("*"):
        if not fp.is_file() or fp.suffix.lower() not in (".mkv", ".mp4", ".avi", ".m4v", ".webm"):
            continue
        try:
            sz = fp.stat().st_size
        except OSError:
            continue
        if ffprobe_ok(fp) and sz > best[0]:
            best = (sz, fp)
    return best

def folder_bytes(folder: Path) -> int:
    total = 0
    for fp in folder.rglob("*"):
        if fp.is_file():
            try:
                total += fp.stat().st_size
            except OSError:
                pass
    return total

def score_folder(path: Path) -> tuple:
    valid_sz, best = best_video(path)
    radarr_bonus = 2_000_000_000 if re.match(r"^.+ \(\d{4}\)$", path.name) else 0
    prefer_1080 = 500_000_000 if re.search(r"1080", path.name, re.I) and not re.search(r"2160|4k|uhd", path.name, re.I) else 0
    return (valid_sz + radarr_bonus + prefer_1080, valid_sz, folder_bytes(path))

def remove_tree(path: Path):
    log(f"remove {path.name}")
    shutil.rmtree(path, ignore_errors=True)

def dedupe_base(base: Path, label: str) -> set[str]:
    """Return norm keys that have a keeper folder."""
    by: dict[str, list[Path]] = defaultdict(list)
    SKIP = {"steve-movies", "extras", "featurettes"}
    for d in sorted(base.iterdir()):
        if d.is_dir() and not d.name.startswith(".") and d.name.lower() not in SKIP:
            by[norm_key(d.name)].append(d)
    keepers: set[str] = set()
    for key, dirs in by.items():
        if len(dirs) == 1:
            keepers.add(key)
            continue
        scored = sorted(((score_folder(d), d) for d in dirs), key=lambda x: x[0], reverse=True)
        keep = scored[0][1]
        keepers.add(key)
        log(f"{label}: keep [{key}] → {keep.name}")
        for _, d in scored[1:]:
            remove_tree(d)
    return keepers

def cleanup_downloads_vs_movies(movie_keepers: set[str]):
    removed = 0
    for d in list(DL.iterdir()):
        if not d.is_dir() or d.name.startswith("."):
            continue
        key = norm_key(d.name)
        if key in movie_keepers:
            valid, _ = best_video(d)
            if valid > 0:
                log(f"download already in library [{key}]")
            remove_tree(d)
            removed += 1
            continue
        valid, _ = best_video(d)
        total = folder_bytes(d)
        if valid == 0 and total < 100_000_000:
            log(f"download empty/partial [{d.name}]")
            remove_tree(d)
            removed += 1
    log(f"removed {removed} download folders (imported or junk)")

def qbit_api(path, method="GET", data=None):
    cmd = [
        "docker", "exec", "cortex-radarr", "curl", "-sf", "-u", f"admin:{QPASS}",
        "-X", method, f"http://127.0.0.1:8089/api/v2{path}",
    ]
    if data:
        for k, v in data.items():
            cmd.extend(["--data-urlencode", f"{k}={v}"])
    out = subprocess.check_output(cmd, text=True)
    return json.loads(out) if out.strip() else {}

def cleanup_qbit(movie_keepers: set[str]):
    if not QPASS:
        log("skip qbit (no password)")
        return
    try:
        torrents = qbit_api("/torrents/info")
    except subprocess.CalledProcessError as e:
        log(f"skip qbit api: {e}")
        return

    by: dict[str, list[dict]] = defaultdict(list)
    for t in torrents:
        by[norm_key(t.get("name", ""))].append(t)

    to_delete: list[str] = []
    for key, group in by.items():
        # Drop hash-named junk
        for t in group:
            name = t.get("name", "")
            if re.fullmatch(r"[0-9a-f]{40}", name, re.I):
                to_delete.append(t["hash"])
                continue
            if t.get("progress", 0) < 0.01 and t.get("total_size", 0) < 1_000_000:
                to_delete.append(t["hash"])
                continue

        if key in movie_keepers:
            for t in group:
                if t["hash"] not in to_delete:
                    to_delete.append(t["hash"])
            continue

        if len(group) < 2:
            continue
        # Keep best torrent in duplicate group
        def tscore(t):
            p = t.get("progress", 0)
            sz = t.get("size", 0) or t.get("total_size", 0)
            name = t.get("name", "").lower()
            bad = any(x in name for x in ["2160", "4k", "uhd", "remux", "complete.bluray"])
            return (p >= 0.99, not bad, sz)

        group = [t for t in group if t["hash"] not in to_delete]
        if len(group) < 2:
            continue
        group.sort(key=tscore, reverse=True)
        for t in group[1:]:
            to_delete.append(t["hash"])

    to_delete = list(dict.fromkeys(to_delete))
    if not to_delete:
        log("qbit: nothing to delete")
        return

    for i in range(0, len(to_delete), 40):
        batch = "|".join(to_delete[i : i + 40])
        subprocess.run(
            [
                "docker", "exec", "cortex-radarr", "curl", "-sf", "-u", f"admin:{QPASS}",
                "-X", "POST", "http://127.0.0.1:8089/api/v2/torrents/delete",
                "--data-urlencode", f"hashes={batch}",
                "--data-urlencode", "deleteFiles=true",
            ],
            check=True,
        )
    log(f"qbit: deleted {len(to_delete)} torrents")

log("=== dedupe movies ===")
movie_keepers = dedupe_base(MOV, "movies")
log("=== dedupe remaining downloads ===")
dedupe_base(DL, "downloads")
cleanup_downloads_vs_movies(movie_keepers)
cleanup_qbit(movie_keepers)

# Loose files in downloads root
for fp in list(DL.iterdir()):
    if fp.is_file():
        if fp.suffix.lower() in (".mkv", ".mp4", ".part", ".!qb", ".nfo", ".txt", ".jpg", ".png"):
            log(f"remove loose file {fp.name}")
            fp.unlink(missing_ok=True)

for d in list(DL.iterdir()):
    if d.is_dir() and not any(d.rglob("*")):
        d.rmdir()

log(f"done — downloads: {len(list(DL.iterdir()))} items, movies: {len(list(MOV.iterdir()))} folders")
PY
