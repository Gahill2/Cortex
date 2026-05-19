# Homelab migration (Railway / PC → ZimaBoard)

Cortex is designed so **PostgreSQL is the portable source of truth**. Application state that matters long-term lives in Postgres (users, tasks, mail metadata, integration tokens encrypted with `CORTEX_ENCRYPTION_KEY`, etc.). Secrets and integration credentials belong in **environment variables** (or a secrets file on the host), not only inside the database.

Homelab stack: [`deploy/homelab/docker-compose.yml`](../deploy/homelab/docker-compose.yml).

**InsForge + same DB on all Tailscale devices:** use [`deploy/tailscale-hub/`](../deploy/tailscale-hub/) and [insforge-tailscale.md](./insforge-tailscale.md) instead of Postgres-only homelab when you want the full InsForge platform and one shared database across laptops and phones.

## Principles

| Topic | Approach |
|--------|----------|
| **Data** | Postgres volume on disk (`pg_dump` / `pg_restore` for moves) |
| **Secrets** | `deploy/homelab/env/api.env` + compose `.env` — same keys as Railway |
| **UI** | Static `frontend/dist` via `cortex-web` (nginx); set `VITE_API_BASE_URL` at **build** time |
| **Access** | [Tailscale](https://tailscale.com/) on the board; optional [Tailscale Serve](https://tailscale.com/kb/1312/serve) for HTTPS |
| **Cache** | In-process rate limits today; optional Redis profile in compose for future use |

## Recommended layout on ZimaBoard (ZimaOS)

```text
/opt/cortex/                    # git clone or release tarball
  deploy/homelab/
    .env                        # POSTGRES_PASSWORD, ports, VITE_API_BASE_URL
    env/api.env                 # JWT_SECRET, CORS, OAuth keys
    data/                       # CORTEX_DATA_DIR=./data (default)
      postgres/                 # bind-mount → Postgres data
      redis/                    # optional, if using compose profile redis
/data/cortex/                   # optional: absolute CORTEX_DATA_DIR=/data/cortex
  postgres/
  backups/                      # pg_dump archives (cron)
```

On the board: install Docker, join Tailscale, clone repo, copy env files, then from `deploy/homelab`:

```bash
cp .env.example .env
cp env/api.env.example env/api.env
# edit secrets and VITE_API_BASE_URL (Tailscale/LAN API URL)
docker compose up -d --build
```

API health: `http://<host>:4000/api/health` · UI: `http://<host>:8080`

## Export from Railway (Postgres)

Use the **private** `DATABASE_URL` from the Railway Postgres service (not a one-off public URL unless you have no other option).

```bash
# Custom format (recommended for pg_restore)
pg_dump "$DATABASE_URL" -Fc -f cortex-railway.dump

# Or plain SQL
pg_dump "$DATABASE_URL" -f cortex-railway.sql
```

Store the dump and a copy of production `JWT_SECRET`, `CORTEX_ENCRYPTION_KEY`, and integration env vars securely. **Without the same encryption key, encrypted tokens in Postgres cannot be decrypted on the homelab.**

## Import on homelab

1. Start Postgres only (or full stack with empty DB):

   ```bash
   cd deploy/homelab
   docker compose up -d postgres
   ```

2. Wait until healthy, then restore **into the compose database** (service name `postgres`, DB/user from `.env`):

   ```bash
   # Custom format
   docker compose exec -T postgres pg_restore -U cortex -d cortex --clean --if-exists < cortex-railway.dump

   # Plain SQL
   docker compose exec -T postgres psql -U cortex -d cortex < cortex-railway.sql
   ```

3. If Prisma migration history is missing but tables exist, the API start script baselines P3005 the same way as Railway (see `backend/scripts/prisma-deploy.mjs` and [railway-deploy.md](./railway-deploy.md)).

4. Start API + web:

   ```bash
   docker compose up -d --build
   ```

## What does **not** migrate automatically

| Item | Notes |
|------|--------|
| **OAuth links** | Google / Microsoft / Spotify / Notion redirect URIs must be updated to homelab API URL; users may need to reconnect |
| **JWT sessions** | New `JWT_SECRET` invalidates existing cookies — users sign in again |
| **Redis / Upstash** | Optional; not required for current in-memory rate limits |
| **Firebase / Firestore env sync** | Separate project; copy credentials if you use it |
| **n8n workflows** | Separate compose service in repo root `docker-compose.yml` if you use it |
| **Railway volumes** | Only Postgres dump moves app data; file uploads on ephemeral disk are not migrated unless you export them |

## Tailscale (optional)

- **Simple:** expose ports `4000` (API) and `8080` (UI) on the tailnet; set `CORS_ORIGINS` and `CORTEX_FRONTEND_URL` to `http://<machine>:8080` or MagicDNS.
- **Serve:** terminate HTTPS and proxy to `localhost:8080` / `localhost:4000`; update OAuth redirect URIs to the Serve hostnames.
- Rebuild `cortex-web` after changing API URL: set `VITE_API_BASE_URL` in `deploy/homelab/.env` and `docker compose build cortex-web`.

## Backups

Cron on the host (example):

```bash
docker compose -f /opt/cortex/deploy/homelab/docker-compose.yml exec -T postgres \
  pg_dump -U cortex -Fc cortex > /data/cortex/backups/cortex-$(date +%F).dump
```

Keep at least one off-board copy (NAS, cloud object storage).

## Optional Redis

```bash
docker compose --profile redis up -d
```

Cortex does not require Redis today; the profile reserves `./data/redis` for future cache or rate-limit backends.

## Related docs

- Railway deploy: [railway-deploy.md](./railway-deploy.md)
- Local Postgres (dev): root `docker-compose.yml` postgres service
