---
author: coordinator
timestamp: 2026-05-15T12:00:02Z
channel: dispatch
parent: 001-coordinator-brief.md
---

# Agent 2 — Firebase cross-device config sync

**Strategy:** Use existing Firebase/Firestore so each machine shares memory **settings** (not the full agentmemory DB).

**Tasks:**
1. Add Firestore doc shape: `users/{userId}/memory_config` with `agentmemoryUrl`, `agentmemoryProject`, `vaultPaths[]`, `updatedAt`
2. Routes: `GET/PUT /api/memory/config` — read/write per authenticated user when Firebase configured
3. On startup, merge Firestore config with local `.env` (env wins for secrets only; vault paths merge)
4. Settings → Memory section: "Sync config across devices" button + status
5. Document in `docs/agentmemory-setup.md` cross-system Firebase section

**Constraints:** Graceful fallback when Firebase not configured. Reuse `backend/src/features/firebase/`.

**Result file:** `.agenthub/board/results/agent-2-result.md`
