# InsForge + Cortex on Tailscale (one database, all devices)

Run **InsForge and Postgres once** on an always-on machine on your tailnet (homelab PC, ZimaBoard, NAS). Every laptop, desktop, and phone uses that **same** database over Tailscale — no per-device Docker Postgres.

## Architecture

```mermaid
flowchart TB
  subgraph hub["Tailscale hub (always on)"]
    PG[(Postgres cortex)]
    IF[InsForge API :7130]
    IFA[InsForge Auth :7131]
    API[Cortex API :4000]
    WEB[Cortex Web :8080]
    PG --> IF
    PG --> API
    IF --> API
  end

  subgraph devices["Your devices (tailnet)"]
    LAP[Laptop dev]
    DESK[Desktop]
    PH[Phone browser]
  end

  LAP -->|DATABASE_URL :5432| PG
  LAP -->|npm run dev:web| API
  DESK --> PG
  PH --> WEB
  PH --> API
```

| What | Where | Port (default) |
|------|--------|----------------|
| **Postgres** (`cortex` DB) | Hub only | `5432` on hub Tailscale IP / MagicDNS |
| **InsForge API** | Hub | `7130` |
| **InsForge Auth UI** | Hub | `7131` |
| **Cortex API** | Hub (or local dev) | `4000` |
| **Cortex UI** | Hub static or local Vite | `8080` / `5173` |

Prisma and all app data stay on the hub Postgres. InsForge adds storage, MCP, and optional future auth ([phased plan](./insforge-migration.md)).

## 1. One-time setup on the hub

Requirements: [Docker](https://docs.docker.com/), [Tailscale](https://tailscale.com/) on the host, git clone of Cortex.

```bash
# On the hub machine (Linux example)
cd /opt/cortex
npm run hub:sync

cp deploy/tailscale-hub/.env.example deploy/tailscale-hub/.env
cp deploy/tailscale-hub/env/api.env.example deploy/tailscale-hub/env/api.env
```

Edit `deploy/tailscale-hub/.env`:

1. Set `TAILSCALE_HOST` to this machine’s **MagicDNS** name (Admin console → DNS) or stable `100.x.x.x` IP.
2. Replace `POSTGRES_PASSWORD`, `JWT_SECRET`, `ENCRYPTION_KEY`, `ACCESS_API_KEY`, `ADMIN_PASSWORD`.
3. Set **all** URLs that use `cortex-zima` to your real hostname, for example:
   - `API_BASE_URL=http://cortex-zima.tail12345.ts.net:7130`
   - `CORTEX_VITE_API_BASE_URL=http://cortex-zima.tail12345.ts.net:4000/api`

Edit `deploy/tailscale-hub/env/api.env`: same host in `CORTEX_FRONTEND_URL`, `CORS_ORIGINS`, and OAuth redirect URIs.

Start the stack:

```bash
npm run hub:up
```

First start builds InsForge images and can take **15–30+ minutes** on a small board.

Apply Prisma schema to the hub database (from any machine that can reach Postgres on the tailnet):

```bash
# DATABASE_URL must point at the hub — see backend/.env.tailscale.example
npm run db:migrate
```

Checks:

- InsForge Auth: `http://<TAILSCALE_HOST>:7131`
- InsForge API health: `http://<TAILSCALE_HOST>:7130`
- Cortex API: `http://<TAILSCALE_HOST>:4000/api/health`
- Cortex UI: `http://<TAILSCALE_HOST>:8080`

## 2. Each dev device (laptop / desktop)

The root `docker-compose.yml` no longer includes Postgres — only optional **n8n**. Do not run a second Postgres container on port 5432.

```bash
cp backend/.env.tailscale.example backend/.env
# Edit DATABASE_URL password and hostname

npm run db:migrate   # once, or after schema changes
npm run dev:web      # local UI + local API, remote DB
```

**Phone / tablet:** open `http://<TAILSCALE_HOST>:5173` only if you run Vite on a machine on the tailnet; otherwise use hub UI `http://<TAILSCALE_HOST>:8080`. The frontend already uses the same host for API calls when you use a Tailscale IP in the browser ([`resolveCortexApiBaseURL`](../frontend/src/api/client.ts)).

**API on hub, UI local:**

```bash
cp frontend/.env.tailscale.example frontend/.env.local
npm run dev:frontend
```

## 3. Security

- Postgres and InsForge ports bind on the hub’s Docker bridge and host interface. They are reachable on your **tailnet**, not the public internet, as long as you do not port-forward WAN → 5432.
- Use a strong `POSTGRES_PASSWORD` and rotate `JWT_SECRET` / `CORTEX_ENCRYPTION_KEY` from dev defaults before relying on real data.
- Restrict who can reach the hub with [Tailscale ACLs](https://tailscale.com/kb/1018/acls), for example only your user tag on ports `5432`, `4000`, `7130`, `8080`.
- Optional: [Tailscale Serve](https://tailscale.com/kb/1312/serve) for HTTPS; update OAuth redirect URIs to the Serve hostname.

Example ACL fragment (adapt tags and hosts):

```json
{
  "acls": [
    {
      "action": "accept",
      "src": ["tag:personal-devices"],
      "dst": ["tag:cortex-hub:5432", "tag:cortex-hub:4000", "tag:cortex-hub:7130", "tag:cortex-hub:8080", "tag:cortex-hub:7131"]
    }
  ]
}
```

## 4. Migrate from local Postgres

1. Dump old DB (if any): `pg_dump -h 127.0.0.1 -p 5432 -U postgres launchpad > backup.sql`
2. Start hub stack (`npm run hub:up`).
3. Restore into hub `cortex` DB (from a machine on the tailnet):

   ```bash
   psql "postgresql://postgres:PASSWORD@cortex-zima:5432/cortex" < backup.sql
   ```

4. Point every device at `backend/.env.tailscale.example` `DATABASE_URL`.
5. Legacy `launchpad-postgres` has been removed from this repo’s compose file.

Keep the **same** `CORTEX_ENCRYPTION_KEY` and `JWT_SECRET` as the source environment if you restore OAuth tokens and sessions.

## 5. InsForge MCP on dev machines

After the hub is up, point Cursor MCP at `http://<TAILSCALE_HOST>:7130` using `ACCESS_API_KEY` from `deploy/tailscale-hub/.env`. See [InsForge MCP docs](https://insforge.dev/docs).

## 6. Commands

| Command | Where | Purpose |
|---------|--------|---------|
| `npm run hub:sync` | Hub (or any clone) | Clone/update `vendor/insforge` |
| `npm run hub:up` | Hub | Start InsForge + Cortex |
| `npm run hub:down` | Hub | Stop stack |
| `npm run insforge:up` | Local only | Legacy **localhost** InsForge (port 5433) — not for multi-device |
| `npm run db:migrate` | Any device | Prisma migrate against `DATABASE_URL` |

## Related docs

- [insforge-migration.md](./insforge-migration.md) — phases (storage, auth, deploy)
- [homelab-migration.md](./homelab-migration.md) — Postgres-only homelab without InsForge
- [cortex-mcp.md](./cortex-mcp.md) — Cortex MCP + Tailscale mode
- [pi-coding-agent.md](./pi-coding-agent.md) — Pi terminal agent + Cortex MCP on the tailnet
