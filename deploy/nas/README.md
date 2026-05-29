# NAS stack (Jellyfin, Nextcloud, Immich, backups)

Runs **alongside** Cortex homelab — separate databases, split disk paths.

**Full guide:** [docs/nas-homelab-layout.md](../../docs/nas-homelab-layout.md)

## Quick start

```bash
# From repo root
./scripts/nas-init-dirs.sh
cp deploy/nas/.env.example deploy/nas/.env
# Edit passwords in deploy/nas/.env

cd deploy/nas
docker compose --env-file .env up -d

# Optional: enable nightly restic backups
docker compose --profile backup --env-file .env up -d
```

## Point Cortex data at the same tree

In `deploy/homelab/.env`:

```env
CORTEX_DATA_DIR=/data/cortex
```

Restart Cortex after moving existing `data/postgres` if needed.
