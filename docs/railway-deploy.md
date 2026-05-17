# Railway deploy (Cortex API — PostgreSQL)

Deploy the **backend** service only from the `backend/` directory (set **Root Directory** → `backend` in Railway).

## 1. PostgreSQL database

1. In the Railway project → **New** → **Database** → **PostgreSQL** (or add Postgres to the project).
2. On the **backend** API service → **Variables** → add a reference to the Postgres service’s **`DATABASE_URL`** (the **private** URL on the Railway internal network).
3. Do **not** use `DATABASE_PUBLIC_URL` for the API — use the private `DATABASE_URL` so traffic stays on Railway’s network.

Example (variable reference in Railway):

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

On first deploy to an **empty** database, `npm run start` runs `prisma migrate deploy`, which applies `backend/prisma/migrations/20260517200000_postgres_init` and creates all tables. No manual SQL required.

**Migrating from an old SQLite volume deploy:** data does not transfer automatically. Export/import manually if needed, or treat Railway Postgres as a fresh database.

## 2. Environment variables

Copy from `backend/.env.railway.example`. Minimum for a stable solo production API:

| Variable | Notes |
|----------|--------|
| `NODE_ENV` | `production` |
| `PORT` | Leave unset — Railway injects `PORT` automatically |
| `DATABASE_URL` | Private Postgres URL from the Postgres plugin (`${{Postgres.DATABASE_URL}}`) |
| `JWT_SECRET` | ≥32 random characters |
| `CORTEX_ENCRYPTION_KEY` | ≥32 random characters (reserved for at-rest secrets) |
| `CORTEX_FRONTEND_URL` | Public URL of your UI, e.g. `https://app.example.com` |
| `CORS_ORIGINS` | Comma-separated browser origins, e.g. `https://app.example.com` (no `/api` suffix) |

OAuth redirects (Gmail, Spotify, etc.) must use your **API** public URL, e.g. `https://<api>.up.railway.app/api/gmail/oauth/callback`.

Unset demo auth in production (`CORTEX_DEMO_USER_*`) unless you intentionally want them.

## 3. Build & start

- **Build:** Nixpacks runs `npm install` + `npm run build` (see `backend/package.json`).
- **Start:** `npm run start` → `prisma migrate deploy` then `node dist/src/server.js`.
- **Health check:** path `/api/health` (configured in `backend/railway.json`).

Local development: point `DATABASE_URL` at a local Postgres instance (see `backend/.env.example`), then `npx prisma migrate deploy` or `npm run dev`.

## 4. Frontend (separate service or static host)

At **build** time set:

```env
VITE_API_BASE_URL=https://<your-api-service>.up.railway.app/api
```

See `frontend/.env.example`. Without this, production builds use same-origin `/api` only when UI and API share one hostname.

## 5. Custom domain (optional)

- API: Railway service → **Settings** → **Networking** → custom domain → update `CORS_ORIGINS`, OAuth redirect URIs, and `VITE_API_BASE_URL`.
- UI: point DNS at your static host; set `CORTEX_FRONTEND_URL` on the API to that URL.

## Quick checklist

- [ ] Service root directory = `backend`
- [ ] Postgres plugin added; `DATABASE_URL` references **private** Postgres URL
- [ ] `NODE_ENV=production`, secrets set
- [ ] `CORS_ORIGINS` + `CORTEX_FRONTEND_URL` match real UI URL(s)
- [ ] Health check `/api/health` green
- [ ] Frontend built with `VITE_API_BASE_URL` pointing at API `/api`
