# Cortex MCP (Cortex Link)

For **Cursor IDE** MCP servers (Context7, Docker, shadcn, Supabase, Notion, Google Maps, etc.), see [cursor-mcp-setup.md](./cursor-mcp-setup.md).

Personal Streamable HTTP MCP server for automation workflows. Runs **next to** the main Cortex API (default API `4000`, MCP default `3001`).

## Local (this PC only)

1. From repo root: `npm install` (once).
2. `cd backend` and ensure `backend/.env` has at least `JWT_SECRET` (same as API) if you load shared env — MCP entry uses `dotenv/config`.
3. Start MCP:

```bash
cd backend
npm run mcp:dev
```

4. Health: `GET http://127.0.0.1:3001/health`
5. MCP endpoint: `POST http://127.0.0.1:3001/mcp` (Streamable HTTP client)

## Phone + Tailscale (on the go)

1. Install [Tailscale](https://tailscale.com/) on the **PC** and **phone**; use the **same tailnet**.
2. On the PC, run `tailscale ip -4` and note the `100.x.x.x` address.
3. In `backend/.env` set:

```env
CORTEX_MCP_MODE=tailscale
CORTEX_MCP_HOST=0.0.0.0
CORTEX_MCP_PORT=3001
```

Defaults (already safe for typical Tailscale use):

- `CORTEX_MCP_ALLOW_TAILSCALE_CIDR=1` — accept `Host` headers for IPv4 in Tailscale’s `100.64.0.0/10` range so you don’t list every device IP.
- `CORTEX_MCP_ALLOW_TAILSCALE_NAMES=1` — allow MagicDNS names (`*.ts.net`, `*.tailscale.net`).
- `CORTEX_MCP_STRICT_CORS=0` — allow browser `fetch` to `/health` from other Tailscale devices (e.g. opening the Cortex UI from your phone). Set to `1` and list exact origins in `CORTEX_MCP_CORS_ORIGINS` if you want to lock this down.

4. If you open the **Cortex web UI** from the phone using `http://<PC-100.x>:5173`, the dev frontend calls the API on the **same host** (`http://<PC-100.x>:4000/api`) so login and OTP reach your PC. Ensure the main API is running on the PC (`npm run dev` in `backend` or your usual command) and Windows Firewall allows TCP **4000** from the tailnet if needed. For strict MCP CORS only, add that UI URL to `CORTEX_FRONTEND_URL` or `CORTEX_MCP_CORS_ORIGINS`.

5. **Browser storage is per URL.** `http://localhost:5173` and `http://<PC-100.x>:5173` do not share login or `localStorage` (theme, widget layout). Sign in again on the Tailscale URL with the **same email** to use the same server-side account. The **Electron** desktop build is a separate client with its own session.

6. Restart MCP: `npm run mcp:dev`.

7. On the phone, configure your MCP client with:

`http://<PC-TAILSCALE-IP>:3001/mcp`

**Do not** add router port forwarding. **Do not** expose this port to the public internet. Rely on Tailscale ACLs for who can reach the PC.

### Windows firewall

If health checks fail from the phone but work on the PC, allow **Node** (or your terminal) on **Private** networks for the MCP port.

## Production build

```bash
cd backend
npm run build
npm run mcp:start
```

## Starter tools

| Tool | Purpose |
|------|--------|
| `get_cortex_status` | Read-only status JSON |
| `create_task_note` | Append to `backend/data/mcp-task-notes.json` |
| `recommend_music_seed` | Mock tracks only |
| `draft_email_template` | Draft text only — no send |
| `list_available_cortex_tools` | Tool catalog |

See `backend/src/mcp/` to add more tools later (email, Spotify, tasks API, etc.).
