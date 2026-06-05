#!/usr/bin/env bash
# Start agentmemory with nvm node (used by cortex-agentmemory.service).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export AGENTMEMORY_PROJECT="${AGENTMEMORY_PROJECT:-cortex}"
export PORT="${PORT:-3111}"
if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  source "${HOME}/.nvm/nvm.sh"
fi
# Docker API reaches host via host.docker.internal — needs 0.0.0.0 bind (see agentmemory-docker-bind.sh).
if [[ "${CORTEX_AGENTMEMORY_DOCKER_BIND:-1}" == "1" ]]; then
  bash "$ROOT/scripts/agentmemory-docker-bind.sh" || true
fi
exec npx -y @agentmemory/agentmemory
