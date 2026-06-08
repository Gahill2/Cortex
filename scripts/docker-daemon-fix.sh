#!/usr/bin/env bash
# Fix missing /run/docker.sock after snap→apt migration. Uses passwordless sudo if configured.
set -euo pipefail

log() { echo "[docker-daemon] $*"; }

if docker info >/dev/null 2>&1; then
  log "Docker OK"
  docker ps --format '{{.Names}}' | head -5
  exit 0
fi

log "Docker socket missing — restarting docker.socket + docker.service"
if sudo -n systemctl restart docker.socket docker 2>/dev/null; then
  sleep 3
elif sudo systemctl restart docker.socket docker; then
  sleep 3
else
  log "ERROR: could not restart Docker (sudo failed)"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  log "Still failing — try: newgrp docker   OR   log out and back in"
  log "Socket: $(ls -la /run/docker.sock 2>&1 || echo missing)"
  exit 1
fi

log "Docker recovered"
docker ps --format 'table {{.Names}}\t{{.Status}}' | head -15
