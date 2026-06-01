#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/deploy/homelab"
"$ROOT/scripts/homelab-docker-compose.sh" build cortex-api cortex-web
"$ROOT/scripts/homelab-docker-compose.sh" up -d cortex-api cortex-web
echo ""
curl -sS http://127.0.0.1:8080/api/health/live
echo ""
docker ps --filter name=cortex-homelab-cortex --format 'table {{.Names}}\t{{.Status}}'
