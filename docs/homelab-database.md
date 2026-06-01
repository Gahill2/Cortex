# Homelab database layout (cortex server)

One physical host runs **multiple databases** — by design. Cortex uses Postgres; NAS apps use their own engines.

## Primary: Cortex Postgres

| Item | Value |
|------|--------|
| **Stack** | `deploy/homelab/docker-compose.yml` |
| **Service** | `postgres` (Postgres 16) |
| **Data dir** | `deploy/homelab/data/postgres/` (or `CORTEX_DATA_DIR/postgres`) |
| **Default DB** | `cortex` |
| **Default user** | `cortex` |
| **Host port** | `5432` (Tailscale/LAN) |

**Stores:** users, tasks, projects, mail account metadata, encrypted OAuth tokens, canvas data, settings.

### First-time setup on the server

```bash
cd ~/Documents/Cortex
cp deploy/homelab/.env.example deploy/homelab/.env   # set POSTGRES_PASSWORD
cp deploy/homelab/env/api.env.example deploy/homelab/env/api.env
./scripts/sync-homelab-integrations.sh               # OAuth keys from backend/.env

npm run server:db:setup                              # start Postgres + prisma migrate
cd deploy/homelab && docker compose --env-file .env up -d --build
```

### Connection strings

| Client | URL |
|--------|-----|
| **Docker API** | `postgresql://cortex:PASSWORD@postgres:5432/cortex` (set in compose) |
| **Host tools / Prisma** | `postgresql://cortex:PASSWORD@127.0.0.1:5432/cortex` → `backend/.env` |

After schema changes on your dev PC: `npm run db:migrate` locally, commit migrations, deploy, then on server:

```bash
npm run server:db:setup
```

### Backup

```bash
npm run server:backup
# or manual:
docker compose -f deploy/homelab/docker-compose.yml exec -T postgres \
  pg_dump -U cortex cortex > cortex-$(date +%F).sql
```

---

## NAS databases (separate — do not merge into Cortex DB)

| App | Engine | Location |
|-----|--------|----------|
| **Nextcloud** | MariaDB 11 | `deploy/nas/` → `appdata/nextcloud/db` |
| **Immich** | Postgres 14+ | `deploy/nas/immich/` (own compose project) |
| **Jellyfin** | SQLite (internal) | `appdata/jellyfin/config` |

Cortex **does not** manage these schemas. The Homelab tab probes their HTTP health only.

---

## Monitoring (metrics, not app data)

| Stack | Directory | Ports |
|-------|-----------|-------|
| Prometheus + Grafana + exporters | `deploy/monitoring/` | 9090, 3000, 9100, 8088 |

```bash
npm run monitoring:up
```

Grafana: `http://HOST:3000` — Prometheus datasource is pre-provisioned.

---

## Homelab tab (Cortex UI)

New nav item **Homelab** → `GET /api/homelab/status`:

- Service health tiles (Cortex, Jellyfin, Nextcloud, Immich, Grafana, Prometheus)
- Host CPU / memory / disk (via Prometheus)
- Cortex Postgres connection + row counts

### API env (`deploy/homelab/env/api.env`)

```env
# Tailnet IP or hostname for NAS/monitoring probes (when not same as CORTEX_FRONTEND_URL)
HOMELAB_SERVICE_HOST=100.104.120.29

# Optional overrides (defaults: HOST:8096 jellyfin, :8081 nextcloud, :2283 immich, :3000 grafana, :9090 prometheus)
HOMELAB_PROMETHEUS_URL=http://host.docker.internal:9090
HOMELAB_GRAFANA_URL=http://100.104.120.29:3000
```

When the API runs in Docker, `host.docker.internal:9090` reaches Prometheus on the host (requires `extra_hosts` in compose — already added).

---

## Dev PC vs server

| Work | Machine |
|------|---------|
| Code, `npm run dev` | Main PC |
| Production Cortex + Postgres + NAS | cortex server |
| Grafana / Prometheus | cortex server |

Keep `backend/.env` on your PC for local dev; sync secrets to the server with `./scripts/sync-homelab-integrations.sh` before deploy.
