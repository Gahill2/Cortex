# OpenClaw + Cortex (terminal coding)

Use [OpenClaw](https://openclaws.io/) as a **coding agent in your terminal**: edit Cortex files, run `npm` / shell commands, and iterate in an interactive UI. Discord is optional — you do not need it.

## Quick start (your open terminal)

```powershell
cd C:\Users\greyh\Documents\GitHub\Cortex

# Once: point workspace at this repo + install gateway helper
npm run openclaw:setup

# Every session: interactive coding UI in THIS terminal
npm run openclaw:dev
```

`openclaw:dev` starts the Gateway in a **minimized** window if needed, then opens **`openclaw tui`** in your current shell. Type tasks there; the agent uses tools (bash, read/write files, etc.) against this repo.

Shorthand: `npm run openclaw` (same as `openclaw:dev`).

## What runs where

| Piece | Role |
|-------|------|
| **Gateway** (background, port 18789) | Keeps the agent runtime alive; TUI talks to it over WebSocket |
| **`openclaw tui`** (your terminal) | Chat UI — you type goals; agent runs commands and edits code |
| **Workspace** | `Cortex` repo root (`agents.defaults.workspace`) |

## Example prompts (in the TUI)

- *Improve Tasks & Calendar week grid in `frontend/src/styles-tasks-cal.css`, then run `npm run build` in `frontend/`.*
- *Fix homelab OTP login — check `backend/src/routes/cortex/auth.routes.ts` and `deploy/homelab/env/api.env`.*
- *Summarize `AGENTS.md` and list the npm scripts for local dev.*

Follow workflows in root **`AGENTS.md`** (review, investigate, ship) when you ask for those passes.

## Other npm scripts

| Script | Purpose |
|--------|---------|
| `npm run openclaw` / `openclaw:dev` | Interactive terminal UI (main workflow) |
| `npm run openclaw:setup` | Set workspace + gateway install + first start |
| `npm run openclaw:start` | Start gateway only (minimized) |
| `npm run openclaw:status` | Gateway + agent summary |
| `npm run openclaw:ask -- "…"` | One-shot via gateway (prints reply, exits) |
| `npm run openclaw:local -- "…"` | One-shot embedded (no gateway; good if gateway is down) |
| `npm run openclaw:claude` / `openclaw:claude:dev` | Same as `openclaw:dev`, but **Claude Code CLI** (Pro subscription) |
| `npm run openclaw:claude:ask -- "…"` | One-shot Claude via gateway |
| `npm run openclaw:claude:local -- "…"` | One-shot Claude embedded (no gateway) |

## Model: Kimi (default) vs Claude

**Default** (`npm run openclaw:dev`) uses **Kimi** from `backend/.env` (`KIMI_API_KEY` / `MOONSHOT_API_KEY`, `sk-kimi-*` → `kimi/kimi-code`).

**Claude** (`npm run openclaw:claude:dev`) uses **Claude Code CLI** with your **Pro login** (`claude auth login`). The Cortex script **unsets `ANTHROPIC_API_KEY`** so a depleted API key in `backend/.env` does not override subscription auth.

Prerequisites for Claude:

```powershell
npm install -g @anthropic-ai/claude-code
claude auth login   # once — uses Pro/Max, not backend/.env API key
npm run openclaw:claude:local -- "Reply with exactly: test"
```

On Windows, `scripts/openclaw-cortex.ps1` patches OpenClaw to spawn `node` + `claude-code/cli.js` (avoids `spawn claude ENOENT` from `.ps1`/`.cmd` shims).

Standalone Claude (no OpenClaw): run `claude` in the repo with `ANTHROPIC_API_KEY` unset, or use `npm run kimi` / Kimi OpenClaw for API-key workflows.

## Full UI revamp (Kimi + Claude + Pi)

See **[docs/ui-revamp-pipeline.md](./ui-revamp-pipeline.md)** — batch prompts, `npm run revamp:ui:*`, and **`npm run openclaw:revamp`** to coordinate from the TUI.

## Model (Ollama)

Your config uses **`ollama/kimi-k2.5:cloud`** at `http://127.0.0.1:11434`.

**`connection refused by the provider endpoint`** means Ollama was not running (or the model was missing).

Fix:

```powershell
# Start Ollama (or open "Ollama" from the Start menu)
ollama serve

# Pull the model OpenClaw expects (once)
ollama pull kimi-k2.5:cloud

npm run openclaw:dev
```

`npm run openclaw:dev` now tries to start Ollama and pull the configured model automatically.

Change model: `openclaw onboard` or `openclaw config set agents.defaults.model.primary ollama/llama3.2:latest`

## Discord (optional)

Discord/Clawbert can stay configured; OpenClaw does **not** require it for terminal development. To reduce noise, disable the channel in config or ignore it — use `npm run openclaw:dev` only.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| TUI cannot connect | `npm run openclaw:start` then retry `npm run openclaw:dev` |
| `Reachable: no` | Same as above |
| Agent edits wrong folder | `npm run openclaw:setup` |
| Ollama errors | Start Ollama; `ollama pull kimi-k2.5:cloud` |
| Prefer no background gateway | `npm run openclaw:local -- "your one-shot prompt"` |

## vs Cursor / Kimi / Pi

| Tool | Best for |
|------|----------|
| **OpenClaw TUI** | Long autonomous runs in a dedicated terminal; shell + file tools |
| **Cursor** | In-editor edits and review |
| **Kimi CLI** (`npm run kimi`) | Kimi K2.6 terminal agent |
| **Pi** (`npm run pi`) | Pi terminal agent + Cortex MCP |
