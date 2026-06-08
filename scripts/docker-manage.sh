#!/usr/bin/env bash
# Manage any Docker container without sudo — works around snap Docker AppArmor
# "permission denied" on docker stop/restart/rm (kill PID 1 inside the container).
set -euo pipefail

ACTION="${1:?usage: docker-manage.sh start|stop|restart|rm <container>}"
NAME="${2:?container name required}"

log() { echo "[docker-manage] $*"; }

container_exists() {
  docker ps -aq -f "name=^${NAME}$" 2>/dev/null | grep -q .
}

container_running() {
  docker ps -q -f "name=^${NAME}$" -f status=running 2>/dev/null | grep -q .
}

# snap Docker cannot signal init from outside; kill PID 1 inside the container.
kill_init_inside() {
  if ! container_running; then
    return 0
  fi
  log "In-container kill (snap AppArmor workaround) for $NAME"
  docker exec "$NAME" sh -c 'kill -TERM 1' >/dev/null 2>&1 || true
  for _ in $(seq 1 8); do
    container_running || return 0
    sleep 1
  done
  docker exec "$NAME" sh -c 'kill -KILL 1' >/dev/null 2>&1 || true
  for _ in $(seq 1 15); do
    container_running || return 0
    sleep 1
  done
}

docker_sudo() {
  if sudo -n true 2>/dev/null; then
    sudo "$@"
    return $?
  fi
  return 1
}

stop_container() {
  if ! container_exists; then
    return 0
  fi
  if timeout 10 docker stop --timeout=5 "$NAME" >/dev/null 2>&1; then
    return 0
  fi
  kill_init_inside
  if container_running; then
    log "WARN: $NAME still running after in-container kill"
    if docker_sudo docker stop --timeout=5 "$NAME" >/dev/null 2>&1; then
      return 0
    fi
    return 1
  fi
  return 0
}

remove_container() {
  if ! container_exists; then
    return 0
  fi
  stop_container || true
  if docker rm -f "$NAME" >/dev/null 2>&1; then
    return 0
  fi
  if docker_sudo docker rm -f "$NAME" >/dev/null 2>&1; then
    log "Removed $NAME via passwordless sudo"
    return 0
  fi
  log "ERROR: could not remove $NAME"
  log "  Run once: npm run server:docker:setup-perms"
  return 1
}

case "$ACTION" in
  start)
    if container_running; then
      log "$NAME already running"
      exit 0
    fi
    docker start "$NAME"
    log "Started $NAME"
    ;;
  stop)
    stop_container
    log "Stopped $NAME"
    ;;
  restart)
    stop_container
    docker start "$NAME"
    log "Restarted $NAME"
    ;;
  rm)
    remove_container
    log "Removed $NAME"
    ;;
  *)
    echo "Usage: $0 start|stop|restart|rm <container>" >&2
    exit 1
    ;;
esac
