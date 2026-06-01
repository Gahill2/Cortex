#!/usr/bin/env bash
# Fingerprint backend/frontend/deploy files — detects uncommitted local edits.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
(
  cd "$ROOT"
  git ls-files -z backend/src backend/Dockerfile frontend/src deploy/homelab/Dockerfile.web deploy/homelab/docker-compose.yml deploy/homelab/nginx 2>/dev/null \
    | xargs -0 sha256sum 2>/dev/null
  # Include modified-but-untracked under src (local WIP)
  find backend/src frontend/src -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) -print0 2>/dev/null \
    | xargs -0 sha256sum 2>/dev/null
) | sort | sha256sum | awk '{print $1}'
