#!/usr/bin/env bash
# Enable auto-deploy timer (user systemd — no sudo) + deploy now.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
USER_UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
HOME_DIR="$HOME"

echo "=== Cortex homelab auto-deploy setup (no sudo) ==="
echo "Repo: $ROOT"
echo ""

"$ROOT/scripts/homelab-docker-doctor.sh" || {
  echo ""
  echo "Run the one-time fix first, then re-run setup:"
  echo "  npm run server:docker:fix-once"
  echo "  npm run server:deploy:setup"
  exit 1
}

echo ""
echo "Step 1/4 — Deploy now..."
"$ROOT/scripts/homelab-deploy.sh"

echo "Step 2/4 — Deploy listener (Homelab UI redeploy button)..."
ENV_FILE="$ROOT/deploy/homelab/.env"
API_ENV="$ROOT/deploy/homelab/env/api.env"
if [[ -f "$ENV_FILE" ]] && ! grep -q '^CORTEX_DEPLOY_TOKEN=' "$ENV_FILE" 2>/dev/null; then
  TOKEN="$(openssl rand -hex 24)"
  echo "CORTEX_DEPLOY_TOKEN=$TOKEN" >>"$ENV_FILE"
  echo "Generated CORTEX_DEPLOY_TOKEN in deploy/homelab/.env"
fi
if [[ -f "$ENV_FILE" && -f "$API_ENV" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE" 2>/dev/null || true
  if [[ -n "${CORTEX_DEPLOY_TOKEN:-}" ]]; then
    grep -v '^HOMELAB_DEPLOY_TOKEN=' "$API_ENV" >"${API_ENV}.tmp" || cp "$API_ENV" "${API_ENV}.tmp"
    echo "HOMELAB_DEPLOY_TOKEN=${CORTEX_DEPLOY_TOKEN}" >>"${API_ENV}.tmp"
    mv "${API_ENV}.tmp" "$API_ENV"
  fi
fi
sed "s|/home/greyhill|$HOME_DIR|g" \
  "$ROOT/deploy/homelab/systemd/user/cortex-homelab-deploy-listener.service" >"$USER_UNIT_DIR/cortex-homelab-deploy-listener.service"
systemctl --user enable --now cortex-homelab-deploy-listener.service

echo "Step 3/4 — Install user systemd timer (every 2 minutes)..."
mkdir -p "$USER_UNIT_DIR"
for f in cortex-homelab-deploy-watch.service cortex-homelab-deploy-watch.timer; do
  sed "s|/home/greyhill|$HOME_DIR|g" \
    "$ROOT/deploy/homelab/systemd/user/$f" >"$USER_UNIT_DIR/$f"
done
systemctl --user daemon-reload
systemctl --user enable --now cortex-homelab-deploy-watch.timer
loginctl enable-linger "$USER" 2>/dev/null || true

echo "Step 4/4 — Status"
systemctl --user list-timers cortex-homelab-deploy-watch.timer --no-pager
echo ""
docker ps --filter name=cortex-homelab-cortex --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo ""
curl -sS http://127.0.0.1:8080/api/health/live || true
echo ""
echo "Done — no sudo required for ongoing deploys."
echo ""
echo "Auto-deploy every 2 min when git or source files change."
echo "Manual: npm run server:deploy"
echo "Deploy listener: journalctl --user -u cortex-homelab-deploy-listener.service -f"
