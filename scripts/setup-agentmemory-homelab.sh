#!/usr/bin/env bash
# Enable agentmemory on the homelab host and wire Docker API → host:3111.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_ENV="$ROOT/deploy/homelab/env/api.env"
UNIT_SRC="$ROOT/deploy/homelab/systemd/user/cortex-agentmemory.service"
UNIT_DEST="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/cortex-agentmemory.service"

set_env_key() {
  local file="$1" key="$2" val="$3"
  [[ -f "$file" ]] || touch "$file"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$file"
  else
    echo "${key}=${val}" >>"$file"
  fi
}

log() { echo "[agentmemory-setup] $*"; }

mkdir -p "$(dirname "$UNIT_DEST")"
cp "$UNIT_SRC" "$UNIT_DEST"

set_env_key "$API_ENV" "AGENTMEMORY_URL" "http://host.docker.internal:3111"
set_env_key "$API_ENV" "AGENTMEMORY_PROJECT" "cortex"
set_env_key "$API_ENV" "AGENTMEMORY_AUTO_REMEMBER" "false"

if [[ -f "$ROOT/backend/.env" ]]; then
  set_env_key "$ROOT/backend/.env" "AGENTMEMORY_URL" "http://127.0.0.1:3111"
  set_env_key "$ROOT/backend/.env" "AGENTMEMORY_PROJECT" "cortex"
fi

bash "$ROOT/scripts/agentmemory-docker-bind.sh" 2>/dev/null || true
systemctl --user daemon-reload
systemctl --user enable --now cortex-agentmemory.service
log "agentmemory: $(systemctl --user is-active cortex-agentmemory.service)"
log "Docker bind: CORTEX_AGENTMEMORY_DOCKER_BIND=1 (host 0.0.0.0:3111 for host.docker.internal)"

bash "$ROOT/scripts/sync-agentmemory-skills.sh" 2>/dev/null || log "Skills sync skipped (clone vendor/agentmemory first)"

log "Recreate API to pick up env: cd deploy/homelab && docker compose --env-file .env up -d --force-recreate cortex-api"
log "Cortex → Settings → Memory should show agentmemory healthy."
