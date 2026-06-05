#!/usr/bin/env bash
# Linux: sync Obsidian sidecar + vault index into homelab data before deploy.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
HOMELAB="$ROOT/deploy/homelab"
DATA_API="$HOMELAB/data/api"
ENV_FILE="$HOMELAB/.env"
API_ENV="$HOMELAB/env/api.env"
VAULT_DEFAULT="/mnt/cortex/obsidian/greyhill_brain"

set_env_key() {
  local file="$1" key="$2" val="$3"
  [[ -f "$file" ]] || return 0
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$file"
  else
    echo "${key}=${val}" >>"$file"
  fi
}

if [[ ! -w "$DATA_API" ]] 2>/dev/null; then
  echo "[sync-local] WARN: $DATA_API not writable (Docker may have created it as root)." >&2
  echo "[sync-local] Fix: npm run vault:fix-perms" >&2
else
  mkdir -p "$DATA_API/canvas-assets" "$DATA_API/.cortex"
fi

vault_host="$VAULT_DEFAULT"
if [[ -f "$ENV_FILE" ]] && grep -q '^OBSIDIAN_VAULT_HOST_PATH=' "$ENV_FILE"; then
  vault_host="$(grep '^OBSIDIAN_VAULT_HOST_PATH=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')"
fi
if [[ -f "$BACKEND/.env" ]] && grep -q '^OBSIDIAN_VAULT_PATH=' "$BACKEND/.env"; then
  v="$(grep '^OBSIDIAN_VAULT_PATH=' "$BACKEND/.env" | cut -d= -f2- | tr -d '"')"
  [[ -d "$v" ]] && vault_host="$v"
fi

if [[ -d "$vault_host" ]]; then
  set_env_key "$ENV_FILE" "OBSIDIAN_VAULT_HOST_PATH" "$vault_host"
  echo "[sync-local] OBSIDIAN_VAULT_HOST_PATH=$vault_host"
else
  echo "[sync-local] WARN: vault not found at $vault_host — run npm run storage:vault" >&2
fi

if [[ -f "$API_ENV" ]]; then
  set_env_key "$API_ENV" "OBSIDIAN_VAULT_PATH" "/vault"
  set_env_key "$API_ENV" "OBSIDIAN_VAULT_NAME" "greyhill_brain"
  set_env_key "$API_ENV" "OBSIDIAN_AI_LOG_ENABLED" "true"
  set_env_key "$API_ENV" "OBSIDIAN_USE_CLI" "false"
fi

if [[ -f "$BACKEND/obsidian-vaults.json" ]]; then
  cp "$BACKEND/obsidian-vaults.json" "$DATA_API/obsidian-vaults.json"
  echo "[sync-local] Copied obsidian-vaults.json"
fi

if [[ -d "$BACKEND/.cortex" ]]; then
  cp -a "$BACKEND/.cortex/." "$DATA_API/.cortex/"
  echo "[sync-local] Copied .cortex/ index cache"
fi

if [[ -d "$BACKEND/data/canvas-assets" ]]; then
  cp -a "$BACKEND/data/canvas-assets/." "$DATA_API/canvas-assets/" 2>/dev/null || true
fi

echo "[sync-local] Done."
