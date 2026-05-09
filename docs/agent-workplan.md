# Cortex Parallel Agent Workplan

## Goal

Deliver a production-grade Phase 1 baseline quickly, then expand through later phases without breaking security rules.

## Agent Topology

### Agent 1: Platform Shell (Tauri)
- Create `apps/desktop` Tauri workspace.
- Implement overlay behavior (always-on-bottom, no decorations, work area sizing).
- Add autostart + secure store plugins.
- Expose commands for lock trigger and system integrations.

### Agent 2: Auth + Security API
- Build `/api/auth/*` handlers with zod validation.
- Add per-route rate limit middleware (swap in Upstash adapter).
- Enforce auth middleware and error boundary envelope.
- Add idle-lock endpoint + session state transitions.

### Agent 3: Data + Supabase
- Add SQL migrations from spec (`001`, `002`, `003`).
- Verify RLS policies exist before module writes.
- Add typed repository layer for profile/settings/session reads.

### Agent 4: Shell UI
- Build lock screen, login screen, and empty home grid shell.
- Add dark neon theme tokens and motion presets.
- Add idle detector that calls lock endpoint at 5 minutes.

### Agent 5: Quality Gate
- Add integration tests for auth/rate limits.
- Add lint/typecheck/build checks.
- Add `.env.example` parity checks for required secrets.

## Coordination Rules

- Every new route ships with: zod schema + rate limit + auth policy.
- No UI module merges unless lock screen auth flow still passes.
- Any data table merge requires matching RLS migration in same PR.
- Keep changes small and branch by domain for reviewability.
