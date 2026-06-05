#!/usr/bin/env bash
# Recreate Jellyfin when "permission denied" on docker stop (snap Docker AppArmor).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STOP="$ROOT/scripts/homelab-docker-stop-container.sh"
NAS_DIR="$ROOT/deploy/nas"
REMOTE_ENV="${JELLYFIN_REMOTE_ENV:-$ROOT/deploy/nas/.remote-storage.env}"
[[ -f "$REMOTE_ENV" ]] && set -a && source "$REMOTE_ENV" && set +a
# shellcheck disable=SC1091
[[ -f "$REMOTE_ENV" ]] && source "$ROOT/scripts/jellyfin-remote-movies-dir.sh"
MOUNT="${JELLYFIN_REMOTE_MOUNT:-/mnt/cortex/jellyfin-remote}"

mkdir -p "$MOUNT"

for name in cortex-nas-jellyfin-1 b7acd6481e07_cortex-nas-jellyfin-1; do
  if docker ps -aq -f "name=^${name}$" 2>/dev/null | grep -q .; then
    echo "Removing $name (workaround stop)..."
    bash "$STOP" "$name" || true
  fi
done

echo "Starting Jellyfin..."
(cd "$NAS_DIR" && docker compose --env-file .env up -d jellyfin)

echo ""
docker ps --filter name=cortex-nas-jellyfin-1 --format 'table {{.Names}}\t{{.Status}}'
echo ""
docker inspect cortex-nas-jellyfin-1 --format '{{range .Mounts}}{{.Destination}} <- {{.Source}}{{"\n"}}{{end}}' 2>/dev/null || true
echo ""
if mountpoint -q "$MOUNT" 2>/dev/null; then
  echo "CIFS mount OK at $MOUNT"
  STEVE_LINK="${NAS_DATA_ROOT:-/mnt/cortex/nas-data}/media/movies/Steve-Movies"
  if [[ -d "$STEVE_LINK" ]]; then
    n=$(find "$STEVE_LINK" -maxdepth 1 -type f \( -iname '*.mp4' -o -iname '*.mkv' \) 2>/dev/null | wc -l)
    echo "Steve-Movies link: $n videos (Jellyfin path /media/movies/Steve-Movies)"
  fi
  remote_dir="${JELLYFIN_REMOTE_MOVIES_DIR:-$MOUNT}"
  n=$(find "$remote_dir" -maxdepth 1 -type f \( -iname '*.mp4' -o -iname '*.mkv' \) 2>/dev/null | wc -l)
  if [[ "$n" -gt 0 ]]; then
    echo "CIFS remote: $n videos at $remote_dir (/media-remote in container)"
  fi
else
  echo "CIFS not mounted yet — run: npm run nas:remote-storage:mount"
fi
echo "Then Jellyfin → Libraries → Scan all libraries."
