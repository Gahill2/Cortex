#!/usr/bin/env bash
# Install Ollama on the homelab host, pull a default model, wire api.env for Docker API.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_ENV="${API_ENV:-$ROOT/deploy/homelab/env/api.env}"
MODEL="${OLLAMA_MODEL:-llama3.2}"
BASE_URL="${OLLAMA_BASE_URL:-http://host.docker.internal:11434}"

echo "==> Cortex homelab Ollama setup (model: $MODEL)"
echo "    Run in an interactive terminal on the cortex PC (install/start may prompt for sudo)."

if ! command -v ollama >/dev/null 2>&1; then
  echo "==> Installing Ollama..."
  if ! curl -fsSL https://ollama.com/install.sh | sh; then
    echo "ERROR: Ollama install failed (often sudo in non-interactive shell). Re-run in a real terminal."
    exit 1
  fi
else
  echo "==> Ollama already installed: $(ollama --version 2>/dev/null || true)"
fi

if ! curl -sf --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo "==> Starting Ollama service..."
  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl enable ollama 2>/dev/null || true
    sudo systemctl start ollama 2>/dev/null || true
  fi
  nohup ollama serve >/tmp/ollama-serve.log 2>&1 &
  for i in $(seq 1 30); do
    curl -sf --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && break
    sleep 1
  done
fi

echo "==> Pulling model $MODEL (may take a few minutes)..."
ollama pull "$MODEL" || echo "WARN: pull failed — run 'ollama pull $MODEL' manually"

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
