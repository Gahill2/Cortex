# Cloud deploy (Vercel UI + Railway API)

Use this when Cortex should be **public on the internet**, not localhost-first.

| Piece | Host | Repo path |
|-------|------|-----------|
| Web UI | [Vercel](https://vercel.com) | `frontend/` |
| API + Postgres | [Railway](https://railway.com) | `backend/` |

Local dev (`npm run dev` in `frontend/` + `backend/`) still works. Production UI calls Railway when `VITE_API_BASE_URL` is set at **Vercel build** time.

Template placeholders (replace everywhere):

- `YOUR_VERCEL_URL` — production UI origin, e.g. `https://cortex.vercel.app` (no trailing slash)
- `YOUR_RAILWAY_URL` — public API origin, e.g. `https://cortex-production.up.railway.app` (no trailing slash)

## 1. Railway API

Follow [railway-deploy.md](./railway-deploy.md) for Postgres, Docker build, and health checks.

### Required variables (Railway → backend service → Variables)

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (private reference) |
| `JWT_SECRET` | ≥32 random characters |
| `CORTEX_ENCRYPTION_KEY` | ≥32 random characters |
| `CORTEX_FRONTEND_URL` | `YOUR_VERCEL_URL` |
| `CORS_ORIGINS` | `YOUR_VERCEL_URL` (comma-separate if you have multiple UI origins) |

Do **not** set `PORT` — Railway injects it.

Copy the full template from `backend/.env.railway.example`.

### OAuth / integration callbacks (Railway API host)

Set on Railway and register the **same** URI in each provider console. OAuth hits the **API**, then redirects the browser to `CORTEX_FRONTEND_URL` (Vercel).

| Integration | Railway variable | Redirect URI to register |
|-------------|------------------|---------------------------|
| Gmail (Google) | `GOOGLE_REDIRECT_URI` | `YOUR_RAILWAY_URL/api/gmail/oauth/callback` |
| Microsoft | `MICROSOFT_REDIRECT_URI` | `YOUR_RAILWAY_URL/api/microsoft/oauth/callback` |
| Spotify | `SPOTIFY_REDIRECT_URI` | `YOUR_RAILWAY_URL/api/spotify/oauth/callback` |
| Notion (OAuth) | `NOTION_REDIRECT_URI` | `YOUR_RAILWAY_URL/api/notion/oauth/callback` |
| Canva Connect | `CANVA_REDIRECT_URI` | `YOUR_RAILWAY_URL/api/canva/oauth/callback` |

Also set provider client IDs/secrets (`GOOGLE_CLIENT_ID`, `SPOTIFY_CLIENT_ID`, etc.) on Railway.

**Code note:** several routes use `env.CORTEX_FRONTEND_URL || "http://localhost:5173"` for post-OAuth redirects. If `CORTEX_FRONTEND_URL` is unset in production, users land on localhost after OAuth — always set it to `YOUR_VERCEL_URL`.

### CORS

The API allows origins listed in `CORS_ORIGINS` and always merges `CORTEX_FRONTEND_URL` if set. In production, if both are unset, the server **logs a warning** and may still fall back to localhost dev origins — configure `CORS_ORIGINS` before real users hit the API.

### Health

| Check | URL |
|-------|-----|
| Liveness (Railway healthcheck) | `YOUR_RAILWAY_URL/api/health/live` |
| Readiness | `YOUR_RAILWAY_URL/api/health` |

## 2. Vercel frontend

1. Import the GitHub repo in Vercel.
2. **Root Directory:** `frontend` (required).
3. **Framework:** Vite — `frontend/vercel.json` sets `outputDirectory: dist` and SPA rewrites for `react-router-dom`.
4. **Environment variables** → **Production** (and Preview if you use it):

```env
VITE_API_BASE_URL=YOUR_RAILWAY_URL/api
```

Example: if Railway public URL is `https://cortex-production.up.railway.app`, set:

```env
VITE_API_BASE_URL=https://cortex-production.up.railway.app/api
```

5. Deploy. `VITE_*` values are baked in at **build** time — after changing them, **Redeploy** from Vercel.

Optional: `VITE_CANVA_APP_ID` for Canva UI hints (see `frontend/.env.production.example`).

Custom domain on Vercel: use that URL as `YOUR_VERCEL_URL`, update Railway `CORTEX_FRONTEND_URL` + `CORS_ORIGINS`, and redeploy the API.

## 3. OAuth provider consoles

Redirects are registered on the **API** host (`YOUR_RAILWAY_URL`), not Vercel.

### Google Cloud (Gmail)

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → **Credentials**.
2. OAuth 2.0 Client ID (Web application).
3. **Authorized redirect URIs:** `YOUR_RAILWAY_URL/api/gmail/oauth/callback`
4. Copy Client ID + Secret → Railway `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.

### Microsoft (Outlook / Graph)

1. [Azure Portal](https://portal.azure.com/) → Microsoft Entra ID → **App registrations** → your app.
2. **Authentication** → **Web** redirect URI: `YOUR_RAILWAY_URL/api/microsoft/oauth/callback`
3. Railway: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI` (and tenant settings per `backend/.env.example`).

### Spotify

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) → your app → **Settings**.
2. **Redirect URIs:** `YOUR_RAILWAY_URL/api/spotify/oauth/callback`  
   (not `localhost:3000` — the API route is under `/api/spotify/oauth/callback`.)
3. Railway: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`.

### Notion (optional OAuth)

1. [Notion integrations](https://www.notion.so/my-integrations) → OAuth redirect URL: `YOUR_RAILWAY_URL/api/notion/oauth/callback`
2. Railway: `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `NOTION_REDIRECT_URI`

### Canva Connect (optional)

1. [Canva Developers](https://www.canva.dev/) → Connect integration → Authentication redirect: `YOUR_RAILWAY_URL/api/canva/oauth/callback`
2. Railway: `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `CANVA_REDIRECT_URI`

### Stripe (billing)

Stripe Checkout return URLs use `CORTEX_FRONTEND_URL` (`/?billing=success`, `/?billing=cancel`). Webhooks use `YOUR_RAILWAY_URL/api/billing/webhook` — configure that in the Stripe dashboard.

## 4. How the frontend finds the API

`frontend/src/api/client.ts` resolves the axios base URL:

1. Electron → `http://localhost:4000/api`
2. `VITE_API_BASE_URL` if set (required for Vercel + Railway split deploy)
3. In production without env → same-origin `/api` (only works if UI and API share one hostname)
4. Local dev → `localhost:4000` or same LAN host as Vite

## 5. Verify

| Check | Action |
|-------|--------|
| API liveness | Open `YOUR_RAILWAY_URL/api/health/live` → `{"status":"ok"}` |
| UI | Open `YOUR_VERCEL_URL`, hard refresh or incognito |
| API calls | DevTools → Network → requests to `YOUR_RAILWAY_URL/api/...`, not `localhost:4000` |
| CORS | Sign in; no blocked-origin errors in console |
| OAuth | Connect Gmail/Spotify; browser returns to `YOUR_VERCEL_URL` with success/error query params |

## 6. What not to use in production

- Do not rely on localhost or Tailscale-only URLs for the main hosted app.
- Do not commit `backend/.env` or put secrets in the repo.
- Do not set `VITE_API_BASE_URL` only in a local `.env` — Vercel must have it for production builds.
- Homelab / Docker: [homelab-migration.md](./homelab-migration.md) (optional second environment).

## Auto deploy on push

With GitHub connected to **Railway** (backend) and **Vercel** (frontend), every **`git push origin main`** redeploys both services.

- **GitHub Actions** (`.github/workflows/cloud-deploy.yml`): validates backend/frontend builds on each push; twice daily (08:00 and 20:00 UTC) an empty commit on `main` retriggers deploys if you want periodic refreshes without local commits.
- **Local auto-push** (optional): run `scripts/cloud-sync-push.ps1` on a schedule (Windows Task Scheduler) to commit and push any saved changes.

## Quick checklist

- [ ] Railway: Postgres, `DATABASE_URL`, `JWT_SECRET`, health green on `/api/health/live`
- [ ] Railway: `CORTEX_FRONTEND_URL` + `CORS_ORIGINS` = `YOUR_VERCEL_URL`
- [ ] Railway: OAuth `*_REDIRECT_URI` = `YOUR_RAILWAY_URL/api/.../oauth/callback`
- [ ] Google / Microsoft / Spotify (and optional Notion/Canva) consoles match Railway redirect URIs
- [ ] Vercel: root directory `frontend`
- [ ] Vercel: `VITE_API_BASE_URL` = `YOUR_RAILWAY_URL/api`
- [ ] Redeploy Vercel after env changes
