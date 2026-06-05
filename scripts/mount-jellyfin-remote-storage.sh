#!/usr/bin/env bash
# Mount his CIFS share over Tailscale for Jellyfin (/media-remote).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${JELLYFIN_REMOTE_ENV:-$ROOT/deploy/nas/.remote-storage.env}"
CREDS_FILE="${JELLYFIN_REMOTE_CREDS:-$ROOT/deploy/nas/.remote-storage.creds}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy deploy/nas/.remote-storage.env.example" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

HOST="${JELLYFIN_REMOTE_HOST:?Set JELLYFIN_REMOTE_HOST}"
MOUNT="${JELLYFIN_REMOTE_MOUNT:-/mnt/cortex/jellyfin-remote}"
STAGING="${JELLYFIN_REMOTE_STAGING:-${MOUNT}-cifs}"
USER="${JELLYFIN_REMOTE_SMB_USER:-}"
PASS="${JELLYFIN_REMOTE_SMB_PASSWORD:-}"
DOMAIN="${JELLYFIN_REMOTE_SMB_DOMAIN:-WORKGROUP}"
SHARE="${JELLYFIN_REMOTE_SMB_SHARE:-}"
PREFIX="${JELLYFIN_REMOTE_SMB_PREFIXPATH:-}"
SHARE_MOVIES="${JELLYFIN_REMOTE_SMB_SHARE_MOVIES:-}"
SHARE_TV="${JELLYFIN_REMOTE_SMB_SHARE_TV:-}"

log() { echo "[jellyfin-cifs] $*"; }
fail() { echo "[jellyfin-cifs] ERROR: $*" >&2; exit 1; }

umount_if_mounted() {
  local target="$1"
  mountpoint -q "$target" 2>/dev/null || return 0
  log "Unmounting $target ..."
  sudo umount "$target" || sudo umount -l "$target" || fail "Could not unmount $target"
}

if ! ping -c 1 -W 3 "$HOST" &>/dev/null; then
  fail "Cannot reach $HOST on Tailscale (tailscale status)"
fi

if [[ -z "$USER" || -z "$PASS" ]]; then
  fail "Set JELLYFIN_REMOTE_SMB_USER and JELLYFIN_REMOTE_SMB_PASSWORD in $ENV_FILE"
fi

if [[ -z "$SHARE" && ( -z "$SHARE_MOVIES" || -z "$SHARE_TV" ) ]]; then
  fail "Set JELLYFIN_REMOTE_SMB_SHARE or both SHARE_MOVIES and SHARE_TV"
fi

test_share="${SHARE:-${SHARE_MOVIES}}"
if command -v smbclient &>/dev/null; then
  log "Testing SMB login (//$HOST) as $USER..."
  if ! timeout 12 smbclient -L "//${HOST}" -U "${USER}%${PASS}" >/dev/null 2>&1; then
    fail "SMB logon failed for user '$USER'."
  fi
  smb_cmd='ls'
  [[ -n "$PREFIX" ]] && smb_cmd="cd ${PREFIX}; ls"
  log "Testing //$HOST/$test_share ${PREFIX:+(path $PREFIX)}..."
  out="$(timeout 12 smbclient "//${HOST}/${test_share}" -U "${USER}%${PASS}" -c "$smb_cmd" 2>&1)" || {
    fail "SMB test failed: $out"
  }
  log "SMB test OK."
fi

if ! command -v mount.cifs &>/dev/null; then
  log "Installing cifs-utils (sudo)..."
  sudo apt-get update -qq && sudo apt-get install -y cifs-utils
fi

install -d -m 700 "$(dirname "$CREDS_FILE")"
printf 'username=%s\npassword=%s\ndomain=%s\n' "$USER" "$PASS" "$DOMAIN" >"$CREDS_FILE"
chmod 600 "$CREDS_FILE"

CIFS_OPTS="credentials=$CREDS_FILE,uid=$(id -u),gid=$(id -g),file_mode=0644,dir_mode=0755,iocharset=utf8,vers=3.0,noserverino"

mount_cifs() {
  local unc="$1" target="$2"
  sudo mkdir -p "$target"
  if mountpoint -q "$target"; then
    log "Already mounted: $target"
    return 0
  fi
  log "sudo mount -t cifs $unc → $target"
  sudo mount -t cifs "$unc" "$target" -o "$CIFS_OPTS" || fail "mount.cifs failed for $unc"
}

# Remount cleanly (bind mount may be stacked on staging)
umount_if_mounted "$MOUNT"
umount_if_mounted "$STAGING"

if [[ -n "$SHARE_MOVIES" && -n "$SHARE_TV" ]]; then
  mount_cifs "//${HOST}/${SHARE_MOVIES}" "${MOUNT}/movies"
  mount_cifs "//${HOST}/${SHARE_TV}" "${MOUNT}/tv"
elif [[ -n "$PREFIX" ]]; then
  # prefixpath is unreliable on many kernels — mount share then bind the movies subfolder
  mount_cifs "//${HOST}/${SHARE}" "$STAGING"
  src="${STAGING}/${PREFIX}"
  [[ -d "$src" ]] || fail "Path missing after mount: $src"
  sudo mkdir -p "$MOUNT"
  if ! mountpoint -q "$MOUNT"; then
    log "bind mount $src → $MOUNT"
    sudo mount --bind "$src" "$MOUNT"
  fi
else
  mount_cifs "//${HOST}/${SHARE}" "$MOUNT"
fi

log "Mounted. Movies visible at $MOUNT:"
ls -la "$MOUNT" | head -15
if ls "$MOUNT"/*.mp4 "$MOUNT"/*.mkv 2>/dev/null | head -1 | grep -q .; then
  log "OK — movies at $MOUNT (Jellyfin: /media-remote)."
else
  log "Movies under ${MOUNT}/${PREFIX} — set JELLYFIN_REMOTE_MOVIES_PATH accordingly."
fi
log "Next:"
log "  npm run nas:jellyfin:link-remote"
log "  npm run nas:jellyfin:recreate"
log "  Dashboard → Libraries → Movies → Scan library"
