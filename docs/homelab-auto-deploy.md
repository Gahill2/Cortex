# Homelab auto-deploy (GitHub → Docker)

On the **cortex** hub, redeploy the Docker stack when `main` changes on GitHub.

## Deploy script (manual or automated)

```bash
./scripts/homelab-deploy.sh
```

Does: `git pull` → sync `backend/.env` integrations → `docker compose up -d --build` → `npm run db:migrate` → health check.

## Option A — Poll every 2 minutes (simplest)

No GitHub webhook required. Uses a systemd timer.

```bash
# One-time: fix Docker if API was started with sudo (permission errors)
sudo docker rm -f cortex-homelab-cortex-api-1

# Install timer (edit User/ paths in unit files if your home dir differs)
sudo cp deploy/homelab/systemd/cortex-homelab-deploy-watch.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cortex-homelab-deploy-watch.timer

# Check
systemctl list-timers cortex-homelab-deploy-watch.timer
journalctl -u cortex-homelab-deploy-watch.service -f
```

## Option B — Instant deploy on GitHub push (webhook)

1. Generate a secret:
   ```bash
   openssl rand -hex 32
   ```
2. Add to `deploy/homelab/.env`:
   ```env
   GITHUB_WEBHOOK_SECRET=your-secret-here
   ```
3. Start the webhook listener:
   ```bash
   sudo cp deploy/homelab/systemd/cortex-homelab-webhook.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now cortex-homelab-webhook
   ```
4. In GitHub → **Gahill2/Cortex** → Settings → Webhooks → Add:
   - **Payload URL:** `http://100.104.120.29:9090/hooks/cortex-deploy` (or MagicDNS; tailnet only)
   - **Content type:** `application/json`
   - **Secret:** same as `GITHUB_WEBHOOK_SECRET`
   - **Events:** Just the push event
   - **Branch:** `main`

Restrict port `9090` with [Tailscale ACLs](https://tailscale.com/kb/1018/acls) if needed.

## Docker permission note

Always run compose **without sudo** so your user can restart containers later:

```bash
cd deploy/homelab
docker compose --env-file .env up -d --build
```

If you previously used `sudo docker compose`, remove stuck containers once:

```bash
sudo docker rm -f cortex-homelab-cortex-api-1
```

## npm scripts

| Command | Purpose |
|---------|---------|
| `npm run server:deploy` | Run full deploy now |
| `npm run server:deploy:watch` | Deploy only if `origin/main` changed |
| `npm run server:webhook` | Start GitHub webhook listener (foreground) |
