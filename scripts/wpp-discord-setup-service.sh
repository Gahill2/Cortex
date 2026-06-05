#!/usr/bin/env bash
# Install + start WPP Discord bot as a user systemd service (survives reboot).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
USER_UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

bash "$ROOT/scripts/wpp-discord-sync-env.sh"
npm run wpp:discord:install --prefix "$ROOT" >/dev/null 2>&1 || npm --prefix "$ROOT/discord-bot" install

mkdir -p "$USER_UNIT_DIR"
sed "s|/home/greyhill|$HOME|g" \
  "$ROOT/deploy/homelab/systemd/user/cortex-wpp-discord-bot.service" \
  >"$USER_UNIT_DIR/cortex-wpp-discord-bot.service"

systemctl --user daemon-reload
systemctl --user enable --now cortex-wpp-discord-bot.service
sleep 2
systemctl --user --no-pager status cortex-wpp-discord-bot.service || true
echo ""
echo "Logs: journalctl --user -u cortex-wpp-discord-bot.service -f"
