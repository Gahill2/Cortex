#!/usr/bin/env bash
# User-writable deploy state (not deploy/homelab/data — that dir is often root-owned from Docker volumes).
set -euo pipefail
DIR="${CORTEX_DEPLOY_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/cortex/homelab-deploy}"
mkdir -p "$DIR"
echo "$DIR"
