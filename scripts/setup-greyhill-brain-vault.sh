#!/usr/bin/env bash
# Clone or refresh greyhill_brain Obsidian vault and wire Cortex homelab paths.
#
#   npm run vault:clone
#   GREYHILL_BRAIN_GIT_URL=https://github.com/YOU/greyhill_brain.git npm run vault:clone
#   npm run vault:clone -- --from /path/to/existing/vault
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VAULT_ROOT="${OBSIDIAN_VAULT_ROOT:-/mnt/cortex/obsidian}"
VAULT_PATH="${OBSIDIAN_VAULT_PATH:-$VAULT_ROOT/greyhill_brain}"
GIT_URL="${GREYHILL_BRAIN_GIT_URL:-git@github.com:Gahill2/greyhill_brain.git}"
FROM_PATH=""
SKIP_CLONE=0

log() { echo "[greyhill-brain] $*"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from) FROM_PATH="${2:?}"; shift 2 ;;
    --from=*) FROM_PATH="${1#*=}"; shift ;;
    --url) GIT_URL="${2:?}"; shift 2 ;;
    --url=*) GIT_URL="${1#*=}"; shift ;;
    --skip-clone) SKIP_CLONE=1; shift ;;
    -h|--help)
      echo "Usage: $0 [--url REPO] [--from /path/to/vault] [--skip-clone]"
      echo "Env: GREYHILL_BRAIN_GIT_URL (e.g. git@github.com:greyh/greyhill_brain.git)"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

mkdir -p "$VAULT_ROOT" 2>/dev/null || true
if [[ ! -w "$VAULT_ROOT" ]]; then
  FALLBACK="${HOME}/Documents/greyhill_brain"
  log "WARN: $VAULT_ROOT not writable — using $FALLBACK (set OBSIDIAN_VAULT_HOST_PATH in deploy/homelab/.env)"
  VAULT_PATH="$FALLBACK"
  VAULT_ROOT="$(dirname "$VAULT_PATH")"
fi
mkdir -p "$VAULT_PATH"

if [[ -n "$FROM_PATH" ]]; then
  if [[ ! -d "$FROM_PATH" ]]; then
    echo "Source not found: $FROM_PATH" >&2
    exit 1
  fi
  log "Copying vault from $FROM_PATH → $VAULT_PATH"
  rsync -a --delete-excluded --exclude '.git/' "$FROM_PATH"/ "$VAULT_PATH"/
  SKIP_CLONE=1
fi

if [[ "$SKIP_CLONE" -eq 0 ]]; then
  if [[ -d "$VAULT_PATH/.git" ]]; then
    log "Pulling latest in $VAULT_PATH"
    git -C "$VAULT_PATH" pull --ff-only
  elif [[ -n "$GIT_URL" ]]; then
    if [[ -d "$VAULT_PATH" ]] && [[ -n "$(ls -A "$VAULT_PATH" 2>/dev/null)" ]]; then
      echo "Vault dir not empty and not a git repo: $VAULT_PATH" >&2
      echo "Use --from to import, or move aside, or clone into empty dir." >&2
      exit 1
    fi
    rm -rf "$VAULT_PATH"
    mkdir -p "$(dirname "$VAULT_PATH")"
    log "Cloning $GIT_URL → $VAULT_PATH"
    git clone "$GIT_URL" "$VAULT_PATH"
  else
    log "No GREYHILL_BRAIN_GIT_URL — scaffolding empty vault (npm run storage:vault)"
    OBSIDIAN_VAULT_PATH="$VAULT_PATH" bash "$ROOT/scripts/setup-obsidian-vault-local.sh"
    echo ""
    echo "To use your GitHub vault, set the repo URL and re-run:"
    echo "  npm run vault:clone   # default: git@github.com:Gahill2/greyhill_brain.git"
    echo "Or copy from another PC:"
    echo "  npm run vault:clone -- --from /path/to/greyhill_brain"
    exit 0
  fi
fi

OBSIDIAN_VAULT_PATH="$VAULT_PATH" bash "$ROOT/scripts/setup-obsidian-vault-local.sh"
OBSIDIAN_VAULT_PATH="$VAULT_PATH" bash "$ROOT/scripts/sync-homelab-local-data.sh"

log "Vault at: $VAULT_PATH ($(find "$VAULT_PATH" -name '*.md' 2>/dev/null | wc -l) markdown files)"
log "Open in Obsidian: File → Open vault → $VAULT_PATH"
log "Redeploy API: cd deploy/homelab && docker compose --env-file .env up -d --force-recreate cortex-api"
