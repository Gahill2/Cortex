#!/usr/bin/env bash
# List CIFS/SMB shares on a Tailscale host (for Jellyfin remote library setup).
#   cp deploy/nas/.remote-storage.env.example deploy/nas/.remote-storage.env
#   # set JELLYFIN_REMOTE_HOST, JELLYFIN_REMOTE_SMB_USER, JELLYFIN_REMOTE_SMB_PASSWORD
#   npm run nas:remote-storage:list-shares
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${JELLYFIN_REMOTE_ENV:-$ROOT/deploy/nas/.remote-storage.env}"

HOST="${1:-}"
USER="${2:-}"
PASS="${3:-}"

if [[ -z "$HOST" && -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  HOST="${JELLYFIN_REMOTE_HOST:-}"
  USER="${JELLYFIN_REMOTE_SMB_USER:-}"
  PASS="${JELLYFIN_REMOTE_SMB_PASSWORD:-}"
fi

HOST="${HOST:?Set JELLYFIN_REMOTE_HOST in $ENV_FILE or pass as first argument}"

if ! command -v smbclient &>/dev/null; then
  echo "Install smbclient: sudo apt-get install -y smbclient" >&2
  exit 1
fi

if ! ping -c 1 -W 3 "$HOST" &>/dev/null; then
  echo "Cannot reach $HOST (Tailscale). Run: tailscale status" >&2
  exit 1
fi

echo "CIFS shares on //$HOST (Tailscale):"
echo ""

if [[ -n "$USER" && -n "$PASS" ]]; then
  smbclient -L "//${HOST}" -U "${USER}%${PASS}" 2>&1 | sed -n '/Sharename/,/IPC/p'
else
  echo "No credentials in $ENV_FILE — trying anonymous (often denied on Windows):"
  smbclient -L "//${HOST}" -N 2>&1 || true
  echo ""
  echo "Set JELLYFIN_REMOTE_SMB_USER and JELLYFIN_REMOTE_SMB_PASSWORD in $ENV_FILE, then re-run."
fi
