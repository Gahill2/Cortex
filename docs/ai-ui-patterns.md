# AI UI patterns (cloud-first, no local GPU required)

Primary reference: **[Odysseus](https://github.com/pewdiepie-archdaemon/odysseus)** — see [odysseus-patterns.md](./odysseus-patterns.md) for the full module map. Cortex reuses the workspace rail, presets, and cloud-provider model **without** running Odysseus Docker or Cookbook/GPU.

Also borrows suggestion chips from [Open WebUI](https://github.com/open-webui/open-webui). You use **cloud APIs** (Kimi, Claude, OpenAI) from `api.env`; Ollama is optional fallback only.

## What we took from Open WebUI

| Pattern | Open WebUI | Cortex |
|--------|------------|--------|
| Model picker | Header / sidebar selector | AI page **Model** dropdown + `AIProviderBanner` |
| Suggestion chips | `Suggestions.svelte` above composer | `GET /api/ai/suggestions` + chips on AI page |
| Workspace layout | Sidebar + main chat | `ai-workspace` grid: **Integrations** rail + chat |
| Cloud providers | OpenAI, Anthropic, etc. | `callAI` / `callAIWithProvider` — cloud first |
| No local model required | Can point at remote APIs only | Set `KIMI_API_KEY` / `ANTHROPIC_API_KEY` only |

## What we did **not** import

- Open WebUI Docker image or Python backend
- RAG / vector DB / local embedding servers
- Self-hosted model weights on the homelab box

## Configure cloud-only AI

In `deploy/homelab/env/api.env` (or `backend/.env`):

```bash
KIMI_API_KEY=sk-...
# and/or
ANTHROPIC_API_KEY=sk-ant-...
# optional
OPENAI_API_KEY=sk-...
```

Leave `OLLAMA_BASE_URL` unset if you do not run Ollama. Playlist, mail, and chat features still work via cloud routing in `backend/src/features/ai/ai-provider.ts`.

## Related Cortex surfaces

- **AI tab** — chat + suggestions + integration shortcuts
- **Spotify** — listening analytics dashboard + AI DJ (`/api/spotify/stats`, `/api/spotify/ai/*`)
- **Homelab** — service tiles (no AI compute on the server)

## Spotify Developer (catalog search)

Dev-mode Spotify apps often block **search** and **recommendations** (misleading `Invalid limit` error). Cortex uses **your top tracks / recent plays + cloud AI** instead. See quota notes in [Spotify Web API quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes).
