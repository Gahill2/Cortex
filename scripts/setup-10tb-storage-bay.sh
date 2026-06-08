#!/usr/bin/env bash
# Wire the 5×2TB Hitachi bay: keep sdc media, format/mount sdd/sde/sdf/sdg, mergerfs pool.
#
#   npm run storage:10tb:setup -- --dry-run
#   npm run storage:10tb:setup
#   npm run storage:10tb:setup -- --migrate-downloads --yes
#   npm run storage:10tb:setup -- --mount-only
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAS_ROOT="${NAS_DATA_ROOT:-/mnt/cortex/nas-data}"
PRIMARY_MOUNT="${CORTEX_2TB_MOUNT:-/mnt/cortex/hdd2tb}"
MERGED="${CORTEX_MEDIA_MERGED:-/mnt/cortex/media-merged}"

# Stable by-id paths (Hitachi HDS722020ALA330)
DISK_PRIMARY_ID="ata-Hitachi_HDS722020ALA330_JK1130YAH6D8XT"
DISK_HDD2_ID="ata-Hitachi_HDS722020ALA330_JK1130YAH6W0RT"   # sdf — downloads
DISK_HDD3_ID="ata-Hitachi_HDS722020ALA330_JK1130YAH2M0RT"   # sdd — movies overflow
DISK_HDD4_ID="ata-Hitachi_HDS722020ALA330_JK1130YAH2LPBT"   # sde — tv overflow
DISK_HDD5_ID="ata-Hitachi_HDS722020ALA330_JK1130YAH6VXAT"   # sdg — photos/cloud

declare -A MOUNT_LABEL=(
  [hdd-2]="/mnt/cortex/hdd-2"
  [hdd-3]="/mnt/cortex/hdd-3"
  [hdd-4]="/mnt/cortex/hdd-4"
  [hdd-5]="/mnt/cortex/hdd-5"
)

DRY_RUN=0
ASSUME_YES=0
MOUNT_ONLY=0
MIGRATE_DOWNLOADS=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --yes) ASSUME_YES=1 ;;
    --mount-only) MOUNT_ONLY=1 ;;
    --migrate-downloads) MIGRATE_DOWNLOADS=1 ;;
  esac
done

log() { echo "[10tb-setup] $*"; }
run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] $*"
  else
    sudo "$@"
  fi
}

disk_node() {
  local id="$1"
  local path="/dev/disk/by-id/${id}"
  [[ -e "$path" ]] || { echo "Missing $path" >&2; return 1; }
  readlink -f "$path"
}

partition_path() {
  local disk="$1"
  if [[ -b "${disk}-part1" ]]; then
    readlink -f "${disk}-part1"
    return
  fi
  if [[ -b "${disk}1" ]]; then
    echo "${disk}1"
    return
  fi
  echo "$disk"
}

ensure_primary_mounted() {
  if mountpoint -q "$PRIMARY_MOUNT" 2>/dev/null; then
    log "Primary media mounted: $PRIMARY_MOUNT"
    return 0
  fi
  log "Primary not mounted — run: npm run storage:2tb:mount"
  bash "$ROOT/scripts/mount-2tb-drive.sh" || true
  mountpoint -q "$PRIMARY_MOUNT" || { echo "Mount $PRIMARY_MOUNT first." >&2; exit 1; }
}

