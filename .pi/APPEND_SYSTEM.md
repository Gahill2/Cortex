# Cortex (this repo)

You are working in **Cortex** — personal command layer (React/Vite frontend, Express/Prisma backend, optional Electron).

## Layout

| Area | Path |
|------|------|
| Frontend | `frontend/src/` (pages, components, `api/client.ts`) |
| Backend API | `backend/src/` (routes under `routes/cortex/`) |
| Database | `backend/prisma/schema.prisma` |
| MCP server | `backend/src/mcp/` — `npm run dev:mcp` → `:3001/mcp` |
| Homelab deploy | `deploy/homelab/`, `deploy/tailscale-hub/` |
| InsForge hub | `docs/insforge-tailscale.md` — shared Postgres over Tailscale |
| Agent rules | `AGENTS.md`, `CLAUDE.md` |

## Dev commands (repo root)

```bash
npm run hub:up           # Postgres + InsForge on hub (:5432, :7130) — start before dev if hub not running
npm run dev:web          # API :4000 + Vite :5173
npm run dev:mcp          # Cortex MCP :3001
npm run db:migrate       # Prisma migrate (needs DATABASE_URL)
docker compose up -d n8n # optional automation only (no Postgres in root compose)
```

## Conventions

- TypeScript strict; match existing patterns in the file you edit.
- Minimal diffs — no unrelated refactors.
- Auth: `frontend/src/context/AuthContext.tsx` + `localStorage` keys in `api/client.ts`. Some components use `useCortexSessionToken` when outside `AuthProvider`.
- Do not commit `.env`, `backend/.env`, or secrets.
- Follow skill routing in `AGENTS.md` when the user asks for review, QA, investigate, or ship workflows.

## MCP

If `cortex` MCP is configured (`.mcp.json`), use it for read-only status and task notes — not for sending mail or destructive actions unless the user explicitly asks.
