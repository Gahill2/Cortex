# Dev RAM guide (16GB machines)

Cortex can run comfortably on 16GB if you avoid stacking heavy processes.

## Default: lite dev

```bash
npm run dev
```

Lite mode (default unless `CORTEX_DEV_FULL=1`):

- Skips **Prisma migrate** on every backend restart (run `npm run db:migrate` after schema changes).
- Vite skips pre-bundling **simple-icons** (saves a large dependency scan).
- Starts backend + frontend without the extra `concurrently` parent process.

**Typical RAM:** ~400–800MB for API + Vite (plus Postgres if you use the hub).

## Full dev (migrations every backend start)

```bash
$env:CORTEX_DEV_FULL="1"; npm run dev   # PowerShell
CORTEX_DEV_FULL=1 npm run dev           # bash
```

## Run only what you need

| Goal | Command |
|------|---------|
| API only | `npm run dev:backend` or `npm run dev:backend:lite` |
| UI only (API already up) | `npm run dev:frontend` |
| Open Chrome to running UI | `npm run open` |

## Avoid stacking these together

- `npm run dev` **and** `npm run server:up` (both use API port **4000**)
- `npm run dev:desktop` (Electron **and** Chrome ≈ two shells)
- `npm run hub:up` / InsForge Docker (Postgres + more) unless you need the hub DB
- `npm run dev:stack` (adds AgentMemory)
- `npm run dev:mcp` unless testing MCP

**Cursor MCP (global):** copy `cursor-mcp.json.example` to `%USERPROFILE%\.cursor\mcp.json` and restart Cursor — see [cursor-mcp-setup.md](./cursor-mcp-setup.md).
- Root `docker compose up` n8n unless you use n8n

## Docker as local server (this PC)

Use **`npm run server:up`** when this machine should behave like production (Postgres + API + UI in Docker). See [local-server-docker.md](./local-server-docker.md).

Before switching between Docker server and `npm run dev`:

```powershell
npm run cleanup:processes
npm run server:status    # when using Docker server mode
```

## Do not use Cursor Simple Browser

Opening Cortex (especially **Tasks & Calendar** or the home canvas) in **Cursor’s built-in Simple Browser / port preview** can freeze or crash the IDE.

- Use **Google Chrome** instead: `npm run open` after `npm run dev`, or paste the Vite URL into Chrome yourself.
- Repo `.vscode/settings.json` sets port **5173** to **notify** only (no auto-preview).
- If Cursor still opens a preview tab, close it and use Chrome; you can set `CORTEX_OPEN_BROWSER=0` and open the URL manually.

## Environment toggles

| Variable | Effect |
|----------|--------|
| `CORTEX_DEV_FULL=1` | Prisma on each backend start + full Vite pre-bundle |
| `CORTEX_SKIP_PRISMA_DEPLOY=1` | Backend skips migrate (lite sets this) |
| `CORTEX_VITE_LITE=1` | Lighter Vite (`npm run dev:frontend:lite`) |
| `CORTEX_OPEN_BROWSER=0` | Do not auto-open Chrome |
| `OBSIDIAN_VAULT_PATH=` | **Empty** — disables vault file watcher noise. For Grey Hill Brain: `C:\Users\greyh\Documents\GitHub\greyhill_brain` |
| `CORTEX_SKIP_ELECTRON_POSTINSTALL=1` | Faster/lighter `npm install` (web-only) |

## After `git pull` with schema changes

```bash
npm run db:migrate
npm run dev
```