format_and_mount_ext4() {
  local label="$1"
  local disk_id="$2"
  local mnt="${MOUNT_LABEL[$label]}"
  local disk part uuid

  disk="$(disk_node "$disk_id")"
  part="$(partition_path "$disk")"

  log "=== $label ($disk_id) -> $mnt ==="
  lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINT "$disk" "${disk}"* 2>/dev/null || true

  # Udisks auto-mount for sdf
  if mount | grep -q " on ${mnt} " 2>/dev/null; then
    log "Already mounted at $mnt"
    return 0
  fi
  while read -r umnt; do
    [[ -z "$umnt" ]] && continue
    log "Unmounting $umnt"
    run umount -l "$umnt" 2>/dev/null || run umount "$umnt" 2>/dev/null || true
  done < <(findmnt -rn -S "$part" -o TARGET 2>/dev/null; findmnt -rn -S "$disk" -o TARGET 2>/dev/null)

  local fstype
  fstype="$(lsblk -no FSTYPE "$part" 2>/dev/null | tr -d ' ')"
  if [[ "$fstype" != "ext4" ]]; then
    if [[ "$MOUNT_ONLY" -eq 1 ]]; then
      log "SKIP format ($part is ${fstype:-empty}) — run without --mount-only to format"
      return 0
    fi
    log "Formatting $disk ext4 label=cortex-${label}"
    run wipefs -a "$disk" 2>/dev/null || true
    run parted -s "$disk" mklabel gpt mkpart primary ext4 1MiB 100%
    run partprobe "$disk" 2>/dev/null || true
    sleep 1
    part="$(partition_path "$disk")"
    if [[ ! -b "$part" || "$part" == "$disk" ]]; then
      part="${disk}1"
    fi
    run mkfs.ext4 -F -L "cortex-${label}" "$part"
  fi

  run mkdir -p "$mnt"
  uuid="$(sudo blkid -s UUID -o value "$part" 2>/dev/null || lsblk -no UUID "$part")"
  if ! grep -q "$mnt" /etc/fstab 2>/dev/null; then
    log "Adding fstab: UUID=$uuid -> $mnt"
    echo "UUID=$uuid  $mnt  ext4  defaults,noatime  0  2" | run tee -a /etc/fstab
  fi
  run mount "$mnt" 2>/dev/null || run mount -a
  run mkdir -p "$mnt/media"/{movies,tv,music,downloads/incomplete,downloads/complete}
  run chown -R "$(whoami):$(id -gn)" "$mnt"
  if mountpoint -q "$mnt" 2>/dev/null; then
    df -h "$mnt"
  fi
}

