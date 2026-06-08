#!/usr/bin/env bash
# Bring all Cortex homelab + NAS stacks online (run on cortex host).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANAGE="$ROOT/scripts/docker-manage.sh"
NAS_ROOT="${NAS_DATA_ROOT:-/mnt/cortex/nas-data}"

log() { echo "[stack-up] $*"; }

if ! docker info >/dev/null 2>&1; then
  log "Docker not reachable — running docker-daemon-fix.sh"
  bash "$ROOT/scripts/docker-daemon-fix.sh" || exit 1
fi

compose_up() {
  local dir="$1"
  local env_file="${2:-}"
  log "compose up: $dir"
  if [[ -n "$env_file" && -f "$env_file" ]]; then
    (cd "$dir" && docker compose --env-file "$env_file" up -d)
  elif [[ -f "$dir/.env" ]]; then
    (cd "$dir" && docker compose --env-file .env up -d)
  else
    (cd "$dir" && docker compose up -d)
  fi
}

# Homelab API + web + postgres
compose_up "$ROOT/deploy/homelab" "$ROOT/deploy/homelab/.env"

# Pi-hole
if [[ -f "$ROOT/deploy/nas/pihole/.env" ]]; then
  compose_up "$ROOT/deploy/nas/pihole" "$ROOT/deploy/nas/pihole/.env"
fi

# NAS (Jellyfin, Nextcloud, …)
if [[ -f "$ROOT/deploy/nas/.env" ]]; then
  compose_up "$ROOT/deploy/nas" "$ROOT/deploy/nas/.env"
fi

# Immich
if [[ -f "$ROOT/deploy/nas/immich/.env" ]]; then
  compose_up "$ROOT/deploy/nas/immich" "$ROOT/deploy/nas/immich/.env"
fi

# Media stack (Gluetun + *arr + qBit)
if [[ -f "$ROOT/deploy/nas/media-stack/.env" ]]; then
  compose_up "$ROOT/deploy/nas/media-stack" "$ROOT/deploy/nas/media-stack/.env"
fi

# Monitoring (optional — skip if .env missing)
if [[ -f "$ROOT/deploy/monitoring/.env" ]]; then
  compose_up "$ROOT/deploy/monitoring" "$ROOT/deploy/monitoring/.env" || log "WARN: monitoring stack failed (non-fatal)"
fi

log "Restarting hung media containers if needed..."
for c in cortex-qbittorrent cortex-sabnzbd cortex-nas-nextcloud-1 cortex-nas-nextcloud-db-1; do
  if docker ps -aq -f "name=^${c}$" 2>/dev/null | grep -q .; then
    state=$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo missing)
    if [[ "$state" == "exited" || "$state" == "created" ]]; then
      bash "$MANAGE" start "$c" 2>/dev/null || docker start "$c" 2>/dev/null || true
      log "  started $c (was $state)"
    fi
  fi
done

# qBit lockfile after unclean stop
if docker ps -q -f name=cortex-qbittorrent -f status=running 2>/dev/null | grep -q .; then
  docker exec cortex-qbittorrent rm -f /config/qBittorrent/lockfile /config/qBittorrent/ipc-socket 2>/dev/null || true
  bash "$MANAGE" restart cortex-qbittorrent 2>/dev/null || true
fi

if [[ -x "$ROOT/scripts/radarr-sync-queue.sh" ]]; then
  bash "$ROOT/scripts/radarr-sync-queue.sh" 2>/dev/null || true
fi

log ""
log "=== Status ==="
docker ps --format 'table {{.Names}}\t{{.Status}}' | head -35

log ""
log "Probes:"
for spec in "7878:radarr:/ping" "8989:sonarr:/ping" "9696:prowlarr:/ping" "8096:jellyfin:/health" "8089:qbit:/" "8082:sab:/"; do
  port="${spec%%:*}"
  rest="${spec#*:}"
  name="${rest%%:*}"
  path="${rest#*:}"
  if curl -sf --max-time 4 -o /dev/null "http://127.0.0.1:${port}${path}" 2>/dev/null; then
    log "  OK  $name :$port"
  else
    log "  DOWN $name :$port"
  fi
done
