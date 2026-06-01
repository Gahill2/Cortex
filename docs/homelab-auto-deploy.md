# Homelab auto-deploy (no sudo)

On the **cortex** hub, redeploy Docker when code changes — **without sudo** for normal operation.

## First time only (stuck containers / snap Docker AppArmor)

If `docker stop` fails with **permission denied** (common with **snap Docker** on Ubuntu):

```bash
npm run server:docker:fix-once
```

This does **not** need sudo. It stops containers from inside (AppArmor workaround), removes them, and redeploys.

Check anytime:

```bash
npm run server:docker:doctor
```

### Dual Docker installs (root cause on this hub)

This machine has **both** `docker.io` (apt) and **snap `docker`** running. That triggers AppArmor denials when stopping containers. Long-term, pick one:

- **Recommended:** `sudo snap remove docker --purge` then use apt `docker.io` only, **or**
- Remove apt docker and use snap only

After removing one: `sudo aa-remove-unknown` and reboot.

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
