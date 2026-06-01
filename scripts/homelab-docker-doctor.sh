#!/usr/bin/env bash
# Check Docker permissions for homelab deploy (no sudo).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OK=1

echo "=== Cortex homelab Docker doctor ==="

if groups | grep -qw docker; then
  echo "✓ User $(whoami) is in the docker group"
else
  echo "✗ Not in docker group — run: sudo usermod -aG docker $(whoami), then log out/in"
  OK=0
fi

for name in cortex-homelab-cortex-api-1 cortex-homelab-cortex-web-1; do
  if ! docker ps -aq -f "name=^${name}$" 2>/dev/null | grep -q .; then
    continue
  fi
  if timeout 5 docker stop --timeout=0 "$name" >/dev/null 2>&1; then
    docker start "$name" >/dev/null 2>&1 || true
    echo "✓ Can manage container $name"
  elif docker ps -q -f "name=^${name}$" -f status=running 2>/dev/null | grep -q . \
      && docker exec "$name" sh -c 'kill -TERM 1' >/dev/null 2>&1; then
    sleep 2
    docker start "$name" >/dev/null 2>&1 || true
    echo "⚠ snap Docker blocks docker stop on $name (AppArmor) — deploy uses in-container kill workaround"
    echo "  Long-term: use only apt docker.io OR snap docker, not both"
  else
    docker start "$name" >/dev/null 2>&1 || true
    echo "✗ Cannot stop $name"
    OK=0
  fi
done

# Orphan compose recreate containers
docker ps -aq --filter name=cortex-homelab-cortex --format '{{.ID}} {{.Names}}' 2>/dev/null \
  | while read -r id name; do
  [[ -z "${id:-}" ]] && continue
  if [[ "$name" == cortex-homelab-cortex-api-1 || "$name" == cortex-homelab-cortex-web-1 ]]; then
    continue
  fi
  if docker rm -f "$id" 2>/dev/null; then
    echo "✓ Removed orphan container ${name:-$id}"
  fi
done

DATA_OWNER="$(stat -c '%U' "$ROOT/deploy/homelab/data" 2>/dev/null || echo unknown)"
if [[ "$DATA_OWNER" == "root" ]]; then
  echo "ℹ deploy/homelab/data/ is owned by root (normal for Postgres volume) — deploy state uses ~/.local/state/cortex/ instead"
fi

if [[ "$OK" -eq 1 ]]; then
  echo ""
  echo "All checks passed. Deploy with: npm run server:deploy"
  exit 0
fi

echo ""
echo "Fix stuck containers: npm run server:docker:fix-once"
exit 1
