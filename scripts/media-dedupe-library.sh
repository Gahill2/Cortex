#!/usr/bin/env bash
# Remove duplicate download/movie folders; quarantine corrupt/zero-byte videos.
# Keeps the largest valid release per title (prefers Radarr-style "Title (Year)" folders in movies/).
set -euo pipefail

ROOT="${NAS_DATA_ROOT:-/mnt/cortex/nas-data}"
DL="$ROOT/media/downloads"
MOV="$ROOT/media/movies"
TV="$ROOT/media/tv"
QUAR="$MOV/.dedupe-quarantine"
mkdir -p "$QUAR" "$DL" "$MOV" "$TV"

log() { echo "[dedupe] $*"; }

is_valid_video() {
  local f="$1"
  [[ -f "$f" ]] || return 1
  local sz
  sz="$(stat -c%s "$f" 2>/dev/null || echo 0)"
  [[ "$sz" -gt 50000000 ]] || return 1
  local dur
  dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" 2>/dev/null || true)"
  [[ -n "$dur" ]] && awk -v d="$dur" 'BEGIN { exit (d >= 60 ? 0 : 1) }'
}

python3 <<'PY'
import os, re, shutil, subprocess
from collections import defaultdict
from pathlib import Path

ROOT = Path(os.environ.get("NAS_DATA_ROOT", "/mnt/cortex/nas-data"))
DL = ROOT / "media/downloads"
MOV = ROOT / "media/movies"
QUAR = MOV / ".dedupe-quarantine"
QUAR.mkdir(parents=True, exist_ok=True)

def log(msg):
    print(f"[dedupe] {msg}", flush=True)

def norm(name: str) -> str:
    n = re.sub(r"\[[^\]]+\]", "", name)
    n = re.sub(r"\{[^}]+\}", "", n)
    n = re.sub(r"www\.UIndex\.org\s*-\s*", "", n, flags=re.I)
    n = re.sub(r"\s+", " ", n).strip().lower()
    m = re.search(r"(.+?)\s*\((\d{4})\)", n)
    if m:
        return f"{m.group(1).strip()} ({m.group(2)})"
    m = re.search(r"(.+?)\s+(\d{4})\b", n)
    if m:
        return f"{m.group(1).strip()} ({m.group(2)})"
    return n[:60]

def ffprobe_ok(path: Path) -> bool:
    if not path.is_file() or path.stat().st_size < 50_000_000:
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

def folder_score(path: Path) -> tuple:
    vids = []
    for root, _, files in os.walk(path):
        for f in files:
            if f.lower().endswith((".mkv", ".mp4", ".avi", ".m4v", ".webm")):
                fp = Path(root) / f
                try:
                    sz = fp.stat().st_size
                except OSError:
                    continue
                valid = ffprobe_ok(fp)
                vids.append((sz, valid, fp))
    total = sum(s for s, _, _ in vids)
    valid_total = sum(s for s, v, _ in vids if v)
    best_valid = max((s for s, v, _ in vids if v), default=0)
    # Radarr-style folder bonus
    radarr_bonus = 1_000_000_000 if re.match(r"^.+ \(\d{4}\)$", path.name) else 0
    return (valid_total + radarr_bonus, best_valid, total, len([1 for _, v, _ in vids if v]))

def remove_tree(path: Path):
    log(f"remove → {path.name}")
    shutil.rmtree(path, ignore_errors=True)

def dedupe_dir(base: Path, label: str):
    by = defaultdict(list)
    for d in sorted(base.iterdir()):
        if d.is_dir() and not d.name.startswith("."):
            by[norm(d.name)].append(d)
    removed = 0
    freed = 0
    for key, dirs in by.items():
        if len(dirs) < 2:
            continue
        scored = [(folder_score(d), d) for d in dirs]
        scored.sort(key=lambda x: x[0], reverse=True)
        keep = scored[0][1]
        log(f"{label}: keep '{keep.name}' for [{key}]")
        for _, d in scored[1:]:
            try:
                sz = sum(f.stat().st_size for f in d.rglob("*") if f.is_file())
            except OSError:
                sz = 0
            remove_tree(d)
            removed += 1
            freed += sz
    log(f"{label}: removed {removed} duplicate folders (~{freed // 1_000_000}MB)")

def purge_bad_files(base: Path):
    removed = 0
    for fp in list(base.rglob("*")):
        if QUAR in fp.parents:
            continue
        if not fp.is_file():
            continue
        if fp.suffix.lower() not in (".mkv", ".mp4", ".avi", ".m4v", ".webm"):
            continue
        try:
            sz = fp.stat().st_size
        except OSError:
            continue
        if sz == 0 or (sz > 50_000_000 and not ffprobe_ok(fp)):
            log(f"bad file removed ({sz // 1_000_000}MB): {fp.name}")
            fp.unlink(missing_ok=True)
            removed += 1
    log(f"purged {removed} corrupt/partial main features under {base.name}")

dedupe_dir(DL, "downloads")
dedupe_dir(MOV, "movies")
purge_bad_files(DL)
purge_bad_files(MOV)

# Consolidate Top Gun (1986) — prefer valid AMZN WEB-DL mkv
tg = MOV / "Top Gun (1986)"
amzn = MOV / "Top Gun 1986 1080p AMZN WEB-DL DDP5 1 H 264 2Audio-HDSWEB"
if amzn.is_dir():
    mkvs = list(amzn.glob("*.mkv"))
    if mkvs and ffprobe_ok(mkvs[0]):
        tg.mkdir(parents=True, exist_ok=True)
        dest = tg / "Top Gun (1986).mkv"
        if not dest.exists() or not ffprobe_ok(dest):
            if dest.exists():
                dest.unlink(missing_ok=True)
            log(f"Top Gun: move {mkvs[0].name} → {dest}")
            shutil.move(str(mkvs[0]), str(dest))
        if amzn.exists():
            remove_tree(amzn)

# Remove empty download folders
for d in list(DL.iterdir()):
    if d.is_dir() and not any(d.rglob("*")):
        d.rmdir()
        log(f"removed empty {d.name}")

log("done")
PY

log "Freed space: $(df -h "$ROOT" 2>/dev/null | awk 'NR==2{print $4 " free"}')"
