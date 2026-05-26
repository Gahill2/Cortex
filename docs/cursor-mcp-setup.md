# Cursor MCP setup (recommended stack)

Copy the example config to your **global** Cursor MCP file so every project gets these tools:

```powershell
Copy-Item cursor-mcp.json.example "$env:USERPROFILE\.cursor\mcp.json"
```

Or merge entries into **Settings → Cursor Settings → Tools & MCP → Edit config** (`~/.cursor/mcp.json` on Windows: `C:\Users\<you>\.cursor\mcp.json`).

After changes: **restart Cursor**, then open **Tools & MCP** and enable each server. HTTP servers (Notion, Supabase) will open a browser login the first time.

## What each server does

| Server | Why keep it | Auth / notes |
|--------|-------------|--------------|
| **context7** | Up-to-date library docs (avoids stale training examples) | Optional free API key at [context7.com](https://context7.com) → set `CONTEXT7_API_KEY` |
| **shadcn** | Add/registry-aware shadcn/ui components | Run `npx shadcn@latest init` in a project that uses shadcn first |
| **docker** | Container/images/volumes from the agent | Docker Desktop running; Windows uses `//./pipe/docker_engine` |
| **MCP_DOCKER** | Docker **MCP Toolkit** gateway — only loads tools you enable in a profile | Docker Desktop 4.62+ → Extensions → **Docker MCP Toolkit** → pick servers → connect **Cursor** in Clients tab. Remove the `docker` npx entry if you use only this. |
| **supabase** | DB schema, SQL, migrations, project tools | OAuth via browser on first use; optional `?read_only=true` or `?project_ref=...` on URL |
| **notion** | Pages, tasks, databases from chat | OAuth; **or** use the built-in **Notion** Cursor plugin — don’t enable both |
| **google-maps** | Places, directions, geocoding (community server) | [Google Cloud API key](https://console.cloud.google.com/) with Maps APIs → `GOOGLE_MAPS_API_KEY` |
| **google-maps-grounding** | Official Google Maps Grounding Lite (places, routes, weather) | Same API key in header `X-Goog-Api-Key` |
| **cortex** | Cortex hub tools (tasks, status) when dev stack is up | `npm run dev:mcp` in this repo; see [cortex-mcp.md](./cortex-mcp.md) |

## Already installed via Cursor plugins

You may already have MCP from **plugins** (separate from `mcp.json`):

- **Notion** — `plugin-notion-workspace-notion`
- **Firebase** — `firebase` via `npx firebase-tools mcp` (plugin)
- **Vercel, Figma, Linear, Slack, Convex, Azure, Appwrite**, etc.

Plugins and `mcp.json` can coexist. If a tool appears twice, disable the duplicate in **Tools & MCP**.

## Environment variables (Windows)

Set user env vars so Cursor can substitute `${env:NAME}`:

```powershell
[System.Environment]::SetEnvironmentVariable("CONTEXT7_API_KEY", "your-key", "User")
[System.Environment]::SetEnvironmentVariable("GOOGLE_MAPS_API_KEY", "your-key", "User")
```

Restart Cursor after setting env vars.

## Supabase (scoped / read-only)

```json
"supabase": {
  "url": "https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF&read_only=true"
}
```

Generate a tailored URL from the Supabase dashboard: **Connect → MCP**.

## Context7 without a key

Remove the `env` block under `context7` in `mcp.json`; the free tier may work with rate limits.

## shadcn in this repo

Cortex does not ship a root `components.json`. The shadcn MCP is still useful when you work on shadcn-based frontends; run `npx shadcn@latest mcp init --client cursor` inside that project.

## Google Cloud (BigQuery, etc.)

Google hosts additional **remote** MCP endpoints (BigQuery, Maps Code Assist, etc.). See [google/mcp](https://github.com/google/mcp) and [supported products](https://cloud.google.com/mcp/supported-products). Add each as an HTTP server with the URL and headers Google documents for that product.

## Project-only MCP

For Cortex MCP only in this repo, use `.cursor/mcp.json` (gitignored) with just the `cortex` entry from `cursor-mcp.json.example`, or use `.mcp.json.example` for **Pi CLI** (different path).

## Troubleshooting

- **Server shows red / failed** — Toggle off/on; check Node/npx on PATH; for `uvx`, install [uv](https://docs.astral.sh/uv/).
- **Docker MCP Toolkit** — `docker mcp gateway run` only works after enabling the toolkit in Docker Desktop and adding servers to a profile.
- **Supabase / Notion** — Complete OAuth in the browser; restart Cursor if tools stay empty.
- **Heavy tool list** — Prefer **MCP_DOCKER profiles** or disable unused servers in Tools & MCP.
