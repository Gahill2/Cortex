# Database (single source of truth)

Cortex app data lives in **one PostgreSQL** instance. Pick **one** stack and point every device at it.

| Setup | Command | DB location |
|-------|---------|-------------|
| **Homelab on this PC** | `npm run server:up` | Docker volume `deploy/homelab/data/postgres` — see [local-server-docker.md](./local-server-docker.md) |
| **InsForge hub** (tailnet) | `npm run hub:up` | Hub host — see [insforge-tailscale.md](./insforge-tailscale.md) |

### InsForge hub (Tailscale)

Cortex app data on the **InsForge hub** on your Tailscale host:

| Setting | Value (this setup) |
|---------|-------------------|
| Host (on hub) | `127.0.0.1` |
| Host (other devices) | `ghill` or `100.81.154.126` |
| Port | `5432` |
| Database | `launchpad` |
| User | `postgres` |

## Start / stop

```bash
npm run hub:up      # full stack
npm run hub:down    # stop hub compose
```

Postgres-only is already running if you only started the `postgres` service from `deploy/tailscale-hub/`.

## Removed (do not use)

- Root `docker-compose.yml` **postgres** service (`launchpad-postgres`) — removed
- Duplicate local `DATABASE_URL` on port 5433 unless you intentionally use `npm run insforge:up` without the hub
- **Supabase** env vars — not used by Cortex code

## Still separate (not the app DB)

- **Firebase / Firestore** — optional env sync (`docs/firebase-setup.md`)
- **Railway** — production deploy only (`docs/railway-deploy.md`)

See [insforge-tailscale.md](./insforge-tailscale.md) for multi-device setup.
