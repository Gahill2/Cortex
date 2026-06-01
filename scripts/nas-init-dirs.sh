#!/usr/bin/env bash
# Create split NAS directory tree on the host.
set -euo pipefail

ROOT="${NAS_DATA_ROOT:-/data}"

dirs=(
  "$ROOT/cortex/postgres"
  "$ROOT/cortex/api"
  "$ROOT/cortex/backups"
  "$ROOT/media/movies"
  "$ROOT/media/tv"
  "$ROOT/media/music"
  "$ROOT/media/downloads"
  "$ROOT/media/downloads/incomplete"
  "$ROOT/media/downloads/complete"
  "$ROOT/appdata/gluetun"
  "$ROOT/appdata/qbittorrent"
  "$ROOT/appdata/sabnzbd"
  "$ROOT/appdata/pihole/etc-pihole"
  "$ROOT/appdata/pihole/etc-dnsmasq.d"
  "$ROOT/appdata/icloudpd"
  "$ROOT/photos/icloud-import"
  "$ROOT/appdata/prowlarr"
  "$ROOT/appdata/radarr"
  "$ROOT/appdata/sonarr"
  "$ROOT/photos"
  "$ROOT/cloud"
  "$ROOT/appdata/jellyfin/config"
  "$ROOT/appdata/nextcloud/db"
  "$ROOT/appdata/nextcloud/html"
  "$ROOT/appdata/immich/postgres"
  "$ROOT/appdata/immich/redis"
  "$ROOT/appdata/immich/model-cache"
  "$ROOT/appdata/backup"
  "$ROOT/backups/restic"
  "$ROOT/backups/dumps"
  "$ROOT/backups/manifests"
)

echo "Creating NAS directories under ${ROOT} ..."
for d in "${dirs[@]}"; do
  mkdir -p "$d"
done

echo "Done. Set in deploy/homelab/.env:  CORTEX_DATA_DIR=${ROOT}/cortex"
echo "Set in deploy/nas/.env:           NAS_DATA_ROOT=${ROOT}"
