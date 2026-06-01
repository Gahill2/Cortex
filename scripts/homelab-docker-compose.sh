#!/usr/bin/env bash
# Run docker compose as the current user (docker group). Never uses sudo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_DIR="$ROOT/deploy/homelab"
ENV_FILE="$COMPOSE_DIR/.env"

if ! groups | grep -qw docker; then
  echo "[homelab-docker] ERROR: $(whoami) is not in the docker group." >&2
  echo "  Fix: sudo usermod -aG docker $(whoami) && newgrp docker" >&2
  exit 1
fi

cd "$COMPOSE_DIR"

# snap Docker + AppArmor: compose stop fails; pre-stop api/web before recreate.
needs_prestop=0
for arg in "$@"; do
  case "$arg" in
    up|restart|recreate|down) needs_prestop=1 ;;
  esac
done
if [[ "$needs_prestop" -eq 1 ]]; then
  for svc in cortex-api cortex-web; do
    cid="$(docker ps -q -f "label=com.docker.compose.service=${svc}" -f "label=com.docker.compose.project=cortex-homelab" 2>/dev/null | head -1 || true)"
    if [[ -n "${cid:-}" ]]; then
      cname="$(docker inspect --format '{{.Name}}' "$cid" 2>/dev/null | sed 's|^/||' || true)"
      if [[ -n "${cname:-}" ]]; then
        "$ROOT/scripts/homelab-docker-stop-container.sh" "$cname" >/dev/null 2>&1 || true
      fi
    fi
  done
fi

compose_args=(compose)
if [[ -f "$ENV_FILE" ]]; then
  compose_args+=(--env-file .env)
fi
compose_args+=("$@")

ERR_FILE="$(mktemp /tmp/cortex-compose-err.XXXXXX)"
if docker "${compose_args[@]}" 2>"$ERR_FILE"; then
  rm -f "$ERR_FILE"
  exit 0
fi

if grep -qiE 'permission denied|cannot stop container|access denied|already in use|error while stopping|conflict' "$ERR_FILE" 2>/dev/null; then
  cat "$ERR_FILE" >&2
  rm -f "$ERR_FILE"
  echo "" >&2
  echo "[homelab-docker] snap Docker AppArmor blocked container stop." >&2
  echo "  Fix: npm run server:docker:fix-once" >&2
  exit 1
fi

cat "$ERR_FILE" >&2
rm -f "$ERR_FILE"
exit 1
