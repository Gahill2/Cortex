#!/usr/bin/env bash
# Partition and mount the second ~512GB disk (default /dev/sdb) for Cortex local data.
# Run in a real terminal on the cortex PC (requires sudo):
#   npm run storage:setup
#   npm run storage:setup -- --dry-run
#   npm run storage:setup -- --yes
#
# Layout (GPT):
#   sdb1  ~220 GiB  ext4  cortex-obsidian  -> /mnt/cortex/obsidian  (Notes / Obsidian vault)
#   sdb2  rest       ext4  cortex-archive   -> /mnt/cortex/archive   (media, backups, exports)
set -euo pipefail

DISK="${CORTEX_STORAGE_DISK:-/dev/sdb}"
DRY_RUN=0
ASSUME_YES=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --yes) ASSUME_YES=1 ;;
    -h|--help)
      sed -n '1,20p' "$0"
      exit 0
      ;;
  esac
done

log() { echo "[storage-setup] $*"; }
run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] $*"
  else
    sudo "$@"
  fi
}

if [[ ! -b "$DISK" ]]; then
  echo "Block device $DISK not found. Set CORTEX_STORAGE_DISK if your disk is different." >&2
  lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT,MODEL | grep -E 'disk|part' || true
  exit 1
fi

if mount | grep -q "^${DISK}"; then
  echo "$DISK has mounted partitions; unmount them first or pick another disk." >&2
  mount | grep "$DISK" || true
  exit 1
fi

if [[ "$(lsblk -no TYPE "$DISK" | head -1)" != "disk" ]]; then
  echo "$DISK is not a whole disk (use e.g. /dev/sdb not /dev/sdb1)." >&2
  exit 1
fi

log "Target disk:"
lsblk -o NAME,SIZE,TYPE,FSTYPE,MODEL,MOUNTPOINT "$DISK" "${DISK}"* 2>/dev/null || lsblk "$DISK"

EXISTING_FS="$(lsblk -no FSTYPE "${DISK}1" 2>/dev/null || true)"
if [[ -n "$EXISTING_FS" ]]; then
  log "Partition 1 currently has filesystem: $EXISTING_FS"
  if [[ "$EXISTING_FS" == "ntfs" ]]; then
    log "Attempting read-only peek at NTFS (to see if you need to copy data off first)..."
  fi
fi

echo ""
echo "This will ERASE all data on $DISK and create:"
echo "  ${DISK}1  ~220 GiB  ext4  -> /mnt/cortex/obsidian"
echo "  ${DISK}2  remainder ext4  -> /mnt/cortex/archive"
echo ""
if [[ "$ASSUME_YES" -ne 1 ]]; then
  read -r -p "Type YES to continue: " confirm
  [[ "$confirm" == "YES" ]] || { echo "Aborted."; exit 1; }
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "Dry run complete (no changes made)."
  exit 0
fi

run wipefs -a "$DISK"
run parted -s "$DISK" mklabel gpt
run parted -s "$DISK" mkpart cortex-obsidian ext4 1MiB 220GiB
run parted -s "$DISK" mkpart cortex-archive ext4 220GiB 100%
run partprobe "$DISK" || sleep 2

run mkfs.ext4 -F -L cortex-obsidian "${DISK}1"
run mkfs.ext4 -F -L cortex-archive "${DISK}2"

run mkdir -p /mnt/cortex/obsidian /mnt/cortex/archive

UUID1="$(sudo blkid -s UUID -o value "${DISK}1")"
UUID2="$(sudo blkid -s UUID -o value "${DISK}2")"

FSTAB_MARK="# cortex-local-storage (setup-storage-disk.sh)"
if ! grep -q "$FSTAB_MARK" /etc/fstab 2>/dev/null; then
  run bash -c "cat >> /etc/fstab" <<EOF

$FSTAB_MARK
UUID=$UUID1  /mnt/cortex/obsidian  ext4  defaults,noatime  0  2
UUID=$UUID2  /mnt/cortex/archive   ext4  defaults,noatime  0  2
EOF
fi

run mount -a

run mkdir -p /mnt/cortex/obsidian/greyhill_brain
run mkdir -p /mnt/cortex/archive/{backups,media,exports,docker-volumes}
run chown -R "$(whoami):$(id -gn)" /mnt/cortex/obsidian /mnt/cortex/archive

log "Done. Mounts:"
df -h /mnt/cortex/obsidian /mnt/cortex/archive
log "Next steps:"
echo "  1. npm run storage:vault          # Obsidian vault on sdb1"
echo "  2. npm run nas:migrate-to-archive # move Jellyfin/Radarr media to sdb2 (~256 GiB)"
echo "  3. npm run server:sync-local && npm run server:deploy"
