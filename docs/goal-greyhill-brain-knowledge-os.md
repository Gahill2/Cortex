# Cortex `/goal` — Grey Hill Brain Knowledge OS

> **Invoke:** paste this file (or link `docs/goal-greyhill-brain-knowledge-os.md`) as a single agent goal.  
> **Roadmap home:** extends `docs/GOALS.md` Phase 7 + homelab ops.  
> **Last updated:** 2026-06-04

---

## 0. External benchmarks (web scan — what “good” looks like in 2026)

Synthesized from Obsidian’s direction, PKM community practice, and homelab platform thinking. Use these as **design tests**, not feature parity requirements.

| Source | Principle | Cortex implication |
|--------|-----------|------------------|
| [Obsidian roadmap](https://obsidian.md/roadmap/) | CLI, headless sync, Bases API, summaries — vault as **substrate** for tools | Keep markdown on disk; Cortex reads/writes files; don’t fork a second note DB |
| [Obsidian Forum — AI-oriented vaults](https://forum.obsidian.md/t/design-your-vault-for-ai-orientation-not-just-human-navigation/112010) | Vault = **persistent state**; sessions = stateless workers; session start/end protocols | `Working Context/`, `Cortex/AI Log.md`, agentmemory `remember`, handoff notes |
| [obsidian-agent-brain](https://github.com/LikelyMalware/obsidian-agent-brain) | `CLAUDE.md` + `AGENTS.md` + `USER.md` + `Workflow.md` at vault root | Mirror in `greyhill_brain` (many files already exist); Cortex/Cursor read same paths |
| [Claude + Obsidian MCP patterns](https://aiartimind.com/reduce-ai-token-costs-how-to-use-obsidian-as-a-persistent-context-for-claude-code/) | Hot/warm/cold context tiers; MOCs over brute-force vault dump | `GET /obsidian/context`, Memory search, graph focus — not whole-vault injection |
| [Second brain apps 2026](https://buildin.ai/blog/best-second-brain-apps-2026) | Local-first, graph, plugins for power users; **act on** knowledge not just store | Cortex = action layer (tasks, mail, AI) atop same vault |
| [Homelab stack 2026](https://www.bigiron.cc/guides/the-2026-homelab-stack-every-layer) | Layer incrementally; **replace subscriptions**; 4–8 h/month maintenance budget | One Docker user, no `sudo docker`; Tailscale + Pi-hole already fit |
| [Homelab → platform](https://medium.com/@tyler.cloud/from-homelab-to-platform-evolving-my-self-hosted-stack-53f78e8d09eb) | Auth + integration > more apps; local AI only valuable when you **own data** | Fix agentmemory reachability; SSO (Authelia) later, not now |

**North star (one sentence):**  
*Grey Hill Brain is the durable markdown source of truth; Cortex is the always-on command layer (search, graph, AI, memory); Obsidian desktop is the rich editor — all three stay in sync via git + local paths.*

---

## 1. Goal

Ship a **reliable, fast Grey Hill Brain stack on the cortex homelab** so you can:

1. **Edit** in Obsidian desktop (full UI + plugins).  
2. **Browse + AI** in Cortex (Notes, Memory, Claude with vault context).  
3. **Remember** across Cursor/Cortex sessions via agentmemory + vault logs.  
4. **Sync** vault truth through **GitHub** (`Gahill2/greyhill_brain`) on every machine.

**Not in scope for this goal:** Obsidian UI parity inside Cortex, Firestore merge (Phase 0), Proxmox migration, Notion reskin.

---

## 2. Context

### Current baseline (verified 2026-06-04)

| Piece | Status |
|-------|--------|
| Vault clone | `~/Documents/greyhill_brain` — **374** `.md` files, `main` synced with GitHub |
| Homelab `.env` | `OBSIDIAN_VAULT_HOST_PATH=/home/greyhill/Documents/greyhill_brain` |
| Docker API mount | **Fixed** after `npm run server:deploy` — container sees 374 notes |
| agentmemory service | **active** on host `:3111`; API container **cannot** reach it yet (`agentmemory_configured: false`) |
| `/mnt/cortex/obsidian` | Root-owned empty dir — avoid until `npm run vault:fix-perms` |
| Docker ops | **snap Docker** — never `sudo docker compose`; use `server:docker:fix-once` |
| Cortex Notes UI | Read-only brain viewer + graph + backlinks + “Open in Obsidian” |
| Scripts | `npm run vault:clone`, `vault:fix-perms`, `server:memory:setup`, `sync:agentmemory-skills:sh` |

### Repo anchors

- Phase 7 checklist: `docs/GOALS.md`  
- Vault + disk: `docs/local-storage-and-obsidian.md`  
- Memory: `docs/agentmemory-setup.md`  
- Homelab Docker rules: `docs/homelab-auto-deploy.md`  
- 9-part goal template: `docs/goal-prompt-production-ready.md`

---

## 3. Constraints

- **Do not** rebuild Obsidian inside Cortex (no plugin runtime, no Canvas clone).  
- **Do not** store vault only inside Postgres/Firestore — files on disk + git remain canonical.  
- **Do not** use `sudo docker compose` on this host (creates un-stoppable containers).  
- **Do not** commit secrets, `api.env` tokens, or vault private content.  
- **Do not** merge `feat/firebase-dashboard-integrations` unless user expands scope.  
- Prefer **smallest diff** per milestone; one PR-sized slice at a time.  
- Match existing patterns: `NotesPage.tsx`, `obsidian.routes.ts`, `deploy/homelab/docker-compose.yml`.

---

## 4. Priority (build faster — ordered milestones)

### M0 — Ops green (blocking everything else) `[S]`

- [ ] `npm run vault:fix-perms` (user runs once with sudo)  
- [ ] `npm run server:docker:doctor` passes  
- [ ] agentmemory reachable from API container (`AGENTMEMORY_URL`, bind `0.0.0.0:3111` or host gateway)  
- [ ] Document: Obsidian snap install + vault path in `local-storage-and-obsidian.md`

### M1 — Session continuity (AI memory that sticks) `[M]`

- [ ] Memory tab shows **healthy** agentmemory from Docker API  
- [ ] Cursor MCP snippet tested: `npx -y @agentmemory/mcp` + `AGENTMEMORY_PROJECT=cortex`  
- [ ] AI chats append to `Cortex/AI Log.md` (verify after one Cortex → AI message)  
- [ ] Vault: `Working Context/` or root `CLAUDE.md` points agents to brain layout (content in git, not code)  
- [ ] Optional: `AGENTMEMORY_AUTO_REMEMBER` policy documented (when to auto-remember vs manual)

### M2 — Vault oriented for agents (web: “AI-oriented vault”) `[M]`

- [ ] Add/maintain in **greyhill_brain** repo (not Cortex code):  
  - `CLAUDE.md` (≤200 lines) — session start reads  
  - `Working Context/` — per-domain state files  
  - Session handoff template in `Daily Notes/` or `Cortex/Handoff.md`  
- [ ] Cortex: `GET /obsidian/context` returns nav + active context paths (may already exist — wire UI chip on Notes)  
- [ ] Command palette: open note / capture / memory search in one flow (`GOALS.md` Phase 7 open item)

### M3 — Editor loop (Obsidian + Cortex, not Cortex-only) `[M]`

- [ ] “Open in Obsidian” works on Linux (`obsidian://` + snap)  
- [ ] `git pull` documented workflow: Obsidian edit → commit/push → `npm run vault:clone` on hub  
- [ ] Notes page: optional **edit mode** (POST `/obsidian/file`) — only if user asks; else defer  
- [ ] File watcher / index refresh on vault change (`CORTEX_ENABLE_VAULT_WATCHER` or periodic reindex)

### M4 — Platform polish (homelab + knowledge platform) `[L]`

- [ ] Move vault to `/mnt/cortex/obsidian/greyhill_brain` after storage partition + perms (optional)  
- [ ] Unified search: vault + agentmemory + Notion in command palette  
- [ ] AI suggested links / summarize cluster (Phase 7 XL — only after M0–M3)  
- [ ] Authelia SSO in front of admin UIs (`docs/homelab-admin-access.md`) — separate goal

---

## 5. Plan (agent execution order)

1. **Read** `deploy/homelab/.env`, `env/api.env`, `docker-compose.yml`, `docs/homelab-auto-deploy.md`.  
2. **Fix M0:** agentmemory listen address; recreate `cortex-api` via `npm run server:deploy` (no sudo).  
3. **Verify M0:** `docker exec … find /vault -name '*.md' | wc -l` ≈ 374; `curl …/api/memory/status`; health `agentmemory_configured: true`.  
4. **M1:** smoke AI log + Memory page; sync agentmemory skills if missing.  
5. **M2:** PR to **greyhill_brain** for orientation files (separate repo — user approves content).  
6. **M3:** docs + small Cortex UX (external open, git workflow).  
7. **Update** `docs/GOALS.md` Phase 7 checkboxes for completed items only (evidence rule).

---

## 6. Done when (this goal’s stop line)

**Minimum shippable (M0 + M1):**

- [ ] Cortex **Notes** shows real vault content (not 0 files).  
- [ ] Cortex **Memory** reports agentmemory **healthy** from production API.  
- [ ] One Claude chat in Cortex appends a line to `Cortex/AI Log.md`.  
- [ ] Obsidian desktop opens same vault path; edit appears in Cortex after refresh.  
- [ ] `npm run vault:clone` pulls latest without permission errors (after fix-perms).  
- [ ] `npm run server:docker:doctor` — no “cannot stop container” on routine deploy.

**Stretch (M2–M3):** orientation files in vault + command-palette search + documented git loop.

---

## 7. Verify

```bash
# Vault on host
test -d /home/greyhill/Documents/greyhill_brain/.git && git -C /home/greyhill/Documents/greyhill_brain status -sb
find /home/greyhill/Documents/greyhill_brain -name '*.md' | wc -l

# Docker (no sudo)
npm run server:docker:doctor
docker inspect cortex-homelab-cortex-api-1 --format '{{range .Mounts}}{{if eq .Destination "/vault"}}{{.Source}}{{end}}{{end}}'
docker exec cortex-homelab-cortex-api-1 find /vault -name '*.md' | wc -l

# API
curl -s http://127.0.0.1:8080/api/health | jq '{obsidian: .obsidian_vaults, agentmemory: .agentmemory_configured}'
curl -s http://127.0.0.1:3111/agentmemory/health | jq .status

# From API container (agentmemory through Docker network)
docker exec cortex-homelab-cortex-api-1 node -e \
  "fetch('http://host.docker.internal:3111/agentmemory/health').then(r=>r.json()).then(d=>console.log(d.status)).catch(e=>console.error(e))"
```

**Manual:**

- Cortex → **Notes** → pick note → **Open in Obsidian**  
- Cortex → **AI** → one message → check `greyhill_brain/Cortex/AI Log.md`  
- Cortex → **Settings → Memory** → MCP block copies cleanly into Cursor  

---

## 8. Output (agent must return)

- **Status:** `DONE` | `DONE_WITH_CONCERNS` | `BLOCKED`  
- **Milestone:** M0 | M1 | M2 | M3 | M4  
- **Files changed** (grouped: homelab, backend, frontend, docs, greyhill_brain)  
- **Verify table** — paste command outputs  
- **Follow-ups** — ordered list for next `/goal` run  

---

## 9. Stop rules

- Stop after **30** tool turns; report partial milestone + blockers.  
- Stop if the **same verify command** fails **3** times without a new hypothesis.  
- Stop and ask user if **GitHub SSH** or **sudo** is required and unavailable in session.  
- Do **not** start Proxmox, Firestore merge, or full Notes editor without explicit user expansion.  
- Do **not** create git commits unless user asks.

---

## Quick reference — npm commands

| Command | Purpose |
|---------|---------|
| `npm run vault:clone` | Pull `Gahill2/greyhill_brain` |
| `npm run vault:fix-perms` | `chown` homelab data + obsidian mount |
| `npm run server:memory:setup` | agentmemory systemd + api.env |
| `npm run server:docker:fix-once` | Stuck snap Docker containers |
| `npm run server:deploy` | Rebuild API/web (user docker, no sudo) |
| `npm run sync:agentmemory-skills:sh` | Cursor `@agentmemory-*` skills |
| `npm run dev:stack` | Local dev: API + UI + memory :3111 |

---

## Success metrics (develop better & faster)

Track weekly — keeps scope honest:

| Metric | Target |
|--------|--------|
| Time to orient new agent session | &lt; 2 min (read `CLAUDE.md` + context file) |
| Vault visible in Cortex Notes | 100% of `.md` on disk (count match host vs container) |
| AI log capture rate | 100% of Cortex AI turns when `OBSIDIAN_AI_LOG_ENABLED=true` |
| Docker deploy without sudo | 100% after fix-once |
| Homelab maintenance | ≤ 8 h/month (align with 2026 homelab guides) |
| Duplicate SaaS | Cortex replaces “second brain SaaS” for search/AI; Obsidian for edit |

---

*Run `/goal` with this file anytime. Update milestones in `docs/GOALS.md` Phase 7 when evidence exists on disk.*
