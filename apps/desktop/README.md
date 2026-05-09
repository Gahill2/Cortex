# Desktop Shell (Tauri v2)

This app is the native desktop host for Cortex. It should stay a safe desktop layer while the shell evolves in frontend/backend.

## Wiring model

- Dev frontend URL is configured in `src-tauri/tauri.conf.json` as `http://localhost:5173`.
- Desktop production bundle reads static assets from `../../../frontend/dist`.
- Backend runs independently (default from `backend`), and frontend calls it directly.
- Desktop host intentionally avoids risky OS hacks; host-level hooks are feature-flagged for controlled rollout.

## NPM scripts

Run from `apps/desktop`:

- `npm run dev:backend` - runs backend in watch mode from `../../backend`.
- `npm run dev:frontend` - runs Vite frontend from `../../frontend`.
- `npm run dev:desktop` - runs Tauri desktop host.
- `npm run dev:full` - runs backend + frontend + desktop together (uses `concurrently`).
- `npm run build` - builds frontend first, then builds Tauri bundle.
- `npm run build:frontend` - builds web shell only.
- `npm run build:desktop` - runs `tauri build`.
- `npm run check:rust` - runs `cargo check` for host code.

## Full-stack runbook

1. Install dependencies:
   - Repo root: install `frontend` and `backend` deps if needed.
   - `apps/desktop`: `npm install`
2. Start backend first:
   - `npm run dev:backend`
3. Start frontend second (wait for Vite URL):
   - `npm run dev:frontend`
4. Start desktop host last:
   - `npm run dev:desktop`
5. Optional single-command startup:
   - `npm run dev:full`

Expected order matters: desktop points at the Vite dev server; if frontend is down, desktop webview will fail to load the shell.

## Host extension hooks

`src-tauri/src/main.rs` provides command hooks for future shell orchestration:

- `set_overlay_mode(enabled, reason)` - placeholder for overlay/window mode integration.
- `signal_idle_lock(locked, source)` - placeholder for idle lock propagation.

These hooks are disabled by default and can be enabled with:

- `CORTEX_DESKTOP_OVERLAY=1`
- `CORTEX_IDLE_LOCK_SIGNALING=1`

When disabled, the commands fail fast with a clear error instead of performing undefined behavior.

## Troubleshooting

- Desktop opens blank window:
  - Confirm frontend is running on `http://localhost:5173`.
  - Verify `tauri.conf.json` `build.devUrl` matches the active Vite URL.
- Desktop cannot reach API:
  - Confirm backend is running and frontend API base URL points to backend.
- `tauri build` fails after frontend changes:
  - Run `npm run build:frontend` and ensure `frontend/dist` exists.
- Rust host compile check:
  - Run `npm run check:rust` (or `cargo check --manifest-path src-tauri/Cargo.toml`).
