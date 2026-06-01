#!/usr/bin/env bash
# Remove stuck Cortex api/web containers so deploys work without sudo.
# Handles snap Docker AppArmor bugs (permission denied on docker stop/rm).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STOP="$ROOT/scripts/homelab-docker-stop-container.sh"
TARGETS=(cortex-homelab-cortex-api-1 cortex-homelab-cortex-web-1)

echo "=== Cortex homelab Docker cleanup ==="

removed=0
for name in "${TARGETS[@]}"; do
  if ! docker ps -aq -f "name=^${name}$" 2>/dev/null | grep -q .; then
    continue
  fi
  echo "Removing $name..."
  if bash "$STOP" "$name"; then
    echo "✓ Removed $name"
    removed=1
  fi
done

while read -r id name; do
  [[ -z "${id:-}" ]] && continue
  [[ "$name" == cortex-homelab-cortex-api-1 || "$name" == cortex-homelab-cortex-web-1 ]] && continue
  echo "Removing orphan $name..."
  if bash "$STOP" "$name"; then
    echo "✓ Removed orphan $name"
    removed=1
  fi
done < <(docker ps -aq --filter name=cortex-homelab-cortex --format '{{.ID}} {{.Names}}' 2>/dev/null || true)

if [[ "$removed" -eq 0 ]]; then
  echo "No cortex-api/web containers to remove."
else
  echo ""
  echo "Starting fresh stack..."
  "$ROOT/scripts/homelab-deploy.sh"
fi

echo ""
echo "Done. Future deploys: npm run server:deploy"
