#!/usr/bin/env bash
# Copy Discord + deploy listener vars from deploy/homelab/.env → discord-bot/.env
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/deploy/homelab/.env"
DST="$ROOT/discord-bot/.env"

[[ -f "$SRC" ]] || { echo "Missing $SRC" >&2; exit 1; }

get() { grep -E "^${1}=" "$SRC" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^ *//;s/ *$//' || true; }

cat >"$DST" <<EOF
# Synced from deploy/homelab/.env — edit either file; re-run: npm run wpp:discord:sync-env
DISCORD_APPLICATION_ID=$(get DISCORD_APPLICATION_ID)
DISCORD_BOT_TOKEN=$(get DISCORD_BOT_TOKEN)
DISCORD_GUILD_ID=$(get DISCORD_GUILD_ID)
DISCORD_SETUP_CHANNEL_ID=$(get DISCORD_SETUP_CHANNEL_ID)
DISCORD_ADMIN_ROLE_IDS=$(get DISCORD_ADMIN_ROLE_IDS)
DISCORD_ADMIN_USER_IDS=$(get DISCORD_ADMIN_USER_IDS)
CORTEX_DEPLOY_TOKEN=$(get CORTEX_DEPLOY_TOKEN)
HOMELAB_DEPLOY_LISTENER_URL=$(get HOMELAB_DEPLOY_LISTENER_URL)
EOF

[[ -n "$(get DISCORD_GUILD_ID)" ]] || echo "WARN: DISCORD_GUILD_ID empty — set in deploy/homelab/.env (right-click server → Copy Server ID)" >&2
echo "Wrote $DST"
