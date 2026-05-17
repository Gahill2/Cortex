# Self-hosted n8n + Cortex

Cortex is the dashboard/API. **n8n** (self-hosted) runs workflows: Spotify/Gmail → transform → Notion/Firestore/Slack, etc.

## Architecture

```
┌─────────────────┐     POST webhook      ┌──────────────────┐
│  Cortex API     │ ────────────────────► │  n8n (Docker)    │
│  :4000          │                       │  :5678           │
└────────▲────────┘                       └────────┬─────────┘
         │                                          │
         │  HTTP Request (JWT)                      │ integrations
         └──────────────────────────────────────────┘
              host.docker.internal:4000 (from container)
```

## 1. Start self-hosted n8n (Docker)

From the repo root (requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) on Windows):

**Prerequisite:** Docker Desktop must be **installed and running** (whale icon in the system tray). If you see `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`, start Docker Desktop and wait until it says “Engine running”, then retry.

```powershell
docker compose up -d n8n
```

- **Editor UI:** http://localhost:5678  
- Data persists in Docker volume `cortex_n8n_data`.

First visit: create your n8n owner account (local only).

### Tailscale (access n8n from other devices)

1. Find this PC’s Tailscale IP: `tailscale ip -4` (e.g. `100.x.x.x`).
2. Before starting n8n, set in `docker-compose.yml` under `n8n.environment`:

   ```yaml
   - WEBHOOK_URL=http://100.x.x.x:5678/
   ```

   Replace with your real Tailscale IP. Restart: `docker compose up -d n8n`.

3. Open n8n from another device: `http://100.x.x.x:5678`
4. Allow **Windows Firewall** inbound **5678** on private/Tailscale profile if needed.

## 2. Webhook workflow in n8n

1. New workflow → **Webhook** trigger → method **POST**.
2. **Activate** the workflow.
3. Copy the **Production** webhook URL, e.g.  
   `http://localhost:5678/webhook/cortex-events`  
   or `http://100.x.x.x:5678/webhook/cortex-events` when using Tailscale.

## 3. Configure Cortex (`backend/.env`)

```env
# Same machine as Docker — Cortex on host, n8n in container
N8N_WEBHOOK_URL=http://localhost:5678/webhook/cortex-events
N8N_WEBHOOK_SECRET=

# Optional: used in docs / future — base URL for n8n workflows calling Cortex
CORTEX_API_URL=http://host.docker.internal:4000/api
```

If Cortex runs on another machine, use that host’s Tailscale IP instead of `localhost`.

Push to Firestore (optional):

```powershell
cd backend
npm run sync:env:push
```

Restart Cortex: `npm run dev`.

## 4. n8n → Cortex (HTTP Request node)

Inside n8n (Docker), the host is **not** `localhost` for Cortex — use:

| Cortex location | URL base in n8n |
|-----------------|-----------------|
| API on same PC as Docker | `http://host.docker.internal:4000/api` |
| API on another Tailscale machine | `http://100.x.x.x:4000/api` |

**Auth:** add a workflow that logs in once and stores the token, or use n8n **Credentials** → Header Auth:

1. **POST** `http://host.docker.internal:4000/api/auth/login`  
   Body: `{ "email": "...", "password": "..." }` (demo user from env)
2. Use `{{ $json.token }}` as `Authorization: Bearer ...` on later nodes.

**Example nodes:**

- `GET /health`
- `GET /spotify/now-playing`
- `GET /gmail/inbox`
- `GET /tasks`
- `POST /ai/chat` with `{ "message": "..." }`

## 5. Cortex → n8n

```http
POST http://localhost:4000/api/n8n/trigger
Authorization: Bearer <cortex_token>
Content-Type: application/json

{
  "event": "dashboard.refresh",
  "data": { "module": "spotify" }
}
```

Check: `GET http://localhost:4000/api/n8n/status` → `{ "configured": true }`.

## 6. Example workflows

| Goal | Flow |
|------|------|
| Spotify → Notion | Schedule → HTTP Cortex `/spotify/now-playing` → Notion |
| Gmail digest | Schedule → `/gmail/inbox` → filter → email/Slack |
| Env on new PC | Manual → Firestore or `sync:env:pull` on machine |
| Event-driven | Cortex `/n8n/trigger` → switch on `event` field |

## 7. Production notes

- Put **basic auth** or Tailscale-only access in front of n8n; do not expose `:5678` to the public internet without auth.
- Back up volume `cortex_n8n_data` (workflows + credentials).
- n8n cloud is **not** required when self-hosting.

## 8. Troubleshooting

| Issue | Fix |
|-------|-----|
| Webhook URL shows `localhost` from other devices | Set `WEBHOOK_URL` to Tailscale IP in `docker-compose.yml` |
| n8n cannot reach Cortex | Use `host.docker.internal:4000`, not `localhost:4000` |
| Cortex cannot reach n8n | Use `http://localhost:5678/webhook/...` from host |
| `n8n_configured: false` | Set `N8N_WEBHOOK_URL` in `.env` and restart backend |
