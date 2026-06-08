#!/usr/bin/env bash
# List / restart homelab Docker containers (called by homelab-deploy-listener).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANAGE="$ROOT/scripts/docker-manage.sh"

ACTION="${1:-}"
TARGET="${2:-}"

allowed_name() {
  local n="$1"
  [[ "$n" == cortex-homelab-* ]] && return 0
  [[ "$n" == cortex-nas-* ]] && return 0
  [[ "$n" == *cortex-pihole* ]] && return 0
  [[ "$n" == immich_* ]] && return 0
  [[ "$n" == cortex-monitoring-* ]] && return 0
  [[ "$n" == cortex-sabnzbd ]] && return 0
  [[ "$n" == cortex-gluetun ]] && return 0
  [[ "$n" == cortex-radarr ]] && return 0
  [[ "$n" == cortex-sonarr ]] && return 0
  [[ "$n" == cortex-prowlarr ]] && return 0
  [[ "$n" == cortex-qbittorrent ]] && return 0
  return 1
}

json_list() {
  python3 <<'PY'
import json, subprocess
raw = subprocess.check_output(
    ["docker", "ps", "-a", "--format", "{{.Names}}\t{{.Status}}\t{{.State}}"],
    text=True,
)
rows = []
for line in raw.splitlines():
    parts = line.split("\t", 2)
    if len(parts) < 3:
        continue
    name, status, state = parts[0], parts[1], parts[2]
    prefixes = (
        "cortex-homelab-", "cortex-nas-", "cortex-pihole", "immich_",
        "cortex-monitoring-", "cortex-sabnzbd", "cortex-gluetun",
        "cortex-radarr", "cortex-sonarr", "cortex-prowlarr", "cortex-qbittorrent",
    )
    if not any(name.startswith(p) or "cortex-pihole" in name for p in prefixes):
        continue
    health = "unknown"
    if "(healthy)" in status:
        health = "ok"
    elif state == "running":
        health = "warn"
    elif state == "exited" or state == "dead":
        health = "down"
    rows.append({
        "id": name,
        "name": name,
        "status": status,
        "state": state,
        "health": health,
        "canRestart": state != "created",
    })
print(json.dumps(rows))
PY
}

case "$ACTION" in
  list)
    json_list
    ;;
  restart)
    if [[ -z "$TARGET" ]]; then
      echo '{"ok":false,"error":"container name required"}' >&2
      exit 1
    fi
    if ! allowed_name "$TARGET"; then
      echo "{\"ok\":false,\"error\":\"container not allowed: $TARGET\"}" >&2
      exit 1
    fi
    if ! docker ps -a --format '{{.Names}}' | grep -qxF "$TARGET"; then
      echo "{\"ok\":false,\"error\":\"not found: $TARGET\"}" >&2
      exit 1
    fi
    out=$(bash "$MANAGE" restart "$TARGET" 2>&1) || {
      echo "{\"ok\":false,\"error\":$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$out")}"
      exit 1
    }
    python3 -c "import json; print(json.dumps({'ok':True,'id':'$TARGET','output':''}))"
    ;;
  start)
    if [[ -z "$TARGET" ]]; then
      echo '{"ok":false,"error":"container name required"}' >&2
      exit 1
    fi
    if ! allowed_name "$TARGET"; then
      echo "{\"ok\":false,\"error\":\"container not allowed: $TARGET\"}" >&2
      exit 1
    fi
    if ! docker ps -a --format '{{.Names}}' | grep -qxF "$TARGET"; then
      echo "{\"ok\":false,\"error\":\"not found: $TARGET\"}" >&2
      exit 1
    fi
    out=$(docker start "$TARGET" 2>&1) || {
      echo "{\"ok\":false,\"error\":$(python3 -c "import json; print(json.dumps('$out'))")}"
      exit 1
    }
    python3 -c "import json; print(json.dumps({'ok':True,'id':'$TARGET','action':'start'}))"
    ;;
  stop)
    if [[ -z "$TARGET" ]]; then
      echo '{"ok":false,"error":"container name required"}' >&2
      exit 1
    fi
    if ! allowed_name "$TARGET"; then
      echo "{\"ok\":false,\"error\":\"container not allowed: $TARGET\"}" >&2
      exit 1
    fi
    if ! docker ps -a --format '{{.Names}}' | grep -qxF "$TARGET"; then
      echo "{\"ok\":false,\"error\":\"not found: $TARGET\"}" >&2
      exit 1
    fi
    out=$(bash "$MANAGE" stop "$TARGET" 2>&1) || {
      echo "{\"ok\":false,\"error\":$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$out")}"
      exit 1
    }
    python3 -c "import json; print(json.dumps({'ok':True,'id':'$TARGET','action':'stop'}))"
    ;;
  *)
    echo "Usage: $0 list | start <container> | stop <container> | restart <container>" >&2
    exit 1
    ;;
esac
