#!/usr/bin/env bash
# Ensure Nextcloud accepts API requests from Docker + LAN (trusted_domains).
set -euo pipefail

CONTAINER="${NEXTCLOUD_CONTAINER:-cortex-nas-nextcloud-1}"

DOMAINS=(
  localhost
  127.0.0.1
  host.docker.internal
  10.0.0.49
  cloud.cortex
  jellyfin.cortex
)

IP="$(tailscale ip -4 2>/dev/null | head -1 | tr -d '[:space:]' || true)"
MAGIC="$(tailscale status --json 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
print((d.get('Self') or {}).get('DNSName', '').rstrip('.'))
" 2>/dev/null || true)"

[[ -n "$IP" ]] && DOMAINS+=("$IP")
[[ -n "$MAGIC" ]] && DOMAINS+=("$MAGIC")

idx=0
for domain in "${DOMAINS[@]}"; do
  docker exec -u www-data "$CONTAINER" php occ config:system:set "trusted_domains" "$idx" --value="$domain" 2>/dev/null || \
    docker exec -u www-data "$CONTAINER" php occ config:system:set "trusted_domains" "$idx" --value="$domain"
  idx=$((idx + 1))
done

echo "Nextcloud trusted_domains updated in $CONTAINER"
