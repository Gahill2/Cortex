# Homelab deploy (primary)

Cortex production runs on your **home Linux server** in Docker (`deploy/homelab/docker-compose.yml`). The UI is served by nginx on port **8080** and proxies `/api` to the API container — no Vercel or Railway required.

## Quick start on the server

```bash
cd /path/to/Cortex/deploy/homelab
cp .env.example .env
cp env/api.env.example env/api.env
# Edit POSTGRES_PASSWORD, JWT_SECRET, CORTEX_ENCRYPTION_KEY, CORS_ORIGINS, OAuth keys
docker compose --env-file .env up -d --build
```

- API health: `http://<host>:4000/api/health/live`
- Dashboard: `http://<host>:8080` (or Tailscale / Pi-hole DNS name)

From repo root you can use `npm run server:deploy` instead of raw `docker compose`.

## When you merge changes from GitHub

After pulling or merging `main` on the homelab machine:

```bash
cd /path/to/Cortex
git pull origin main
npm run server:deploy
```

That rebuilds `cortex-api` and `cortex-web` when source changed. Postgres data in `deploy/homelab/data/postgres/` is preserved.

### Auto-deploy (recommended)

One-time setup on the server (no sudo for day-to-day use):

```bash
npm run server:deploy:setup
```

This installs a **user systemd timer** that checks every **2 minutes** for new commits or local edits and runs `npm run server:deploy` when needed. See [homelab-auto-deploy.md](./homelab-auto-deploy.md).

Optional: GitHub webhook for instant deploy on push — same doc.

## Environment files

| File | Purpose |
|------|---------|
| `deploy/homelab/.env` | Compose ports, `POSTGRES_PASSWORD`, optional `VITE_API_BASE_URL` |
| `deploy/homelab/env/api.env` | JWT, CORS, OAuth, AI keys (API container) |

**Leave `VITE_API_BASE_URL` empty** in `deploy/homelab/.env` for the default homelab layout (UI calls same-origin `/api` via nginx). Only set it for split API/UI hosts.

Copy templates:

- `deploy/homelab/.env.example`
- `deploy/homelab/env/api.env.example`
- `backend/.env.homelab.example` (for local `npm run dev` against homelab Postgres)

## OAuth and CORS

Register redirect URIs against your **homelab API URL** (nginx `:8080` or direct `:4000`), not a cloud host:

| Integration | Example redirect URI |
|-------------|----------------------|
| Gmail | `http://<host>:8080/api/gmail/oauth/callback` |
| Spotify | `http://<host>:8080/api/spotify/oauth/callback` |
| Microsoft | `http://<host>:8080/api/microsoft/oauth/callback` |

Set matching values in `deploy/homelab/env/api.env` and `CORTEX_FRONTEND_URL` / `CORS_ORIGINS` to every UI origin you use (127.0.0.1, Tailscale IP, MagicDNS).

## Disconnecting Vercel / Railway (one-time)

These steps are **outside the repo** — do them in each provider dashboard when you no longer want cloud deploys:

1. **Vercel** — Project → Settings → disconnect the GitHub repo (or delete the project).
2. **Railway** — Service → Settings → disconnect GitHub or delete the service.
3. On the homelab server, confirm `deploy/homelab/env/api.env` does **not** reference `*.vercel.app` or `*.railway.app` in `CORS_ORIGINS` or `CORTEX_FRONTEND_URL`.

Legacy cloud docs (optional reference only): [cloud-deploy.md](./cloud-deploy.md).

## Related docs

- [homelab-auto-deploy.md](./homelab-auto-deploy.md) — timer, webhook, Docker permissions
- [homelab-ssh-docker.md](./homelab-ssh-docker.md) — SSH into the hub, fix Docker
- [homelab-migration.md](./homelab-migration.md) — import Postgres from Railway
- [homelab-custom-domain.md](./homelab-custom-domain.md) — Tailscale Serve / custom DNS
