#!/usr/bin/env bash
# Move NAS media stack from ~/nas-data to the second disk (archive partition).
# Run AFTER: npm run storage:setup  (mounts /mnt/cortex/archive)
#
#   npm run nas:migrate-to-archive
#   npm run nas:migrate-to-archive -- --dry-run
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARCHIVE="${CORTEX_ARCHIVE_ROOT:-/mnt/cortex/archive}"
NEW_ROOT="${NAS_DATA_ROOT_NEW:-$ARCHIVE/nas-data}"
OLD_ROOT="${NAS_DATA_ROOT_OLD:-/home/greyhill/nas-data}"
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      echo "Usage: $0 [--dry-run]"
      echo "  Requires $ARCHIVE mounted (npm run storage:setup first)."
      exit 0
      ;;
  esac
done

log() { echo "[nas-migrate] $*"; }

if [[ ! -d "$ARCHIVE" ]] || ! mountpoint -q "$ARCHIVE" 2>/dev/null; then
  echo "Archive not mounted at $ARCHIVE" >&2
  echo "Run first:  cd $ROOT && npm run storage:setup" >&2
  mount | grep cortex || true
  exit 1
fi

if [[ ! -d "$OLD_ROOT" ]]; then
  echo "Old NAS path missing: $OLD_ROOT" >&2
  exit 1
fi

upsert_env() {
  local file="$1" key="$2" val="$3"
  [[ -f "$file" ]] || return 0
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    if [[ "$DRY_RUN" -eq 1 ]]; then
      echo "[dry-run] sed $key in $file"
    else
      sed -i "s|^${key}=.*|${key}=${val}|" "$file"
    fi
  else
    if [[ "$DRY_RUN" -eq 1 ]]; then
      echo "[dry-run] append $key to $file"
    else
      echo "${key}=${val}" >>"$file"
    fi
  fi
}

log "Old: $OLD_ROOT"
log "New: $NEW_ROOT"
df -h "$ARCHIVE"

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "Would rsync $OLD_ROOT/ -> $NEW_ROOT/ (this can take a while)"
  log "Would update deploy/nas/.env, media-stack/.env, homelab .env"
  exit 0
fi

read -r -p "Stop NAS/media Docker stacks and copy ~$(du -sh "$OLD_ROOT" 2>/dev/null | cut -f1) to archive? Type YES: " confirm
[[ "$confirm" == "YES" ]] || { echo "Aborted."; exit 1; }

log "Stopping containers (ignore errors if already down)..."
(cd "$ROOT/deploy/nas/media-stack" && docker compose --env-file .env down 2>/dev/null) || true
(cd "$ROOT/deploy/nas" && docker compose --env-file .env down 2>/dev/null) || true
(cd "$ROOT/deploy/nas/pihole" && docker compose --env-file .env down 2>/dev/null) || true

mkdir -p "$NEW_ROOT"
log "Copying data (rsync)..."
rsync -aH --info=progress2 "$OLD_ROOT/" "$NEW_ROOT/"

NAS_DATA_ROOT="$NEW_ROOT" bash "$ROOT/scripts/nas-init-dirs.sh"

upsert_env "$ROOT/deploy/nas/.env" "NAS_DATA_ROOT" "$NEW_ROOT"
upsert_env "$ROOT/deploy/nas/media-stack/.env" "NAS_DATA_ROOT" "$NEW_ROOT"
upsert_env "$ROOT/deploy/nas/pihole/.env" "NAS_DATA_ROOT" "$NEW_ROOT"
upsert_env "$ROOT/deploy/homelab/.env" "NAS_DATA_ROOT" "$NEW_ROOT"

if [[ -f "$ROOT/deploy/nas/.env" ]]; then
  # RESTIC path often under NAS_DATA_ROOT
  if grep -q '^RESTIC_REPOSITORY=' "$ROOT/deploy/nas/.env"; then
    sed -i "s|^RESTIC_REPOSITORY=.*|RESTIC_REPOSITORY=${NEW_ROOT}/backups/restic|" "$ROOT/deploy/nas/.env"
  fi
fi

if [[ ! -L "$OLD_ROOT" ]]; then
  mv "$OLD_ROOT" "${OLD_ROOT}.bak-$(date +%Y%m%d)"
  ln -sfn "$NEW_ROOT" "$OLD_ROOT"
  log "Symlink: $OLD_ROOT -> $NEW_ROOT (backup at ${OLD_ROOT}.bak-*)"
fi

log "Done. Start stacks:"
echo "  cd deploy/nas/pihole && docker compose --env-file .env up -d"
echo "  cd deploy/nas && docker compose --env-file .env up -d"
echo "  cd deploy/nas/media-stack && docker compose --env-file .env up -d"
echo "  df -h $ARCHIVE"
