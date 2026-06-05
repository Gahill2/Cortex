---
name: cortex-dev
description: Implement and debug features in the Cortex monorepo (Express, Prisma, React, Tailscale hub, InsForge). Use when editing Cortex app code, APIs, canvas, auth, or deploy configs.
---

# Cortex development

## When to use

User asks to build, fix, or refactor anything in this repository.

## Workflow

1. Read `AGENTS.md` for skill routing (review, investigate, QA, ship).
2. Identify layer: frontend (`frontend/src`), backend (`backend/src`), prisma, deploy, docs.
3. Run focused checks after edits:
   - `npm run typecheck` in `frontend/` when TS/React changed
   - `npm --prefix backend run lint` when backend changed
4. Never commit secrets or edit `backend/.env` in git.

## Common tasks

| Task | Where to look |
|------|----------------|
| API route | `backend/src/routes/cortex/*.routes.ts`, register in `routes/cortex/index.ts` |
| Page / UI | `frontend/src/pages/`, shared components in `frontend/src/components/` |
| Canvas | `frontend/src/components/canvas/`, `frontend/src/lib/canvasState.ts` |
| Settings sync | `frontend/src/hooks/useServerSettings.ts`, `backend` settings routes |
| Auth / JWT | `backend/src/routes/cortex/auth.*`, `frontend/src/context/AuthContext.tsx` |
| Tailscale dev | `docs/insforge-tailscale.md`, `backend/.env.tailscale.example` |

## Database

- Prisma schema: `backend/prisma/schema.prisma`
- Migrations: `npm run db:migrate` from repo root
- Shared DB on hub: `DATABASE_URL` points at Tailscale host (`ghill` / `100.81.154.126`), database `launchpad`

## Quality bar

- Surgical changes only.
- Preserve OAuth redirect URLs when changing API host.
- If touching auth context, verify canvas/settings hooks still resolve session token.
