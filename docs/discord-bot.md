# Witness Protection Program — Discord bot

Discord bot for the WPP homelab: welcome new members, public service status, admin Docker control.

## Features

| Feature | Who | How |
|---------|-----|-----|
| Welcome on join | Everyone | Message in `#setup` (or DM) with link to setup pins |
| `/wpp-status` | Everyone | Jellyfin, Nextcloud, Immich, Joey library link |
| `/wpp-links` | Everyone | Bookmark URLs (ephemeral) |
| `/wpp-containers` | Admin | All homelab containers |
| `/wpp-start` / `/wpp-stop` / `/wpp-restart` | Admin | Control via deploy listener |

Admin = Discord Administrator permission **or** `DISCORD_ADMIN_ROLE_IDS` / `DISCORD_ADMIN_USER_IDS` in `.env`.

## Prerequisites

1. **Deploy listener** running (container list + start/stop):
   ```bash
   npm run server:deploy:setup   # once
   npm run server:deploy:listener
   ```
2. Same **`CORTEX_DEPLOY_TOKEN`** as `deploy/homelab/.env`.

## Discord application setup

1. [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** (e.g. `WPP Homelab`).
2. **Bot** → **Reset Token** → copy to `discord-bot/.env` as `DISCORD_BOT_TOKEN`.
3. **Bot** → enable intents:
   - **Server Members Intent** (required for welcome on join)
   - **Message Content** not required (slash commands only)
4. **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`
   - Invite bot to your server.
5. Copy **Application ID** → `DISCORD_APPLICATION_ID`.
6. Copy server ID → `DISCORD_GUILD_ID`; `#setup` channel ID → `DISCORD_SETUP_CHANNEL_ID`.

## Install & run

You can put Discord vars in **`deploy/homelab/.env`** (same place as `CORTEX_DEPLOY_TOKEN`) or in `discord-bot/.env`.

Required in `deploy/homelab/.env`:

```bash
DISCORD_APPLICATION_ID=your_app_id
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_GUILD_ID=your_server_id          # right-click server → Copy Server ID
DISCORD_SETUP_CHANNEL_ID=your_setup_id  # right-click #setup → Copy Channel ID
```

From repo root:

```bash
npm run wpp:discord:install
npm run wpp:discord:sync-env    # optional: mirror homelab .env → discord-bot/.env
npm run wpp:discord:register    # slash commands (needs GUILD_ID)
npm run wpp:discord             # start bot
```

Dev (auto-reload):

```bash
npm run wpp:discord:dev
```

## Keep it running (optional)

Run beside the deploy listener, e.g. systemd user unit or `tmux`:

```bash
npm run server:deploy:listener &
npm run wpp:discord
```

Or add to your homelab auto-start script after Docker is up.

## Slash commands

| Command | Description |
|---------|-------------|
| `/wpp-status` | Public service health |
| `/wpp-links` | Jellyfin / Nextcloud / Immich URLs |
| `/wpp-containers` | Admin: docker ps (homelab only) |
| `/wpp-start container:name` | Admin: `docker start` |
| `/wpp-stop container:name` | Admin: `docker stop` |
| `/wpp-restart container:name` | Admin: `docker restart` |

Example: `/wpp-restart container:cortex-nas-jellyfin-1`

Only containers matching `cortex-homelab-*`, `cortex-nas-*`, `cortex-pihole*`, `immich_*`, media stack, etc. are allowed (see `scripts/homelab-docker-containers.sh`).

## Bot not in the member list?

**First, check the bot actually joined your server:**

```bash
npm run wpp:discord:doctor
```

If it says **not in ANY Discord server**, assigning a role under Integrations will not help — you must **invite** the bot with OAuth:

```
https://discord.com/oauth2/authorize?client_id=YOUR_APPLICATION_ID&permissions=84992&scope=bot%20applications.commands
```

Replace `YOUR_APPLICATION_ID` with `DISCORD_APPLICATION_ID` from `.env`. Pick **Witness Protection Program** when Discord asks which server. Then confirm **Server Settings → Integrations → Bots and Apps** lists your bot.

**Integrations ≠ invite.** Adding a “bot role” in Integrations only applies after the bot is already in the server.

Bots **are** members, but Discord groups them separately from normal users.

1. **Confirm it joined** — Server **Settings → Integrations → Bots and Apps** (or Members, search `Sanctified Mind`). If missing, re-invite with OAuth2 URL Generator (`bot` + `applications.commands`).
2. **Member list filter** — In the right sidebar, open the member list menu and ensure **Bots** is shown (some clients hide them).
3. **Bot must be running** — `npm run wpp:discord` (offline bots disappear from “online”).
4. **Give it a role** (shows color + optional category):
   - **Server Settings → Roles** → create e.g. `WPP Bot` → pick a color → enable **Display role members separately from online members** (*hoist*) if you want its own section in the sidebar.
   - **Server Settings → Members** → find the bot → **+** add that role.
   - Or drag the role onto the bot in the member list (under **Bots**).
5. **Nickname** — Members → bot → pencil → nickname e.g. `WPP Guide` (still shows BOT tag; Discord does not remove that).
6. **Avatar** — [Developer Portal](https://discord.com/developers/applications) → your app → **Bot** → profile picture.

Discord **cannot** list bots mixed with humans in the main online list—they always have a **BOT** badge and usually appear under a **Bots** group. A hoisted role is the closest to “standing out like a user.”

## Related docs

- [discord-setup-pin.md](./discord-setup-pin.md) — manual pins (bot complements, does not replace)
- [tailscale-family-setup.md](./tailscale-family-setup.md) — WPP connect guide
