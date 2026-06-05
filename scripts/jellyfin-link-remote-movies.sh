#!/usr/bin/env bash
# Expose Steve's CIFS movies inside your existing Jellyfin /media/movies tree (reliable scan).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_ENV="${JELLYFIN_REMOTE_ENV:-$ROOT/deploy/nas/.remote-storage.env}"
NAS_ENV="${NAS_ENV_FILE:-$ROOT/deploy/nas/.env}"

read_env_var() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  grep -m1 "^${key}=" "$file" 2>/dev/null | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

NAS_ROOT="${NAS_DATA_ROOT:-$(read_env_var "$NAS_ENV" NAS_DATA_ROOT)}"
NAS_ROOT="${NAS_ROOT:-/mnt/cortex/nas-data}"

[[ -f "$REMOTE_ENV" ]] && set -a && source "$REMOTE_ENV" && set +a
# shellcheck disable=SC1091
source "$ROOT/scripts/jellyfin-remote-movies-dir.sh"

LINK_NAME="${JELLYFIN_LOCAL_LINK_NAME:-Steve-Movies}"
SRC="$JELLYFIN_REMOTE_MOVIES_DIR"
DEST="${NAS_ROOT}/media/movies/${LINK_NAME}"

log() { echo "[jellyfin-link] $*"; }

if ! mountpoint -q "${JELLYFIN_REMOTE_MOUNT:-/mnt/cortex/jellyfin-remote}" 2>/dev/null; then
  log "CIFS not mounted — run: npm run nas:remote-storage:mount"
  exit 1
fi

if [[ ! -d "$SRC" ]]; then
  log "Missing $SRC — run: npm run nas:remote-storage:mount"
  exit 1
fi

sudo mkdir -p "$DEST"

if mountpoint -q "$DEST" 2>/dev/null; then
  log "Already linked: $DEST"
else
  log "bind mount $SRC → $DEST"
  sudo mount --bind "$SRC" "$DEST"
fi

n=$(find "$DEST" -maxdepth 1 -type f \( -iname '*.mp4' -o -iname '*.mkv' \) | wc -l)
log "Linked $n videos → media/movies/$LINK_NAME (from $SRC)"
log ""
log "Next:"
log "  npm run nas:jellyfin:recreate"
log "  Jellyfin → Dashboard → Libraries → Movies → Scan library"
