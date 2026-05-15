---
author: coordinator
timestamp: 2026-05-15T12:00:03Z
channel: dispatch
parent: 001-coordinator-brief.md
---

# Agent 3 — AI write-through + context injection

**Strategy:** Wire agentmemory into the AI chat loop so Cortex remembers and recalls automatically.

**Tasks:**
1. Extend `backend/src/features/agentmemory/client.ts` with `remember(project, text)` and batch helpers
2. In `backend/src/routes/cortex/ai.routes.ts` (or ai feature): before chat completion, `smart-search` top hits → inject into system context; after user message, optional `remember` summary (feature-flag env `AGENTMEMORY_AUTO_REMEMBER=true`)
3. AIPage: show "Memory context" chips when hits used; toggle "Remember this conversation" in UI
4. Rate-limit remember calls; never log secrets

**Constraints:** Works when agentmemory offline (degrade silently). Typecheck must pass.

**Result file:** `.agenthub/board/results/agent-3-result.md`
