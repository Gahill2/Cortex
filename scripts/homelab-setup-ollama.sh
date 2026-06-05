#!/usr/bin/env bash
# Install Ollama on the homelab host, pull a default model, wire api.env for Docker API.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_DIR="$ROOT/deploy/homelab"
API_ENV="${API_ENV:-$ROOT/deploy/homelab/env/api.env}"
MODEL="${OLLAMA_MODEL:-llama3.2}"
USE_DOCKER_OLLAMA=0
BASE_URL="${OLLAMA_BASE_URL:-http://host.docker.internal:11434}"

echo "==> Cortex homelab Ollama setup (model: $MODEL)"

if ! command -v ollama >/dev/null 2>&1; then
  echo "==> Installing Ollama on host (needs sudo in a real terminal)..."
  if curl -fsSL https://ollama.com/install.sh | sh; then
    echo "==> Host Ollama installed."
  else
    echo "==> Host install skipped — starting Ollama via Docker (profile: ollama)..."
    USE_DOCKER_OLLAMA=1
    BASE_URL="http://ollama:11434"
    (cd "$COMPOSE_DIR" && docker compose --profile ollama up -d ollama)
    for i in $(seq 1 45); do
      curl -sf --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && break
      sleep 2
    done
  fi
else
  echo "==> Ollama already installed: $(ollama --version 2>/dev/null || true)"
fi

if [[ "$USE_DOCKER_OLLAMA" -eq 0 ]] && ! curl -sf --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo "==> Starting Ollama service..."
  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl enable ollama 2>/dev/null || true
    sudo systemctl start ollama 2>/dev/null || true
  fi
  if command -v ollama >/dev/null 2>&1; then
    nohup ollama serve >/tmp/ollama-serve.log 2>&1 &
  fi
  for i in $(seq 1 30); do
    curl -sf --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && break
    sleep 1
  done
fi

echo "==> Pulling model $MODEL (may take a few minutes)..."
if [[ "$USE_DOCKER_OLLAMA" -eq 1 ]]; then
  docker exec "$(cd "$COMPOSE_DIR" && docker compose --profile ollama ps -q ollama)" ollama pull "$MODEL" \
    || echo "WARN: docker pull failed — run: docker compose --profile ollama exec ollama ollama pull $MODEL"
else
  ollama pull "$MODEL" || echo "WARN: pull failed — run 'ollama pull $MODEL' manually"
fi

upsert() {
  local key="$1" val="$2" file="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$file"
  else
    echo "${key}=${val}" >>"$file"
  fi
}

if [[ -f "$API_ENV" ]]; then
  echo "==> Updating $API_ENV"
  upsert "OLLAMA_BASE_URL" "$BASE_URL" "$API_ENV"
  upsert "OLLAMA_MODEL" "$MODEL" "$API_ENV"
else
  echo "WARN: $API_ENV not found — set OLLAMA_BASE_URL=$BASE_URL manually"
fi

LOCAL_ENV="$ROOT/backend/.env"
if [[ -f "$LOCAL_ENV" ]]; then
  upsert "OLLAMA_BASE_URL" "http://127.0.0.1:11434" "$LOCAL_ENV"
  upsert "OLLAMA_MODEL" "$MODEL" "$LOCAL_ENV"
fi

echo "==> Done. Redeploy API: bash scripts/homelab-deploy-api-web.sh"
curl -sf http://127.0.0.1:11434/api/tags | head -c 200 || echo "(Ollama not responding yet)"
echo
