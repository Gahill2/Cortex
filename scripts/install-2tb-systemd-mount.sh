#!/usr/bin/env bash
# Install systemd mount unit so the 2TB disk mounts at boot (before Docker).
# Run once in a real terminal: npm run storage:2tb:install-systemd
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_SRC="$ROOT/deploy/systemd/mnt-cortex-hdd2tb.mount"
UNIT_DST="/etc/systemd/system/mnt-cortex-hdd2tb.mount"

log() { echo "[2tb-systemd] $*"; }

[[ -f "$UNIT_SRC" ]] || { echo "Missing $UNIT_SRC" >&2; exit 1; }

log "Installing $UNIT_DST"
sudo cp "$UNIT_SRC" "$UNIT_DST"
sudo systemctl daemon-reload
sudo systemctl enable mnt-cortex-hdd2tb.mount
sudo systemctl start mnt-cortex-hdd2tb.mount || true

if mountpoint -q /mnt/cortex/hdd2tb; then
  df -h /mnt/cortex/hdd2tb
  log "Enabled. Media symlink: $(readlink -f /mnt/cortex/nas-data/media 2>/dev/null || echo n/a)"
else
  log "Unit installed but mount failed — check: systemctl status mnt-cortex-hdd2tb.mount"
  exit 1
fi
