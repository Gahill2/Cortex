# Cortex → InsForge migration

[InsForge](https://github.com/InsForge/InsForge) is an open-source backend platform (Postgres, auth, storage, edge functions, AI gateway, deployment). Cortex today uses **Express + Prisma + standalone Postgres** (Docker or Railway) plus custom JWT/OTP auth and many integration-specific tables.

This doc defines a **phased** path so you get “one stack, easier deploy” without blocking feature work on a full rewrite.

## Recommended: one database on Tailscale (all devices)

If you use **Tailscale** and want the **same** Postgres on laptop, desktop, and phone — **do not** run InsForge locally on each machine.

| Goal | Use |
|------|-----|
| **One hub** (homelab / ZimaBoard / NAS) | [`docs/insforge-tailscale.md`](./insforge-tailscale.md) — `npm run hub:sync` → `npm run hub:up` on the hub; `backend/.env.tailscale.example` on other devices |
| **Local-only** dev on one PC (no Tailscale hub) | `npm run insforge:up` (port **5433**) — below; most setups use **hub** on **5432** instead |

Stack: [`deploy/tailscale-hub/docker-compose.yml`](../deploy/tailscale-hub/docker-compose.yml). Quick reference: [database.md](./database.md).

## Current Cortex data layer

| Piece | Today |
|-------|--------|
| Database | PostgreSQL 16 (`docker-compose.yml` or Railway) |
| ORM | Prisma (`backend/prisma/schema.prisma`) |
| Auth | Custom Cortex JWT, OTP, PIN (`backend/src/routes/cortex/auth.*`) |
| OAuth tokens | `OAuthToken`, `MailAccount` rows (Google, Microsoft, Spotify, …) |
| App data | `User`, `Organization`, `Task`, `Project`, `UserSettings`, `CortexProfile`, … |

Prisma is used in **30+ backend modules** — replacing it with PostgREST/InsForge SDK is a **separate, large phase**.

## What InsForge adds

| InsForge product | Cortex today | Migration note |
|------------------|--------------|----------------|
| **Postgres** | `launchpad` / `cortex` DB | Phase 1 — point `DATABASE_URL` at InsForge Postgres |
| **Auth** | Custom OTP/PIN | Phase 3+ — optional; high coupling to existing flows |
| **Storage** | Local / canvas uploads | Phase 2 — canvas assets, mail attachments |
| **PostgREST** | N/A | Optional read APIs; not required if Prisma stays |
| **Model gateway** | Direct OpenAI/Anthropic env | Phase 4 — optional centralization |
| **Edge functions** | Express routes | Phase 5+ — only if you split workloads |

## Recommended phases

### Phase 1 — InsForge Postgres + single compose

**Goal:** One `docker compose` brings up InsForge’s Postgres (and the InsForge control plane) instead of a bare `postgres:16` container.

**Tailscale / multi-device (preferred):** follow [insforge-tailscale.md](./insforge-tailscale.md) (`hub:up`, shared `DATABASE_URL` on the tailnet).

**Single-machine local dev:**

- Run `npm run insforge:sync` once to clone InsForge into `vendor/insforge/`.
- Run `npm run insforge:up` to start the stack from `deploy/insforge/`.
- Set Cortex `DATABASE_URL` to the InsForge Postgres URL (see `deploy/insforge/.env.example`).
- Run `npm run db:migrate` (Prisma) against that database — **same schema**, new host.

**Port layout (default):**

| Service | Port | URL |
|---------|------|-----|
| InsForge Postgres (Cortex DB) | 5433 | `postgresql://postgres:postgres@127.0.0.1:5433/cortex` |
| Legacy Postgres (optional) | 5432 | Old `docker-compose.yml` service — disable when on InsForge |
| InsForge API | 7130 | http://localhost:7130 |
| InsForge Auth UI | 7131 | http://localhost:7131 |
| PostgREST | 5430 | http://localhost:5430 |

### Phase 2 — InsForge storage

- Move canvas image uploads and large blobs to InsForge storage (S3-compatible or local `STORAGE_DIR`).
- Keep metadata in Prisma or mirror bucket keys in `UserSettings` / canvas state.

### Phase 3 — Auth evaluation

- Map Cortex users to InsForge auth **only if** you want to drop custom OTP/PIN.
- Likely hybrid long-term: Cortex session for app shell, InsForge JWT for new features.
- Requires user migration script (password hashes are not portable without a reset).

### Phase 4 — Deploy target

**Self-hosted (homelab / VPS):**

```bash
npm run insforge:sync
cp deploy/insforge/.env.example deploy/insforge/.env
# edit secrets (JWT_SECRET, ENCRYPTION_KEY, ADMIN_*)
docker compose -f deploy/insforge/docker-compose.yml --env-file deploy/insforge/.env up -d
```

**Cloud:** [insforge.dev](https://insforge.dev), Railway, or InsForge one-click templates — use project `DATABASE_URL` in Cortex backend env.

### Phase 5 — Optional Prisma → InsForge data API

Only if you want agents/MCP to manage data without Express. Not required for Cortex UI.

## Environment variables (Cortex backend)

When InsForge Postgres is running locally:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/cortex
```

InsForge platform (for dashboard / storage / future auth):

```env
INSFORGE_API_URL=http://127.0.0.1:7130
INSFORGE_ACCESS_API_KEY=ik_...   # from deploy/insforge/.env ACCESS_API_KEY
```

## Data migration (existing local DB → InsForge)

1. Start InsForge stack (`npm run insforge:up`).
2. Apply schema: `cd backend && npx prisma migrate deploy` with new `DATABASE_URL`.
3. Copy data from old DB (if any):

```bash
# Example — adjust ports/names
pg_dump -h 127.0.0.1 -p 5432 -U postgres launchpad > cortex-backup.sql
# create empty cortex DB is done by compose; then:
psql -h 127.0.0.1 -p 5433 -U postgres -d cortex -f cortex-backup.sql
```

4. Verify with `npm run dev:backend`.

## Risks and decisions

| Risk | Mitigation |
|------|------------|
| InsForge Postgres init (RLS roles, `anon`, `authenticated`) | Harmless for Prisma superuser `postgres`; Prisma bypasses PostgREST |
| Port 5432 conflict | **Tailscale hub** uses **5432**; local-only `deploy/insforge/` defaults to **5433**. Root `docker-compose.yml` no longer ships a legacy Postgres service. |
| Two auth systems | Keep Cortex auth in Phase 1; document Phase 3 before switching |
| Railway still on old Postgres | Point Railway `DATABASE_URL` at managed InsForge or InsForge cloud project |

## MCP / agent workflow

After `insforge:up`, connect [InsForge MCP](http://localhost:7130) in Cursor for schema/docs/tools. Cortex app code can stay on Prisma until you deliberately move endpoints.

## References

- Repo: https://github.com/InsForge/InsForge
- Docs: https://insforge.dev/docs
- Cortex DB schema: `backend/prisma/schema.prisma`
- Railway notes: `docs/railway-deploy.md` (update `DATABASE_URL` when cutover completes)
