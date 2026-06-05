#!/usr/bin/env bash
# Move Jellyfin / Radarr / Sonarr media libraries to the 2TB disk (keeps appdata on nas-data SSD).
#
# Prereq: npm run storage:2tb:mount
#
#   npm run storage:2tb:wire          # interactive
#   npm run storage:2tb:wire -- --yes # non-interactive copy
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOUNT="${CORTEX_2TB_MOUNT:-/mnt/cortex/hdd2tb}"
NAS_ROOT="${NAS_DATA_ROOT:-/mnt/cortex/nas-data}"
OLD_MEDIA="${NAS_ROOT}/media"
NEW_MEDIA="${MOUNT}/media"
ASSUME_YES=0
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --yes) ASSUME_YES=1 ;;
    --dry-run) DRY_RUN=1 ;;
  esac
done

log() { echo "[2tb-wire] $*"; }

if ! mountpoint -q "$MOUNT" 2>/dev/null; then
  echo "2TB disk not mounted at $MOUNT" >&2
  echo "Run first:  npm run storage:2tb:mount" >&2
  lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINT /dev/sdc /dev/sdc2 2>/dev/null || true
  exit 1
fi

if [[ -L "$OLD_MEDIA" ]]; then
  target="$(readlink -f "$OLD_MEDIA")"
  log "Already wired: $OLD_MEDIA -> $target"
  df -h "$MOUNT" "$NAS_ROOT"
  exit 0
fi

if [[ ! -d "$OLD_MEDIA" ]]; then
  echo "Missing $OLD_MEDIA" >&2
  exit 1
fi

AVAIL="$(df -BG "$MOUNT" | awk 'NR==2 {print $4}' | tr -d G)"
NEED="$(du -sBG "$OLD_MEDIA" 2>/dev/null | awk '{print $1}' | tr -d G || echo 400)"
log "Copy ~${NEED}G media from $OLD_MEDIA to $NEW_MEDIA (disk free ~${AVAIL}G)"
df -h "$MOUNT" "$NAS_ROOT"

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "Dry run — would rsync and symlink $OLD_MEDIA -> $NEW_MEDIA"
  exit 0
fi

if [[ "$ASSUME_YES" -ne 1 ]]; then
  read -r -p "Stop media/Jellyfin containers and copy? Type YES: " confirm
  [[ "$confirm" == "YES" ]] || { echo "Aborted."; exit 1; }
fi

log "Stopping stacks (ignore errors if down)..."
(cd "$ROOT/deploy/nas/media-stack" && docker compose --env-file .env stop 2>/dev/null) || true
(cd "$ROOT/deploy/nas" && docker compose --env-file .env stop jellyfin 2>/dev/null) || true

mkdir -p "$NEW_MEDIA"/{movies,tv,music,downloads/incomplete,downloads/complete}

if [[ "$DRY_RUN" -eq 0 ]]; then
  log "Copying (rsync — can take a while)..."
  rsync -aH --info=progress2 "$OLD_MEDIA/" "$NEW_MEDIA/"
fi

STAMP="$(date +%Y%m%d%H%M)"
mv "$OLD_MEDIA" "${OLD_MEDIA}.bak-${STAMP}"
ln -sfn "$NEW_MEDIA" "$OLD_MEDIA"
log "Symlink: $OLD_MEDIA -> $NEW_MEDIA (backup dir: ${OLD_MEDIA}.bak-${STAMP})"

log "Starting Jellyfin + media stack..."
(cd "$ROOT/deploy/nas" && docker compose --env-file .env start jellyfin 2>/dev/null) || \
  (cd "$ROOT/deploy/nas" && docker compose --env-file .env up -d jellyfin)
(cd "$ROOT/deploy/nas/media-stack" && docker compose --env-file .env up -d)

df -h "$MOUNT" "$NAS_ROOT"
log "Done. Radarr/Sonarr roots stay /media/movies and /media/tv (same paths inside containers)."
