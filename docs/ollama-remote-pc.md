# Ollama on your gaming PC (remote) + Cortex auto-detect

Run the LLM on a **Windows/Linux PC with a GPU**. Cortex homelab **calls it over Tailscale** when the PC is on. When it's off, the AI page **prompts you** to use cloud models or retry.

## Setup

### 1. On your gaming PC

1. Install [Ollama](https://ollama.com) and pull a model, e.g. `ollama pull gemma4:12b`
2. Install **Tailscale** and sign in to the same tailnet as the homelab
3. Note the PC's Tailscale IP (e.g. `100.x.x.x`) or MagicDNS name
4. Keep Ollama on `http://127.0.0.1:11434` — do **not** expose port 11434 on the public internet
5. Allow Tailscale to reach port 11434 (Windows Firewall: allow Tailscale adapter)

### 2. On the homelab (Cortex API)

Edit `deploy/homelab/env/api.env`:

```env
OLLAMA_BASE_URL=http://100.x.x.x:11434
OLLAMA_MODEL=gemma4:12b
OLLAMA_PC_NAME=Grey PC
OLLAMA_CHECK_MS=30000
```

- `OLLAMA_BASE_URL` — Tailscale address of the **PC**, not the homelab
- `OLLAMA_PC_NAME` — label in the AI model dropdown and offline prompt
- `OLLAMA_CHECK_MS` — how often Cortex re-probes (default 30s)

Redeploy API (no sudo):

```bash
npm run server:deploy
```

### 3. Cloud fallback (already configured)

Keep `ANTHROPIC_API_KEY`, `KIMI_API_KEY`, etc. in `api.env`. When the PC is offline, Cortex uses cloud models after you confirm in the dialog.

## Behaviour in Cortex → AI

| PC state | What happens |
|----------|----------------|
| **On**, Ollama up | Model dropdown shows **Grey PC** (or your `OLLAMA_PC_NAME`) · model name |
| **Off** or unreachable | Option shows **offline**; yellow banner; sending a message opens a dialog |
| Dialog | **Use cloud** (Claude/Kimi/etc.) · **Check again** · **Cancel** |

Status is polled every **30 seconds** on the AI page. Force refresh: `POST /api/ai/ollama/refresh`.

## Security

- Restrict port 11434 to **Tailscale** only (ACLs in Tailscale admin)
- Ollama has no auth — anyone on the tailnet who can reach the port can use the GPU

## SSH

SSH is for admin on the PC, not for chat. Inference uses HTTP to Ollama.
