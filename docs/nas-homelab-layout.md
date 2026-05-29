# NAS + Cortex on one host (split storage)

One machine (`cortex`) runs **Cortex** (productivity) and **NAS services** (media, files, photos, backups). Data is split by **role** on disk, not one giant folder.

## Host layout (recommended)

Use a top-level data root (pick one and stick to it):

| Path | Purpose |
|------|---------|
| `/data/cortex/` | Cortex Postgres, API files, cortex DB backups |
| `/data/media/` | Jellyfin libraries (movies, TV, music) |
| `/data/photos/` | Immich originals + thumbs (grows fast) |
| `/data/cloud/` | Nextcloud user files |
| `/data/appdata/` | Container configs & service DBs (small) |
| `/data/backups/` | Restic/Borg repos, `pg_dump`, export archives |

```text
/data/
├── cortex/                 # ← set deploy/homelab CORTEX_DATA_DIR=/data/cortex
│   ├── postgres/
│   ├── api/
│   └── backups/            # cortex pg_dump (npm run server:backup)
├── media/
│   ├── movies/
│   ├── tv/
│   └── music/
├── photos/                 # Immich library root
├── cloud/                  # Nextcloud data/
├── appdata/
│   ├── jellyfin/config/
│   ├── nextcloud/          # db + config volumes
│   ├── immich/             # immich postgres, redis, model cache
│   └── backup/             # restic cache
└── backups/
    ├── restic/             # encrypted backup repository
    ├── dumps/              # manual exports
    └── manifests/
```

**Second disk later:** mount e.g. `/mnt/media` → bind only `/data/media` and `/data/photos` there; keep Cortex + DB on SSD.

## Docker stacks (separate compose projects)

| Stack | Directory | Purpose |
|-------|-----------|---------|
| **Cortex** | `deploy/homelab/` | Postgres, API, web — your tailnet app |
| **NAS** | `deploy/nas/` | Jellyfin, Nextcloud, Immich, backup job |

They share the host paths above but **do not share databases**. Each service has its own DB container under `appdata/`.

```bash
# Cortex (already running)
cd deploy/homelab && docker compose --env-file .env up -d

# NAS services
cp deploy/nas/.env.example deploy/nas/.env   # edit passwords
./scripts/nas-init-dirs.sh
cd deploy/nas && docker compose --env-file .env up -d
```

## Ports (Tailscale / LAN)

| Service | Port | URL (example) |
|---------|------|----------------|
| Cortex UI | 8080 | http://cortex.tail4f977b.ts.net:8080 |
| Cortex API | 4000 | (proxied via :8080) |
| Jellyfin | 8096 | http://100.x.x.x:8096 |
| Nextcloud | 8081 | http://100.x.x.x:8081 |
| Immich | 2283 | http://100.x.x.x:2283 |

Use [Tailscale ACLs](https://tailscale.com/kb/1018/acls) to limit who reaches each port.

## What to back up

| Source | Tool | Destination |
|--------|------|-------------|
| Cortex Postgres | `npm run server:backup` / `pg_dump` | `/data/backups/dumps/cortex/` |
| Nextcloud files + DB | restic (NAS stack) | `/data/backups/restic` |
| Immich photos | restic include `/data/photos` | same repo or separate |
| Media (movies) | optional restic / rsync to USB | external only (too big for nightly full) |
| `appdata/` | restic | `/data/backups/restic` |

Nightly: enable the `backup` profile in `deploy/nas/docker-compose.yml` (restic + cron sidecar).

## Cortex repo path vs data path

The git clone can stay at `~/Documents/Cortex`. **Only data** moves to `/data`:

```bash
# In deploy/homelab/.env
CORTEX_DATA_DIR=/data/cortex
```

Re-copy existing postgres once if you already have data under `deploy/homelab/data/postgres`.

## Optional: HTTPS

- **Cortex:** Tailscale Serve → `./scripts/configure-homelab-https.sh`
- **Jellyfin / Nextcloud / Immich:** reverse proxy (Caddy/NPM) on the host, or Tailscale Serve per port

## Related

- [local-server-docker.md](./local-server-docker.md) — Cortex homelab
- [homelab-auto-deploy.md](./homelab-auto-deploy.md) — GitHub → Docker redeploy
