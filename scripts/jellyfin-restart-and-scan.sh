#!/usr/bin/env bash
# Restart Jellyfin so new library paths in options.xml take effect, then scan.
# Jellyfin only picks up extra PathInfos on startup — a UI scan alone is not enough.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "1. Sync library paths in config..."
bash "$ROOT/scripts/jellyfin-sync-library-paths.sh"

echo ""
echo "2. Restart Jellyfin (required after adding /media-remote path)..."
bash "$ROOT/scripts/nas-docker-recreate-jellyfin.sh"

echo ""
echo "3. Wait for Jellyfin to become healthy..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8096/health >/dev/null 2>&1; then
    echo "   Jellyfin healthy."
    break
  fi
  sleep 2
done

echo ""
echo "4. Trigger library scan in the UI:"
echo "   http://100.104.120.29:8096 → Dashboard → Libraries → Movies → ⋮ → Scan library"
echo ""
bash "$ROOT/scripts/jellyfin-scan-libraries.sh"
