#!/usr/bin/env bash
# Merge legacy ~/nas-data/media into the live NAS path (Docker/Jellyfin use NAS_DATA_ROOT).
set -euo pipefail

HOME_MEDIA="${HOME_NAS_MEDIA:-/home/greyhill/nas-data/media}"
LIVE_ROOT="${NAS_DATA_ROOT:-/mnt/cortex/nas-data}"
LIVE_MEDIA="$LIVE_ROOT/media"

log() { echo "[sync-home-nas] $*"; }

if [[ ! -d "$HOME_MEDIA" ]]; then
  log "No $HOME_MEDIA — nothing to sync"
  exit 0
fi

if [[ -L "$HOME_MEDIA" ]]; then
  log "Already linked: $HOME_MEDIA -> $(readlink -f "$HOME_MEDIA")"
  exit 0
fi

mkdir -p "$LIVE_MEDIA/downloads" "$LIVE_MEDIA/movies" "$LIVE_MEDIA/tv"

log "Merging downloads → $LIVE_MEDIA/downloads"
rsync -aH --info=progress2 "$HOME_MEDIA/downloads/" "$LIVE_MEDIA/downloads/"

for sub in movies tv music; do
  [[ -d "$HOME_MEDIA/$sub" ]] || continue
  log "Merging $sub"
  rsync -aH "$HOME_MEDIA/$sub/" "$LIVE_MEDIA/$sub/"
done

STAMP="$(date +%Y%m%d%H%M)"
BACKUP="${HOME_MEDIA}.bak-${STAMP}"
log "Backup home media tree: $BACKUP"
mv "$HOME_MEDIA" "$BACKUP"
ln -sfn "$LIVE_MEDIA" "$HOME_MEDIA"
log "Symlink: $HOME_MEDIA -> $LIVE_MEDIA"
log "Done. Run: NAS_DATA_ROOT=$LIVE_ROOT npm run media:import-library"
