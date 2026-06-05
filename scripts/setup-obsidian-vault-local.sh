#!/usr/bin/env bash
# Initialize Grey Hill Brain Obsidian vault on local storage and wire homelab Docker.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VAULT_ROOT="${OBSIDIAN_VAULT_ROOT:-/mnt/cortex/obsidian}"
VAULT_PATH="${OBSIDIAN_VAULT_PATH:-$VAULT_ROOT/greyhill_brain}"
VAULT_NAME="${OBSIDIAN_VAULT_NAME:-greyhill_brain}"
HOMELAB_ENV="$ROOT/deploy/homelab/.env"
API_ENV="$ROOT/deploy/homelab/env/api.env"

log() { echo "[obsidian-vault] $*"; }

# Prefer explicit OBSIDIAN_VAULT_PATH; fall back if /mnt/cortex/obsidian is root-only
if [[ -z "${OBSIDIAN_VAULT_PATH:-}" ]]; then
  if [[ ! -d "$VAULT_ROOT" ]]; then
    echo "Storage not mounted at $VAULT_ROOT" >&2
    echo "Run first: npm run storage:setup   (partitions /dev/sdb and mounts /mnt/cortex/*)" >&2
    exit 1
  fi
  if [[ ! -w "$VAULT_ROOT" ]]; then
    VAULT_PATH="${HOME}/Documents/greyhill_brain"
    VAULT_ROOT="$(dirname "$VAULT_PATH")"
    log "WARN: /mnt/cortex/obsidian not writable — using $VAULT_PATH"
  fi
fi

if [[ ! -w "$(dirname "$VAULT_PATH")" ]] && [[ ! -w "$VAULT_PATH" ]]; then
  echo "Cannot write vault at $VAULT_PATH (permission denied)." >&2
  echo "Run: npm run vault:fix-perms" >&2
  exit 1
fi

mkdir -p "$VAULT_PATH"/{Daily\ Notes,Templates,Inbox,Projects,Attachments} 2>/dev/null || {
  if [[ -d "$VAULT_PATH/.git" ]]; then
    log "Skipping scaffold dirs (git vault — folders may already exist)"
  else
    echo "mkdir failed for $VAULT_PATH" >&2
    echo "Run: npm run vault:fix-perms" >&2
    exit 1
  fi
}

if [[ ! -f "$VAULT_PATH/README.md" ]]; then
  cat >"$VAULT_PATH/README.md" <<'EOF'
# Grey Hill Brain

Local Obsidian vault for Cortex Notes (AI search, graph, capture).

- **Daily Notes/** — quick capture and daily logs
- **Inbox/** — unsorted notes
- **Projects/** — project folders
- **Templates/** — note templates

Open this folder in Obsidian desktop, or use Cortex → Notes in the browser.
EOF
fi

if [[ ! -f "$VAULT_PATH/Inbox/Cortex Inbox.md" ]]; then
  cat >"$VAULT_PATH/Inbox/Cortex Inbox.md" <<EOF
# Cortex Inbox

Quick captures from Cortex land here when target is inbox.

---
created: $(date -Iseconds)
EOF
fi

TODAY="$(date +%Y-%m-%d)"
DAILY="$VAULT_PATH/Daily Notes/$TODAY.md"
if [[ ! -f "$DAILY" ]]; then
  cat >"$DAILY" <<EOF
# $TODAY

## Log

EOF
fi

set_env_key() {
  local file="$1" key="$2" val="$3"
  if [[ ! -f "$file" ]]; then
    echo "$key=$val" >>"$file"
    return
  fi
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$file"
  else
    echo "${key}=${val}" >>"$file"
  fi
}

if [[ -f "$HOMELAB_ENV" ]]; then
  set_env_key "$HOMELAB_ENV" "OBSIDIAN_VAULT_HOST_PATH" "$VAULT_PATH"
  log "Updated $HOMELAB_ENV → OBSIDIAN_VAULT_HOST_PATH=$VAULT_PATH"
fi

if [[ -f "$API_ENV" ]]; then
  set_env_key "$API_ENV" "OBSIDIAN_VAULT_PATH" "/vault"
  set_env_key "$API_ENV" "OBSIDIAN_VAULT_NAME" "$VAULT_NAME"
  set_env_key "$API_ENV" "OBSIDIAN_AI_LOG_ENABLED" "true"
  set_env_key "$API_ENV" "OBSIDIAN_USE_CLI" "false"
  log "Updated api.env (container path /vault)"
fi

if [[ -f "$ROOT/backend/.env" ]] || [[ -f "$ROOT/backend/.env.example" ]]; then
  local_backend="$ROOT/backend/.env"
  [[ -f "$local_backend" ]] || local_backend="$ROOT/backend/.env.example"
  if [[ -f "$local_backend" ]]; then
    set_env_key "$local_backend" "OBSIDIAN_VAULT_PATH" "$VAULT_PATH"
    log "Updated backend env for npm run dev: $VAULT_PATH"
  fi
fi

bash "$ROOT/scripts/sync-homelab-local-data.sh" 2>/dev/null || true

log "Vault ready at: $VAULT_PATH"
log "Redeploy API so Docker picks up the mount: Homelab → Redeploy, or npm run server:deploy"
log "In Cortex → Notes, path should show this folder (or set vault once in UI)."
