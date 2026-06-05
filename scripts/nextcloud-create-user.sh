#!/usr/bin/env bash
# Create a non-admin Nextcloud user (upload/download in their own folder).
#
#   npm run nas:nextcloud:user -- --user family --password 'secret' --display-name "Family"
set -euo pipefail

CONTAINER="${NEXTCLOUD_CONTAINER:-cortex-nas-nextcloud-1}"
USER=""
PASS=""
DISPLAY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user=*) USER="${1#*=}"; shift ;;
    --user) USER="${2:?}"; shift 2 ;;
    --password=*) PASS="${1#*=}"; shift ;;
    --password) PASS="${2:?}"; shift 2 ;;
    --display-name=*) DISPLAY="${1#*=}"; shift ;;
    --display-name) DISPLAY="${2:?}"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 --user NAME --password PASS [--display-name \"Full Name\"]"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

[[ -n "$USER" && -n "$PASS" ]] || {
  echo "Required: --user and --password" >&2
  exit 1
}

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "Container $CONTAINER not running. Start: cd deploy/nas && docker compose --env-file .env up -d nextcloud" >&2
  exit 1
fi

if docker exec -u www-data "$CONTAINER" php occ user:list 2>/dev/null | grep -q " ${USER}:"; then
  echo "User $USER already exists." >&2
  exit 1
fi

docker exec -u www-data -e "OC_PASS=${PASS}" "$CONTAINER" php occ user:add "$USER" --password-from-env
if [[ -n "$DISPLAY" ]]; then
  docker exec -u www-data "$CONTAINER" php occ user:setting "$USER" settings displayname "$DISPLAY"
fi

echo "Created user: $USER (not an administrator)"
echo "Login: http://cloud.cortex:8081  (or http://100.104.120.29:8081)"
