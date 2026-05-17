# Agentmemory + Obsidian in Cortex

Cortex integrates [agentmemory](https://github.com/rohitg00/agentmemory) for cross-session agent memory and indexes your local Obsidian vaults for unified search.

## Quick start (this machine)

1. In `backend/.env` set vault paths and a stable project name:

```env
OBSIDIAN_VAULT_PATHS=C:\Notes\Main;C:\Notes\Work
AGENTMEMORY_URL=http://127.0.0.1:3111
AGENTMEMORY_PROJECT=cortex
```

2. Start everything:

```bash
npm run dev:stack
```

Or run Cortex and agentmemory separately:

```bash
npm run dev:web
npm run dev:memory
```

3. Open Cortex → **Memory** tab. Search spans agentmemory + vault notes. Use the MCP JSON block for Cursor.

## Cross-system (laptop, desktop, server)

| Piece | What to align |
|--------|----------------|
| **Project** | Same `AGENTMEMORY_PROJECT` everywhere (e.g. `cortex`) so agents read/write one memory namespace. |
| **Vaults** | `OBSIDIAN_VAULT_PATHS` is per-machine (different drive letters). Sync vaults with Obsidian Sync, iCloud, or git — Cortex only reads local paths. |
| **Agentmemory API** | Default local `http://127.0.0.1:3111`. On a remote box, deploy agentmemory (see upstream `deploy/`) and set `AGENTMEMORY_URL` + `AGENTMEMORY_SECRET` on every client. |
| **Cursor MCP** | `npx -y @agentmemory/mcp` with `AGENTMEMORY_URL` in env (shown on Memory page). |

Optional: point agentmemory’s Obsidian export at a vault folder so session memory can mirror into notes (`OBSIDIAN_AUTO_EXPORT` in agentmemory’s own config — see upstream README).

## API (Cortex backend)

- `GET /api/memory/status` — health, vault list, MCP snippet
- `POST /api/memory/search` — `{ "q": "...", "limit": 12 }`
- `GET /api/wiki/search?q=` — also uses live vault scan when paths are set

## Firebase / cloud (optional)

For a shared remote memory store, host agentmemory on a VPS and set `AGENTMEMORY_URL` in each machine’s `.env` (or sync via your existing `FIRESTORE_ENV_DOC` pattern). Cortex does not duplicate agentmemory’s database; it proxies search when the service is up.
