# Homelab auto-deploy (no sudo)

On the **cortex** hub, redeploy Docker when code changes — **without sudo** for normal operation.

## First time only (Docker permission denied)

If `docker restart` / `docker stop` fails with **permission denied** (snap Docker + AppArmor on Ubuntu):

```bash
npm run server:docker:setup-perms
```

Run **once in your terminal** (sudo will prompt). It:

1. Ensures your user is in the `docker` group
2. Grants **passwordless sudo** for `docker`, `docker compose`, and Docker systemd/snap services
3. Optionally removes **snap docker** when both snap and apt `docker.io` are installed (root cause on this hub)

After setup, manage any container without fighting permissions:

```bash
npm run docker:restart -- cortex-qbittorrent
npm run docker:restart -- cortex-radarr
npm run docker:rm -- cortex-nas-jellyfin-1
```

Stuck Cortex API/web only (no sudo):

```bash
npm run server:docker:fix-once
```

Check anytime:

```bash
npm run server:docker:doctor
```

### Dual Docker installs (root cause on this hub)

This machine has **both** `docker.io` (apt) and **snap `docker`** running. That triggers AppArmor denials when stopping containers. `server:docker:setup-perms` can remove snap and keep apt — **reboot** after that. Or pick one manually and run `sudo aa-remove-unknown`.

## Enable auto-deploy (no sudo)

```bash
npm run server:deploy:setup
```

This will:

1. Verify you can manage Docker as your user
2. Deploy immediately
3. Install a **user systemd timer** (checks every **2 minutes**) — no root required

Logs: `journalctl --user -u cortex-homelab-deploy-watch.service -f`

## What triggers a redeploy

| Trigger | Example |
|---------|---------|
| **Local commit** | You commit on the cortex PC |
| **Git pull** | `origin/main` has new commits |
| **Uncommitted edits** | Changes to `backend/src` or `frontend/src` |

State is stored in `~/.local/state/cortex/homelab-deploy/` (not `deploy/homelab/data/`, which Docker may own as root).

## Manual deploy

```bash
npm run server:deploy
```

Uses `docker compose` as your user only — never sudo.

## GitHub webhook (optional, no sudo)

User systemd unit (no root):

```bash
mkdir -p ~/.config/systemd/user
sed "s|/home/greyhill|$HOME|g" deploy/homelab/systemd/user/cortex-homelab-webhook.service > ~/.config/systemd/user/cortex-homelab-webhook.service
systemctl --user daemon-reload
systemctl --user enable --now cortex-homelab-webhook
```

Add `GITHUB_WEBHOOK_SECRET` to `deploy/homelab/.env`. GitHub payload URL: `http://100.104.120.29:9090/hooks/cortex-deploy`

## Rules

1. **Never** `sudo docker compose` — it creates containers only root can stop later.
2. Your user must be in the `docker` group: `groups` should list `docker`.
3. Postgres data stays in `deploy/homelab/data/postgres/` (root-owned volume is OK).

## npm scripts

| Command | Purpose |
|---------|---------|
| `npm run server:deploy` | Deploy now (no sudo) |
| `npm run server:deploy:setup` | Enable 2-min auto-deploy timer (no sudo) |
| `npm run server:docker:doctor` | Check Docker permissions |
| `npm run server:docker:fix-once` | **One-time** sudo cleanup of old containers |
| `npm run server:deploy:watch` | Deploy only if git/source changed |
| `npm run server:webhook` | Webhook listener (foreground) |
