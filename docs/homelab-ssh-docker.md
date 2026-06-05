# Homelab SSH + Docker reset (for Claude Code / terminal agents)

Use this when the agent runs on a **laptop/PC** and must operate the **cortex** homelab host, or when containers need a clean restart.

## Am I already on cortex?

```bash
hostname   # cortex = you are ON the server; skip SSH
whoami     # greyhill
```

If `hostname` prints `cortex`, run Docker/npm commands **locally** in `~/Documents/Cortex` — no SSH.

If you are on **Windows** (`gahill`, `ghill`, etc.) or another Tailscale device, SSH in first (below).

## SSH into cortex

**Prerequisites:** Tailscale connected on your machine (same tailnet as `greyhill999@`).

| Method | Command |
|--------|---------|
| **Tailscale MagicDNS** (preferred) | `ssh greyhill@cortex.tail4f977b.ts.net` |
| **Tailscale IP** | `ssh greyhill@100.104.120.29` |
| **LAN** (same network as homelab) | `ssh greyhill@10.0.0.49` |

Repo path on the server:

```bash
cd ~/Documents/Cortex
```

**Auth:** SSH key on the client (`~/.ssh/id_ed25519` or similar). The server has `greyhill` with Docker group access — **do not use `sudo docker`**.

## List container health

```bash
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Or from repo root:

```bash
npm run server:docker:doctor
```

## Reset Docker stacks (no sudo)

### Cortex API + Web (homelab app)

Stuck or exited `cortex-homelab-cortex-api-1` / `cortex-homelab-cortex-web-1`:

```bash
cd ~/Documents/Cortex
npm run server:docker:fix-once    # remove stuck api/web + redeploy
# or full redeploy:
npm run server:deploy
```

Restart only (if containers exist but are wedged):

```bash
docker restart cortex-homelab-cortex-api-1 cortex-homelab-cortex-web-1
docker restart cortex-homelab-postgres-1   # if DB container down
```

Health check after:

```bash
curl -sf http://localhost:8080/api/health | python3 -m json.tool | head -20
```

### Media stack (VPN + torrents + *arr)

```bash
cd ~/Documents/Cortex/deploy/nas/media-stack
docker compose --env-file .env restart
# or recreate one service:
docker compose --env-file .env restart gluetun qbittorrent
```

From repo root:

```bash
npm run media:up
```

Verify VPN exit IP:

```bash
docker exec cortex-gluetun wget -qO- --timeout=8 https://am.i.mullvad.net/json
```

### NAS (Jellyfin, Nextcloud, etc.)

```bash
cd ~/Documents/Cortex
npm run nas:up
# or per-service:
docker restart cortex-nas-jellyfin-1 cortex-nas-nextcloud-1
```

### Pi-hole

```bash
npm run nas:pihole:up
# or:
docker restart cortex-pihole
```

### Immich

```bash
npm run nas:immich:up
```

## Rules (read before `docker compose down`)

1. **Never** `sudo docker compose` — creates root-owned containers that break deploy scripts.
2. User `greyhill` must be in the `docker` group (`groups | grep docker`).
3. Postgres data lives under `deploy/homelab/data/postgres/` — avoid `docker volume rm` on production stacks.
4. See [homelab-auto-deploy.md](./homelab-auto-deploy.md) for auto-deploy and snap-Docker AppArmor workarounds.

## One-liner from a remote machine

```bash
ssh greyhill@cortex.tail4f977b.ts.net 'cd ~/Documents/Cortex && npm run server:docker:fix-once && docker ps --format "table {{.Names}}\t{{.Status}}" | head -25'
```

## Common URLs after reset

| Service | URL |
|---------|-----|
| Cortex UI | http://localhost:8080 or http://cortex.tail4f977b.ts.net:8080 |
| Jellyfin | http://localhost:8096 |
| Radarr | http://localhost:7878 |
| qBittorrent | http://localhost:8089 |
