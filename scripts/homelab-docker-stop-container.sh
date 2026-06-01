#!/usr/bin/env bash
# Stop/remove a container. Works around snap Docker AppArmor "unable to signal init" bugs.
set -euo pipefail

name="${1:?container name required}"

if ! docker ps -aq -f "name=^${name}$" 2>/dev/null | grep -q .; then
  exit 0
fi

if timeout 8 docker stop --timeout=3 "$name" >/dev/null 2>&1; then
  docker rm -f "$name" >/dev/null 2>&1 || true
  exit 0
fi

# snap Docker + AppArmor: runc cannot signal init from outside the container.
if docker ps -q -f "name=^${name}$" -f status=running 2>/dev/null | grep -q .; then
  docker exec "$name" sh -c 'kill -TERM 1' >/dev/null 2>&1 || true
  for _ in $(seq 1 15); do
    docker ps -q -f "name=^${name}$" -f status=running 2>/dev/null | grep -q . || break
    sleep 1
  done
fi

docker rm -f "$name" >/dev/null 2>&1 || {
  echo "[homelab-docker] ERROR: could not remove $name" >&2
  echo "  Try: sudo snap restart docker && docker rm -f $name" >&2
  exit 1
}
