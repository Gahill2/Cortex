#!/usr/bin/env bash
# Recover Nextcloud when MariaDB is stuck (aria/innodb lock errors) or app container never starts.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAS_DIR="$ROOT/deploy/nas"
MANAGE="$ROOT/scripts/docker-manage.sh"
NAS_ROOT="${NAS_DATA_ROOT:-/mnt/cortex/nas-data}"
DB_DIR="$NAS_ROOT/appdata/nextcloud/db"

log() { echo "[nextcloud-fix] $*"; }

[[ -f "$NAS_DIR/.env" ]] || { log "Missing $NAS_DIR/.env"; exit 1; }

if ! docker info >/dev/null 2>&1; then
  bash "$ROOT/scripts/docker-daemon-fix.sh" || exit 1
fi

log "Stopping Nextcloud stack..."
bash "$MANAGE" stop cortex-nas-nextcloud-1 2>/dev/null || true
bash "$MANAGE" stop cortex-nas-nextcloud-db-1 2>/dev/null || true
docker update --restart=no cortex-nas-nextcloud-db-1 2>/dev/null || true
docker rm -f cortex-nas-nextcloud-1 cortex-nas-nextcloud-db-1 2>/dev/null || true
sleep 3

# Orphan mariadbd on the host (PPID 1) keeps flock on ibdata1 after unclean container exit.
orphan_pids=$(lslocks -J 2>/dev/null | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
for lock in data.get('locks', []):
    path = lock.get('path', '') or ''
    if 'nextcloud/db' in path and lock.get('pid'):
        print(lock['pid'])
" 2>/dev/null | sort -u || true)
for pid in $orphan_pids; do
  if ps -p "$pid" -o comm= 2>/dev/null | grep -q mariadbd; then
    log "Killing orphan mariadbd pid $pid (stale DB lock)"
    docker run --rm --pid host --privileged alpine:3.20 kill -9 "$pid" 2>/dev/null || true
  fi
done
sleep 2

log "Clearing stale Aria logs (safe — InnoDB holds real data)..."
docker run --rm -v "$DB_DIR:/db" alpine:3.20 sh -c '
  rm -f /db/aria_log_control /db/aria_log.00000001 2>/dev/null || true
  ls -la /db/aria_log* 2>/dev/null || echo "aria logs cleared"
'

log "Starting MariaDB..."
cd "$NAS_DIR"
docker compose --env-file .env up -d nextcloud-db

log "Waiting for DB healthy (up to 3 min)..."
for i in $(seq 1 36); do
  health=$(docker inspect -f '{{.State.Health.Status}}' cortex-nas-nextcloud-db-1 2>/dev/null || echo missing)
  status=$(docker inspect -f '{{.State.Status}}' cortex-nas-nextcloud-db-1 2>/dev/null || echo missing)
  if [[ "$health" == "healthy" ]]; then
    log "MariaDB healthy"
    break
  fi
  if [[ "$status" == "exited" ]]; then
    log "MariaDB exited — last logs:"
    docker logs cortex-nas-nextcloud-db-1 --tail 20
    exit 1
  fi
  sleep 5
done

health=$(docker inspect -f '{{.State.Health.Status}}' cortex-nas-nextcloud-db-1 2>/dev/null || echo missing)
if [[ "$health" != "healthy" ]]; then
  log "ERROR: DB not healthy (status=$health)"
  docker logs cortex-nas-nextcloud-db-1 --tail 25
  exit 1
fi

docker update --restart=unless-stopped cortex-nas-nextcloud-db-1 2>/dev/null || true

log "Starting Nextcloud app..."
docker compose --env-file .env up -d nextcloud

if [[ -x "$ROOT/scripts/nextcloud-trusted-domains.sh" ]]; then
  bash "$ROOT/scripts/nextcloud-trusted-domains.sh" 2>/dev/null || true
fi

for i in $(seq 1 24); do
  if curl -sf --max-time 4 "http://127.0.0.1:${NEXTCLOUD_PORT:-8081}/status.php" >/dev/null 2>&1; then
    log "Nextcloud OK — http://127.0.0.1:${NEXTCLOUD_PORT:-8081}"
    exit 0
  fi
  sleep 5
done

log "WARN: Nextcloud container up but status.php not ready yet — check: docker logs cortex-nas-nextcloud-1"
docker ps -f name=nextcloud --format 'table {{.Names}}\t{{.Status}}'
