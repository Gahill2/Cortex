#!/usr/bin/env bash
# Mount the ~2TB Hitachi drive (sdc) for extra media storage.
# Run in a real terminal: npm run storage:2tb:mount
#
# Detected: /dev/sdc2 ~1.8T (NTFS). For Jellyfin/Radarr, ext4 is recommended on a fresh disk.
set -euo pipefail

DISK="${CORTEX_2TB_DISK:-/dev/sdc}"
PART="${CORTEX_2TB_PART:-/dev/sdc2}"
MOUNT="${CORTEX_2TB_MOUNT:-/mnt/cortex/hdd2tb}"

log() { echo "[2tb-mount] $*"; }

# Mount in the host namespace when sudo needs a TTY (docker group + privileged container).
mount_via_nsenter() {
  local mnt_opts="$1"
  if ! groups | grep -qw docker; then
    return 1
  fi
  log "Using docker nsenter (no sudo TTY)..."
  docker run --rm --privileged --pid=host alpine:3.20 sh -c "
    set -e
    nsenter -t 1 -m -- umount -l ${MOUNT} 2>/dev/null || true
    nsenter -t 1 -m -- mount -t ntfs3 -o ${mnt_opts} ${PART} ${MOUNT} 2>/dev/null ||
      nsenter -t 1 -m -- mount -t ntfs-3g -o ${mnt_opts} ${PART} ${MOUNT}
    nsenter -t 1 -m -- df -h ${MOUNT}
  "
}

if [[ ! -b "$PART" ]]; then
  echo "Partition $PART not found. Disks:" >&2
  lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT,MODEL
  exit 1
fi

log "Disk layout:"
lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINT "$DISK" "${DISK}"*

if mountpoint -q "$MOUNT" 2>/dev/null && test -r "$MOUNT/media" 2>/dev/null; then
  log "Already mounted at $MOUNT"
  df -h "$MOUNT"
  exit 0
fi

if mount | grep -q " on ${MOUNT} " 2>/dev/null && ! test -r "$MOUNT" 2>/dev/null; then
  log "Stale mount at $MOUNT — remounting..."
  mount_via_nsenter "uid=$(id -u),gid=$(id -g),umask=022" || true
  if mountpoint -q "$MOUNT" 2>/dev/null && test -r "$MOUNT/media" 2>/dev/null; then
    df -h "$MOUNT"
    exit 0
  fi
fi

FSTYPE="$(lsblk -no FSTYPE "$PART" | tr -d ' ')"

if [[ "$FSTYPE" == "ntfs" ]]; then
  log "NTFS detected — mounting read-write (ntfs3 preferred)."
  NTFS_OPTS="uid=$(id -u),gid=$(id -g),umask=022"
  mkdir -p "$MOUNT" 2>/dev/null || sudo mkdir -p "$MOUNT"
  if sudo -n mount -t ntfs3 -o "$NTFS_OPTS" "$PART" "$MOUNT" 2>/dev/null; then
    :
  elif sudo mount -t ntfs3 -o "$NTFS_OPTS" "$PART" "$MOUNT" 2>/dev/null; then
    :
  elif sudo mount -t ntfs-3g -o "$NTFS_OPTS" "$PART" "$MOUNT" 2>/dev/null; then
    :
  elif mount_via_nsenter "$NTFS_OPTS"; then
    :
  else
    echo "Mount failed. Run in a terminal: npm run storage:2tb:mount" >&2
    exit 1
  fi
  if ! grep -q "$MOUNT" /etc/fstab 2>/dev/null; then
    PART_UUID="$(sudo blkid -s UUID -o value "$PART" 2>/dev/null || true)"
    if [[ -n "${PART_UUID:-}" ]]; then
      echo "UUID=$PART_UUID  $MOUNT  ntfs3  defaults,uid=$(id -u),gid=$(id -g),umask=022  0  0" | sudo tee -a /etc/fstab
    fi
  fi
  sudo mkdir -p "$MOUNT/media"
  sudo chown -R "$(whoami):$(id -gn)" "$MOUNT" 2>/dev/null || true
  df -h "$MOUNT"
  log "Next: npm run storage:2tb:wire -- --yes   # move movies/tv to $MOUNT/media"
  log "Optional ext4 (erases disk): sudo umount $MOUNT && sudo mkfs.ext4 -L cortex-hdd2tb $PART"
  exit 0
fi

if [[ "$FSTYPE" == "ext4" || -z "$FSTYPE" ]]; then
  sudo mkdir -p "$MOUNT"
  if [[ -z "$FSTYPE" ]]; then
    read -r -p "No filesystem on $PART. Format ext4? Type YES: " c
    [[ "$c" == "YES" ]] || exit 1
    sudo mkfs.ext4 -F -L cortex-hdd2tb "$PART"
  fi
  if ! grep -q "$MOUNT" /etc/fstab 2>/dev/null; then
    UUID="$(sudo blkid -s UUID -o value "$PART")"
    echo "UUID=$UUID  $MOUNT  ext4  defaults,noatime  0  2" | sudo tee -a /etc/fstab
  fi
  sudo mount -a
  sudo mkdir -p "$MOUNT/media"
  sudo chown -R "$(whoami):$(id -gn)" "$MOUNT"
  df -h "$MOUNT"
  log "Optional: set NAS_DATA_ROOT=$MOUNT/nas-data after moving data"
  exit 0
fi

echo "Unsupported filesystem: $FSTYPE on $PART" >&2
exit 1
