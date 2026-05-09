# Supabase Local Setup (MVP Data Layer)

This setup defines the implementation-ready MVP data layer from `cortex-spec.md` for immediate integration.

## Scope

Migrations currently cover only the tables needed now:

- `profiles`
- `app_shortcuts`
- `file_activity`
- `ai_conversations`
- `ai_messages`
- `user_settings`

## Prerequisites

- Docker Desktop running
- Supabase CLI installed (`npm i -g supabase`)
- Repo root as working directory

## Local Dev Bootstrap

1. Start local Supabase stack:
   - `supabase start`
2. Confirm local DB URL and API keys from CLI output.
3. Copy/update `backend/.env.example` values into local env files as needed.
4. Apply migrations in order:
   - `001_initial_schema.sql`
   - `002_rls_baseline.sql`

If using CLI migration flow:

- `supabase db reset`

This reapplies migrations in filename order from `supabase/migrations`.

If applying manually (for targeted testing):

- run `supabase/migrations/001_initial_schema.sql`
- then run `supabase/migrations/002_rls_baseline.sql`

## Why Order Matters

- `001` creates tables, constraints, indexes, and shared timestamp trigger function.
- `002` enables and enforces RLS, then applies least-privilege grants + owner-only policies.

Applying `002` before `001` will fail because table objects do not exist.

## Verification Checklist

- `profiles`, `app_shortcuts`, `file_activity`, `ai_conversations`, `ai_messages`, `user_settings` exist.
- RLS is enabled and forced on all six tables.
- Authenticated users can only access rows they own.
- `anon` has no table access to these six tables.

## Notes

- Migrations are additive and scoped to new Supabase artifacts, so they should not break currently running app surfaces.
- Keep all future table additions paired with RLS policies in the same migration set.
