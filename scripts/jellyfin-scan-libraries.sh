#!/usr/bin/env bash
# Verify dual-library paths and prompt Jellyfin scan (his + your movies on cortex).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_ENV="${JELLYFIN_REMOTE_ENV:-$ROOT/deploy/nas/.remote-storage.env}"
MOUNT="${JELLYFIN_REMOTE_MOUNT:-/mnt/cortex/jellyfin-remote}"
[[ -f "$REMOTE_ENV" ]] && set -a && source "$REMOTE_ENV" && set +a
MOUNT="${JELLYFIN_REMOTE_MOUNT:-$MOUNT}"
# shellcheck disable=SC1091
source "$ROOT/scripts/jellyfin-remote-movies-dir.sh"

bash "$ROOT/scripts/jellyfin-sync-library-paths.sh"

echo ""
echo "=== Cortex Jellyfin (yours + his) ==="
echo "  Open: http://100.104.120.29:8096"
echo "  NOT Steve's PC IP — his files are linked into YOUR server."
echo ""

if ! mountpoint -q "$MOUNT" 2>/dev/null; then
  echo "CIFS offline — Steve's PC must be on, then:"
  echo "  npm run nas:remote-storage:mount"
  exit 1
fi

remote_dir="$JELLYFIN_REMOTE_MOVIES_DIR"
n=$(find "$remote_dir" -maxdepth 1 -type f \( -iname '*.mp4' -o -iname '*.mkv' \) 2>/dev/null | wc -l)
echo "His movies reachable: $n files under $remote_dir"

docker exec cortex-nas-jellyfin-1 grep '<Path>' /config/root/default/Movies/options.xml 2>/dev/null || true

echo ""
echo "Scan libraries (required once after adding his path):"
echo "  Dashboard → Libraries → ⋮ on Movies → Scan library"
echo "  (or Scan All Libraries)"
echo ""
echo "Look for: FNAF Movie, Sonic 3, Toy Story 1, Rio, etc. alongside your titles."