setup_mergerfs() {
  local branches=()
  local b

  if [[ ! -d "$PRIMARY_MOUNT/media" ]]; then
    echo "Missing $PRIMARY_MOUNT/media" >&2
    exit 1
  fi

  for label in hdd-2 hdd-3 hdd-4; do
    b="${MOUNT_LABEL[$label]}/media"
    if mountpoint -q "${MOUNT_LABEL[$label]}" 2>/dev/null; then
      branches+=("$b")
    fi
  done

  if [[ ${#branches[@]} -eq 0 && "$MOUNT_ONLY" -eq 1 ]]; then
    log "No ext4 pool disks mounted — skipping mergerfs"
    return 0
  fi

  if ! command -v mergerfs >/dev/null 2>&1; then
    log "Installing mergerfs..."
    run apt-get update -qq
    run apt-get install -y mergerfs
  fi

  local src="${PRIMARY_MOUNT}/media"
  for b in "${branches[@]}"; do
    src+=":$b"
  done

  run mkdir -p "$MERGED"
  log "mergerfs pool: $src -> $MERGED"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] mergerfs -o defaults,allow_other,category.create=mfs,moveonenospc=true,fsname=cortex-media $src $MERGED"
    return 0
  fi

  if ! mountpoint -q "$MERGED" 2>/dev/null; then
    run mergerfs -o defaults,allow_other,category.create=mfs,moveonenospc=true,fsname=cortex-media "$src" "$MERGED"
  else
    log "Already mounted: $MERGED"
  fi

  if ! grep -q "$MERGED" /etc/fstab 2>/dev/null; then
    echo "$src  $MERGED  fuse.mergerfs  defaults,allow_other,category.create=mfs,moveonenospc=true,fsname=cortex-media  0  0" | run tee -a /etc/fstab
  fi

  if [[ -L "${NAS_ROOT}/media" ]]; then
    local old
    old="$(readlink -f "${NAS_ROOT}/media")"
    if [[ "$old" != "$MERGED" ]]; then
      log "Updating symlink ${NAS_ROOT}/media -> $MERGED (was $old)"
      ln -sfn "$MERGED" "${NAS_ROOT}/media"
    fi
  elif [[ -d "${NAS_ROOT}/media" ]]; then
    log "Backing up ${NAS_ROOT}/media and symlinking to pool"
    mv "${NAS_ROOT}/media" "${NAS_ROOT}/media.bak-$(date +%Y%m%d%H%M)"
    ln -sfn "$MERGED" "${NAS_ROOT}/media"
  else
    ln -sfn "$MERGED" "${NAS_ROOT}/media"
  fi

  df -h "$MERGED"
  log "Docker media path: $(readlink -f "${NAS_ROOT}/media")"
}

setup_photos_on_hdd5() {
  local mnt="${MOUNT_LABEL[hdd-5]}"
  mountpoint -q "$mnt" 2>/dev/null || return 0
  run mkdir -p "$mnt/photos" "$mnt/cloud" "$mnt/archive"
  if [[ ! -e "${NAS_ROOT}/photos" || -L "${NAS_ROOT}/photos" ]]; then
    if [[ -d "${NAS_ROOT}/photos" && ! -L "${NAS_ROOT}/photos" ]]; then
      log "photos/ has data on SSD — leaving in place (migrate manually if needed)"
      return 0
    fi
    ln -sfn "$mnt/photos" "${NAS_ROOT}/photos"
    log "Symlink ${NAS_ROOT}/photos -> $mnt/photos"
  fi
}

migrate_downloads_to_hdd2() {
  local hdd2="${MOUNT_LABEL[hdd-2]}/media/downloads"
  local src="${PRIMARY_MOUNT}/media/downloads"
  mountpoint -q "${MOUNT_LABEL[hdd-2]}" 2>/dev/null || { log "hdd-2 not mounted"; return 1; }
  [[ -d "$src" ]] || return 0

  local used
  used="$(du -sBG "$src" 2>/dev/null | awk '{print $1}' | tr -d G || echo 0)"
  log "Migrate ~${used}G downloads from NTFS ($src) to ext4 ($hdd2)"

  if [[ "$ASSUME_YES" -ne 1 ]]; then
    read -r -p "Stop media stack and rsync downloads to hdd-2? Type YES: " confirm
    [[ "$confirm" == "YES" ]] || { echo "Skipped."; return 0; }
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "Dry run — would rsync $src -> $hdd2"
    return 0
  fi

  (cd "$ROOT/deploy/nas/media-stack" && docker compose --env-file .env stop 2>/dev/null) || true
  mkdir -p "$hdd2"/{incomplete,complete}
  rsync -aH --info=progress2 "$src/" "$hdd2/"
  mv "$src" "${src}.bak-ntfs-$(date +%Y%m%d)"
  mkdir -p "$src"/{incomplete,complete}
  log "Downloads primary copy now on ext4; mergerfs still exposes $src via pool"
  (cd "$ROOT/deploy/nas/media-stack" && docker compose --env-file .env up -d 2>/dev/null) || true
}

# ── Main ─────────────────────────────────────────────────────────────────────

log "Cortex 10TB bay setup"
log "Primary (keep): $PRIMARY_MOUNT"
lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINT,MODEL /dev/sd{c,d,e,f,g} 2>/dev/null || lsblk

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "DRY RUN — no changes"
fi

if [[ "$ASSUME_YES" -ne 1 && "$DRY_RUN" -ne 1 && "$MOUNT_ONLY" -ne 1 ]]; then
  echo ""
  echo "This will FORMAT (ext4) and mount:"
  echo "  sdf -> /mnt/cortex/hdd-2  (downloads)"
  echo "  sdd -> /mnt/cortex/hdd-3  (movies overflow)"
  echo "  sde -> /mnt/cortex/hdd-4  (tv overflow)"
  echo "  sdg -> /mnt/cortex/hdd-5  (photos/cloud)"
  echo "sdc ($PRIMARY_MOUNT) is LEFT UNTOUCHED (~1TB movies/tv/downloads)."
  echo ""
  read -r -p "Type YES to continue: " confirm
  [[ "$confirm" == "YES" ]] || { echo "Aborted."; exit 1; }
fi

ensure_primary_mounted

if [[ "$MOUNT_ONLY" -ne 1 ]]; then
  format_and_mount_ext4 "hdd-2" "$DISK_HDD2_ID"
  format_and_mount_ext4 "hdd-3" "$DISK_HDD3_ID"
  format_and_mount_ext4 "hdd-4" "$DISK_HDD4_ID"
  format_and_mount_ext4 "hdd-5" "$DISK_HDD5_ID"
else
  for label in hdd-2 hdd-3 hdd-4 hdd-5; do
    mnt="${MOUNT_LABEL[$label]}"
    run mkdir -p "$mnt"
    run mount "$mnt" 2>/dev/null || true
  done
fi

setup_mergerfs
setup_photos_on_hdd5

if [[ "$MIGRATE_DOWNLOADS" -eq 1 ]]; then
  migrate_downloads_to_hdd2
fi

log "Done."
echo ""
df -h "$PRIMARY_MOUNT" "${MOUNT_LABEL[hdd-2]}" "${MOUNT_LABEL[hdd-3]}" "${MOUNT_LABEL[hdd-4]}" "${MOUNT_LABEL[hdd-5]}" "$MERGED" 2>/dev/null || true
du -sh "$MERGED"/* 2>/dev/null || du -sh "$PRIMARY_MOUNT/media"/* 2>/dev/null || true
log "Restart Jellyfin if libraries look empty: docker restart cortex-nas-jellyfin-1"
