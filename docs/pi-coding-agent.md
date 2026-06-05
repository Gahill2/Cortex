# Pi coding agent + Cortex

Use [Pi](https://github.com/earendil-works/pi) ([pi.dev](https://pi.dev)) as a terminal coding agent on the Cortex repo. Pi reads this project's `AGENTS.md` / `CLAUDE.md` automatically and can call **Cortex MCP** tools when the adapter is installed.

## Install (once per machine)

From repo root:

```bash
npm run pi:install
```

Or manually:

```bash
npm install -g @earendil-works/pi-coding-agent
cd /path/to/Cortex
pi install npm:pi-mcp-adapter -l
cp .mcp.json.example .mcp.json
```

Restart any open `pi` session after install.

**Windows:** see Pi's [windows.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/windows.md). Prefer **Windows Terminal** (interactive). This repo sets Git Bash for tool shells in `.pi/settings.json` (`shellPath`).

**Cursor / agent shells:** `pi -p` / `npm run pi:task` often produce **no output** or hit **Node OOM** in constrained environments. Use `npm run pi:version` as a smoke test; do real work with `npm run pi` in Windows Terminal.

## Run on Cortex

Use the repo launcher (loads `backend/.env` API keys + ensures `.mcp.json`):

```bash
cd /path/to/Cortex
npm run pi
```

Or interactively after global install:

```bash
cd /path/to/Cortex
pi
```

**One-shot task** (non-interactive; read-only tools by default):

```powershell
npm run pi:task -- Summarize backend/src/routes/cortex

# Or pass any pi flags through the launcher:
npm run pi -- -p "Fix the canvas auth hook" --tools read,edit,bash,grep
```

Useful flags:

| Flag | Purpose |
|------|---------|
| `pi -c` | Continue last session for this directory |
| `pi -r` | Pick a past session |
| `pi --no-session` | Ephemeral (no save) |

Project prompts (type `/name` in Pi):

| Prompt | File |
|--------|------|
| `/cortex-review` | `.pi/prompts/cortex-review.md` |

Pi also loads vendored skill routing from `AGENTS.md` (same rules as Cursor for `/review`, `/investigate`, etc.—ask Pi to follow them).

**Project skill:** `/skill:cortex-dev` (`.pi/skills/cortex-dev/SKILL.md`) — repo layout, dev commands, common file paths.

**Extra system context:** `.pi/APPEND_SYSTEM.md` — stack and conventions appended every session.

## Auth (LLM)

Pi uses your provider subscription or API keys:

```bash
pi /login          # Claude, OpenAI, Copilot, …
export ANTHROPIC_API_KEY=sk-ant-...   # or reuse backend/.env key in your shell
```

Cortex `backend/.env` is **not** loaded by Pi automatically. Export keys in the shell or use `/login`.

## Cortex MCP in Pi

1. Start Cortex MCP (separate terminal):

   ```bash
   npm run dev:mcp
   ```

   Default: `http://127.0.0.1:3001/mcp` — see [cortex-mcp.md](./cortex-mcp.md).

2. Copy MCP config:

   ```bash
   cp .mcp.json.example .mcp.json
   ```

3. In Pi, run `/mcp` to confirm `cortex` connects.

**Tailscale (phone / other PC):** edit `.mcp.json`:

```json
{
  "mcpServers": {
    "cortex": {
      "url": "http://100.81.154.126:3001/mcp",
      "lifecycle": "lazy"
    }
  }
}
```

Use your hub's Tailscale IP or MagicDNS (`ghill`). MCP must run on that host with `CORTEX_MCP_MODE=tailscale` in `backend/.env` (already set on your dev machine).

## Shared database (InsForge hub)

When using the [Tailscale hub](./insforge-tailscale.md), Pi on any device still edits files locally; only **Postgres** is remote. Typical flow:

1. Hub runs `npm run hub:up` (Postgres + InsForge).
2. Laptop: `backend/.env` → `DATABASE_URL` at `ghill:5432`.
3. This machine: `pi` + `npm run dev:mcp` + `npm run dev:backend` (or API on hub).

## Optional: clone Pi source

To hack on Pi itself (not required to use it):

```bash
npm run pi:sync    # vendor/pi — gitignored
```

## Commands reference

| npm script | Action |
|------------|--------|
| `npm run pi:install` | Global `pi` CLI + project-local MCP adapter |
| `npm run pi` | Launch `pi` in repo root |
| `npm run pi:version` | Print installed Pi version (non-interactive smoke test) |
| `npm run pi:task` | One-shot `-p` via launcher (best in Windows Terminal, not Cursor agent) |
| `npm run pi:sync` | Shallow clone `earendil-works/pi` → `vendor/pi` |

## Links

- Pi repo: https://github.com/earendil-works/pi
- MCP adapter: https://github.com/nicobailon/pi-mcp-adapter
- Cortex MCP: [cortex-mcp.md](./cortex-mcp.md)
- InsForge + Tailscale: [insforge-tailscale.md](./insforge-tailscale.md)
