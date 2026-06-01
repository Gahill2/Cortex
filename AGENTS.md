
## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- **Task observer / skill improvement** → invoke `@task-observer` (sync: `npm run sync:task-observer`, see `docs/task-observer.md`). Also trigger on "One skill to rule them all". Read `CORTEX-WORKSPACE.md` in that skill folder for Cortex paths.
- Long-term memory (remember, recall, forget, past sessions) → use `@agentmemory-remember`, `@agentmemory-recall`, `@agentmemory-forget`, or `@agentmemory-session-history` after `npm run sync:agentmemory-skills` (see `docs/agentmemory-setup.md`)
- Anthropic official skills (PDF, DOCX, frontend design, MCP builder, etc.) → sync with `npm run sync:anthropic-skills` (see `docs/anthropic-skills.md`); invoke as `@anthropic-<skill-name>` (e.g. `@anthropic-pdf`, `@anthropic-mcp-builder`)
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Terminal coding agent (Pi CLI on this repo) → `npm run pi:install` then `npm run pi`; see `docs/pi-coding-agent.md`
- Terminal coding agent (Kimi Code CLI) → `npm run kimi:install` then `npm run kimi`; see `docs/kimi-code-cli.md`
- Terminal coding agent (OpenClaw) → `npm run openclaw:setup` then `npm run openclaw:dev`; see `docs/openclaw-cortex.md`
- Homelab auto-deploy (Docker rebuild on git/source changes) → `npm run server:deploy:setup` (no sudo); one-time `npm run server:docker:fix-once` if containers were started with sudo; see `docs/homelab-auto-deploy.md`

## Task observer (meta-skill)

At the start of any **task-oriented session** — any interaction where you will use tools and produce deliverables — invoke `@task-observer` before beginning work (after `npm run sync:task-observer`). Read `CORTEX-WORKSPACE.md` in that skill folder for observation log paths.

When loading any skill, check `skill-observations/log.md` for OPEN observations tagged to that skill and apply their insights even if the skill file has not been updated yet.

At session end (or when the user archives work), ask or offer: **"Any observations logged?"**

## OpenClaw (terminal)

Interactive coding in the user's terminal (not Discord-required):

1. `npm run openclaw:setup` — workspace = this repo, Gateway helper installed
2. `npm run openclaw:dev` — `openclaw tui` in the current shell; agent runs shell/file tools on Cortex
3. Follow skill routing in this file (review, investigate, ship, etc.)

One-shot: `npm run openclaw:ask -- "prompt"` or `npm run openclaw:local -- "prompt"`. Full guide: `docs/openclaw-cortex.md`.

## Multi-agent review (team workflow)

Use this when several agents (or parallel chats) touch the same codebase so work gets **reviewed, not only written**.

**Roles (conceptual — can be separate chats or sequential passes):**

1. **Implementer** — ships the feature or fix (focused diff).
2. **Reviewer** — invoke `/review` (pre-landing PR review: SQL safety, LLM boundaries, side effects, structure).
3. **Challenger** — invoke `/codex` in *challenge* mode (or `/Codex` challenge on non-Codex hosts; use the adversarial skill your OpenClaw session documents when OpenClaw is the host) for adversarial “break this” pass.
4. **Integrator** — resolves conflicts, applies only agreed fixes, re-runs tests; human approves ambiguous tradeoffs.

**Order of operations:**

- After each agent’s edits: **Reviewer** runs on the **combined diff** against the target branch (not per-file noise in isolation).
- If Reviewer and Challenger disagree: **human decides**; document the decision in the PR or commit message.
- For large cross-cutting changes: run **`/autoplan`** once up front (CEO + design + eng + DX) so scope is aligned before parallel implementation.

**Quality bar:**

- No merge without at least **Review** (or equivalent human review) on the final diff.
- Optional **Challenger** pass for auth, mail, AI, or anything security- or data-sensitive.

## Cursor Cloud specific instructions

### Services overview

| Service | Port | Start command |
|---------|------|---------------|
| **Postgres (InsForge hub)** | 5432 | On hub: `npm run hub:up` (or postgres-only step in `docs/insforge-tailscale.md`) — DB name `launchpad` |
| InsForge API / Auth | 7130 / 7131 | Same hub stack after full `npm run hub:up` |
| Cortex API / Web (optional on hub) | 4000 / 8080 | `deploy/tailscale-hub/` — see `docs/insforge-tailscale.md` |
| Backend API (Express) | 4000 | `npm run dev:backend` (from repo root) |
| Frontend (Vite/React) | 5173 | `npm run dev:frontend` (from repo root) |

### RAM-conscious local dev

Default `npm run dev` is **lite mode** (skips Prisma on every restart, lighter Vite). See [docs/dev-resources.md](docs/dev-resources.md). After schema changes: `npm run db:migrate`. Full stack: `npm run dev:full`.

### Browser / Cursor IDE

Do **not** open the Cortex dev UI in **Cursor Simple Browser** (port preview) — it can crash the IDE on heavy pages (Tasks & Calendar, canvas home). Use **Chrome**: `npm run open` or `http://localhost:5173` in an external browser. See `docs/dev-resources.md`.

### Running the backend

`npm run dev:backend` / lite uses `backend/.env` via dotenv. For Cloud Agent shells without auto-load, use:

```bash
cd /workspace/backend
set -a; source /workspace/.env; set +a
OBSIDIAN_VAULT_PATH="" npm run dev
```

Setting `OBSIDIAN_VAULT_PATH=""` is required because the `.env.example` has a Windows path that crashes the server on Linux.

### Auth / login in dev

The app uses **cortex auth** (not the v1 auth). Demo credentials (env defaults):
- Email: `grey@cortex.local`
- Password: `ChangeMe123!`
- PIN: `1234`

The login flow uses OTP by default in the frontend. In dev (no SMTP), the backend returns the OTP code in the API response body (`devOtpCode` field).

### Lint / typecheck / test

- **Backend**: `npm run lint` (alias for `tsc --noEmit`), `npm run test` (vitest)
- **Frontend**: `npm run typecheck` (tsc), `npm run lint` (eslint — pre-existing warnings exist)
- The `firebase-status.test.ts` test expects Firebase credentials; it will fail without them (expected in Cloud Agent).
- The Obsidian vault watcher throws unhandled rejections on the Windows path — clear `OBSIDIAN_VAULT_PATH` to avoid test noise.

### Seed data

`prisma/seed.ts` references a non-existent `TaskStatus` enum export. To seed, either use raw SQL or invoke Prisma directly with string values (`"TODO"`, `"IN_PROGRESS"`, `"DONE"`).
