# Local server with Docker (this PC → homelab later)

Run Cortex on **your machine as the server** using Docker, then move the same stack to a ZimaBoard or NAS when ready ([homelab-migration.md](./homelab-migration.md)).

## One database for everything

All app data (tasks, mail accounts, OAuth tokens, settings) lives in **Postgres inside Docker** at `deploy/homelab/data/postgres/`. That volume survives container restarts.

| Do | Don't |
|----|--------|
| Use **http://127.0.0.1:8080** for daily use | Run `npm run dev` at the same time (second API + often a **different** empty DB) |
| `npm run server:up` / `server:down` | Point `backend/.env` at Railway **and** Docker unless you mean to |
| Log in with the **same email** as Railway after import | Expect data from `npm run dev` on another `DATABASE_URL` to appear here |

**Empty app after login?** The homelab database was new. Import your old data once (below), then only use the Docker server so new data stays in one place.

### Import existing data (Railway or backup)

1. Export from Railway (private `DATABASE_URL`):

   ```bash
   pg_dump "$DATABASE_URL" -Fc -f cortex-railway.dump
   ```

2. Import into homelab:

   ```powershell
   npm run server:import -- -DumpPath C:\path\to\cortex-railway.dump
   ```

3. Copy **`CORTEX_ENCRYPTION_KEY`** and **`JWT_SECRET`** from Railway into `deploy/homelab/env/api.env` (same values or encrypted mail tokens cannot be read).

4. Open http://127.0.0.1:8080 and sign in with your **Railway email**.

Backups: `npm run server:backup` → `deploy/homelab/data/backups/`.

## Choose a stack

| Goal | Command | What runs |
|------|---------|-----------|
| **Cortex only** (recommended first) | `npm run server:up` | Postgres + API + static UI |
| **Cortex + InsForge** (multi-device tailnet) | `npm run hub:up` | Full hub — heavier; see [insforge-tailscale.md](./insforge-tailscale.md) |
| **n8n only** | `docker compose up -d n8n` | Automation; optional |

## One-time: Docker Desktop

1. Install [Docker Desktop](https://docs.docker.com/desktop/) (Windows).
2. Enable WSL2 backend if prompted.
3. Allocate **at least 4 GB RAM** to Docker (Settings → Resources).

## Obsidian brain + canvas photos on Docker

Homelab mounts your **Grey Hill Brain** vault and persists API files under `deploy/homelab/data/api/`:

| What | Host | In container |
|------|------|----------------|
| Vault notes | `OBSIDIAN_VAULT_HOST_PATH` in `deploy/homelab/.env` | `/vault` |
| Canvas images | `deploy/homelab/data/api/canvas-assets/` | `/app/data/canvas-assets/` |
| Vault index cache | `deploy/homelab/data/api/.cortex/` | `/app/data/.cortex/` |

Before `server:up` (or after local dev changes), sync from your machine:

```powershell
npm run server:sync-local
```

That copies `backend/obsidian-vaults.json`, `backend/.cortex/`, and any `backend/data/canvas-assets/` into the homelab data dir and sets `OBSIDIAN_*` in `env/api.env`.

**Phone / Tailscale:** `npm run server:tailscale` then open `http://<tailscale-ip>:8080` (same vault + data on this PC).

**Canvas layout** (widget positions) lives in **Postgres**, not the vault folder. If Docker looks empty but local `npm run dev` had your dashboard, import once with `npm run server:import` or re-arrange the home canvas while logged into Docker.

## Start the server (homelab)

```powershell
# From repo root — creates .env + secrets on first run, syncs local vault/canvas data
npm run server:up
```

Wait for the build, then:

```powershell
npm run db:migrate
```

Open:

- **App:** http://127.0.0.1:8080  
- **API health:** http://127.0.0.1:4000/api/health  

Postgres is on **localhost:5432** (user/db from `deploy/homelab/.env`).

## Dev workflow (avoid duplicate processes)

**Do not** run `npm run dev` and `npm run server:up` together — both bind API port **4000**.

| What you want | Commands |
|---------------|----------|
| Use Docker as production-like server | `npm run server:up` → browse :8080 |
| Hot-reload UI only | `npm run server:up` then `npm run dev:frontend` |
| Classic local dev (no Docker API) | `npm run cleanup:processes` then `npm run dev` |
| Stop Docker server | `npm run server:down` |

Before switching modes:

```powershell
npm run cleanup:processes
```

Optional — also stop Cursor-spawned Azure MCP duplicates (respawns when needed):

```powershell
npm run cleanup:processes -- -IncludeMcp
```

See [dev-resources.md](./dev-resources.md) for RAM tips.

## Point `backend/.env` at Docker Postgres

The API container runs migrations on startup. For **host-side** Prisma or a local API later:

```powershell
npm run server:sync-env   # writes DATABASE_URL + JWT keys into backend/.env
npm run db:migrate        # only needed after schema changes
```

Or copy `backend/.env.homelab.example` and set the password from `deploy/homelab/.env`.

Check stack health anytime:

```powershell
npm run server:status
```

## Later: move to a real server

1. Copy `deploy/homelab/data/` (or your `CORTEX_DATA_DIR`) to the new host.
2. Copy `deploy/homelab/.env` and `env/api.env` (same secrets = same encrypted tokens).
3. On the new machine: `docker compose up -d --build` from `deploy/homelab`.
4. Optional: join [Tailscale](https://tailscale.com/) and update `VITE_API_BASE_URL` / OAuth URLs.

For InsForge + shared DB across laptops, switch to `npm run hub:up` and [insforge-tailscale.md](./insforge-tailscale.md).

## Login / email OTP

Homelab uses **production** mode. Without SMTP, login codes are not emailed unless you configure mail or enable the homelab fallback.

**Option A — no inbox (local PC / private tailnet only)**  
In `deploy/homelab/env/api.env`:

```env
CORTEX_OTP_DEV_FALLBACK=1
```

Restart API: `docker compose --env-file .env up -d cortex-api` from `deploy/homelab`.  
Request a code on http://127.0.0.1:8080 — the 6-digit code appears on the login screen.

**Option B — real email (recommended before exposing on the internet)**  
Gmail example (use a [Google App Password](https://support.google.com/accounts/answer/185833)):

```env
CORTEX_OTP_DEV_FALLBACK=0
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
```

Then recreate the API container so env reloads.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| “Email is not configured on the server” | Set `CORTEX_OTP_DEV_FALLBACK=1` or SMTP_* in `deploy/homelab/env/api.env`, restart `cortex-api` |
| Port 4000 / 5173 in use | `npm run cleanup:processes` |
| `POSTGRES_PASSWORD` unset | Re-run `npm run server:up` (creates `.env`) or copy `.env.example` |
| Cursor crashes on boot | Close Simple Browser previews; run cleanup; avoid stacking `hub:up` + `dev:desktop` |
| Build slow on first run | Normal — API + web images build from source |
