#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/deploy/tailscale-hub"
docker compose --env-file .env down
echo "Tailscale hub stack stopped."
