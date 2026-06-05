# Odysseus → Cortex (patterns only)

Reference: [pewdiepie-archdaemon/odysseus](https://github.com/pewdiepie-archdaemon/odysseus) — self-hosted AI workspace (MIT). Cortex **does not** run the Odysseus Docker stack; we reuse **UI structure** and **cloud-provider** ideas inside the existing Cortex app.

## What you wanted (no homelab GPU)

| Odysseus feature | Needs local GPU? | Cortex equivalent |
|------------------|------------------|-------------------|
| **Chat** with API providers | No | **AI** tab — Kimi / Claude / OpenAI via `api.env` |
| **Agent** + MCP | Optional | Cortex MCP + OpenClaw (`docs/openclaw-cortex.md`) |
| **Cookbook** (download/serve models) | Yes | **Skip** — use cloud APIs instead |
| **Deep Research** | Uses search + LLM | Future; homelab has SearXNG optional |
| **Email** AI triage | No | **Mail** tab |
| **Notes & Tasks** | No | **Notes**, **Tasks**, **Calendar** |
| **Calendar** CalDAV | No | **Calendar** + Google sync |
| **Memory / Skills** | Embeddings local | Obsidian log + task-observer skills |
| **Compare** models | No | Pick model on AI page (manual) |
| **Documents** editor | No | Obsidian + Cloud |

## Cloud-only setup (like Odysseus “OpenRouter / OpenAI” path)

Odysseus lets you add **remote API endpoints** in Settings without running vLLM/Ollama locally. Same idea in Cortex:

```bash
# deploy/homelab/env/api.env
KIMI_API_KEY=...
ANTHROPIC_API_KEY=...
# optional
OPENAI_API_KEY=...
```

Do **not** set `OLLAMA_BASE_URL` unless you later add a GPU box. Chat, Spotify AI DJ, and mail AI all route through `backend/src/features/ai/ai-provider.ts` (cloud first).

## UI patterns ported into Cortex

| Odysseus | Cortex file |
|----------|-------------|
| Icon rail + module sections | `frontend/src/components/ai/AIWorkspaceSidebar.tsx` |
| Suggestion chips above composer | `AISuggestionChips` + `GET /api/ai/suggestions` |
| Character / prompt presets | `backend/src/features/ai/ai-presets.ts` + `GET /api/ai/presets` |
| Model selector | AI page header + `AIProviderBanner` |
| Sidebar + main panel | `ai-workspace` grid on **AI** page |

## Module map (icon rail)

| Odysseus rail | Cortex tab |
|---------------|------------|
| Chat | AI |
| Email | Mail |
| Tasks / Notes | Tasks / Notes |
| Calendar | Calendar |
| Cookbook | — (use Settings API keys, not local serve) |
| Memory | Obsidian + agent memory skills |
| Settings | Settings |
| — | Spotify, Homelab, Cloud (Cortex-specific) |

## Running full Odysseus separately (optional)

If you ever want the **full** Odysseus app on another machine with a GPU:

```bash
git clone https://github.com/pewdiepie-archdaemon/odysseus.git
cd odysseus
cp .env.example .env
docker compose up -d --build
# http://127.0.0.1:7000
```

That is independent of Cortex. For your current homelab, the integrated Cortex UI is the intended path.

## Spotify note

Odysseus does not include Spotify. Cortex **Spotify** tab adds listening analytics + AI DJ on top of the same cloud-AI layer. Spotify Developer **extended quota** is still required for catalog search; see `docs/ai-ui-patterns.md`.

## Related docs

- [ai-ui-patterns.md](./ai-ui-patterns.md) — cloud AI + suggestion chips
- [openclaw-cortex.md](./openclaw-cortex.md) — terminal agent
- [homelab-auto-deploy.md](./homelab-auto-deploy.md) — deploy Cortex after changes
