# Launchpad MVP

Launchpad is a lightweight team project/task tracker SaaS MVP with org-scoped auth and project/task management.

## Stack
- Backend: Node.js, Express, TypeScript, Prisma, PostgreSQL, Zod, JWT.
- Frontend: React, TypeScript, Vite, React Router, Axios.
- Infra: Docker Compose for local PostgreSQL.

## Architecture and Specs
- Architecture: `docs/architecture.md`
- UI Architecture: `docs/ui-architecture.md`
- API Spec (OpenAPI): `docs/api-spec.yaml`

## File Structure
```text
.
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   ├── config/
│   │   ├── db/
│   │   ├── middleware/
│   │   ├── routes/v1/
│   │   ├── tests/
│   │   └── utils/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   └── types.ts
│   └── package.json
├── docs/
│   ├── api-spec.yaml
│   ├── architecture.md
│   └── ui-architecture.md
└── docker-compose.yml
```

## Setup
1. Start PostgreSQL:
   - `docker compose up -d`
2. Configure backend env:
   - Copy `backend/.env.example` to `backend/.env`
3. Install dependencies:
   - `npm install --prefix backend`
   - `npm install --prefix frontend`
   - `npm install --prefix apps/desktop`
4. Generate Prisma client + migrate + seed:
   - `cd backend`
   - `npm run prisma:generate`
   - `npm run prisma:migrate -- --name init`
   - `npm run prisma:seed`
5. Start full stack (backend + frontend + desktop):
   - From repo root: `npm run dev`

## Scripts
Root:
- `npm run dev` or `npm run dev:stack`: runs backend + frontend + desktop together
- `npm run dev:backend`: backend only
- `npm run dev:frontend`: frontend only
- `npm run dev:desktop`: desktop (Tauri) only

Backend:
- `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`

Frontend:
- `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`

## Troubleshooting Local Startup
- `npm run dev` fails with `'tauri' is not recognized`:
  - Run `npm install --prefix apps/desktop` to install desktop dev dependencies.
- Backend errors on startup with DB connection/Prisma issues:
  - Ensure PostgreSQL is running: `docker compose up -d`
  - Ensure `backend/.env` exists and has a valid `DATABASE_URL`
  - Re-run backend Prisma setup commands in Setup step 4.
- Frontend cannot reach API:
  - Confirm backend is running and listening on expected host/port.
- Desktop dev fails due to missing Rust toolchain:
  - Install Rust from [https://www.rust-lang.org/tools/install](https://www.rust-lang.org/tools/install), then retry.

## Default Seed Credentials
- Email: `owner@acme.dev`
- Password: `Password123!`
