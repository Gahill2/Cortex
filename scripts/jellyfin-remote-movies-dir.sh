#!/usr/bin/env bash
# Resolve host path to Steve's movies (bind mount root vs nested Users share).
# Source after loading .remote-storage.env:
#   source scripts/jellyfin-remote-movies-dir.sh
#   echo "$JELLYFIN_REMOTE_MOVIES_DIR"
set -euo pipefail

CIFS_MOUNT="${JELLYFIN_REMOTE_MOUNT:-/mnt/cortex/jellyfin-remote}"
PREFIX="${JELLYFIN_REMOTE_SMB_PREFIXPATH:-Steve/Videos/Movies}"

if [[ -n "${JELLYFIN_REMOTE_MOVIES_DIR:-}" && -d "$JELLYFIN_REMOTE_MOVIES_DIR" ]]; then
  :
elif mountpoint -q "$CIFS_MOUNT" 2>/dev/null; then
  if find "$CIFS_MOUNT" -maxdepth 1 -type f \( -iname '*.mp4' -o -iname '*.mkv' \) 2>/dev/null | grep -q .; then
    JELLYFIN_REMOTE_MOVIES_DIR="$CIFS_MOUNT"
  elif [[ -d "${CIFS_MOUNT}/${PREFIX}" ]]; then
    JELLYFIN_REMOTE_MOVIES_DIR="${CIFS_MOUNT}/${PREFIX}"
  else
    JELLYFIN_REMOTE_MOVIES_DIR="${CIFS_MOUNT}/${PREFIX}"
  fi
else
  JELLYFIN_REMOTE_MOVIES_DIR="${CIFS_MOUNT}/${PREFIX}"
fi

export JELLYFIN_REMOTE_MOVIES_DIR
