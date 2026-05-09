# Launchpad MVP Architecture

## High-Level Architecture
- **Frontend**: React + Vite SPA for auth, dashboard, projects, and tasks views.
- **Backend**: Express TypeScript API under `/api/v1` with modular route organization.
- **Data**: PostgreSQL with Prisma ORM and migration support.
- **Auth**: JWT access tokens with org-scoped authorization checks in middleware/routes.

## Scalability Choices
- API versioning (`/api/v1`) enables additive non-breaking evolution.
- Prisma schema models tenant ownership (`organizationId`) on project/task for multi-tenant safety.
- Layered backend modules (config, middleware, routes, db, utils) reduce coupling.
- Stateless JWT auth keeps horizontal scaling straightforward.
- Zod validation centralizes request contracts and reduces runtime inconsistency.

## Key Flows
1. **Register**
   - `POST /auth/register` creates organization + first user in one transaction-like create.
   - Returns JWT and user profile.
2. **Login**
   - `POST /auth/login` validates bcrypt password and returns JWT.
3. **Project CRUD**
   - Authenticated routes validate org ownership and return org-scoped results.
4. **Task Lifecycle**
   - Task creation requires project in same org.
   - Task status updates via `PATCH /tasks/:taskId`.
5. **Dashboard**
   - Aggregates counts with scoped `count` queries for fast summary widgets.
