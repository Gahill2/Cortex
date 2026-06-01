
## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

**Vendored libraries:** 260+ skills from [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) (`vendor/claude-skills/`, `.\scripts\sync-claude-skills.ps1`, see `docs/claude-skills.md`). Official Anthropic skills from [anthropics/skills](https://github.com/anthropics/skills) (`vendor/anthropic-skills/`, `npm run sync:anthropic-skills`, see `docs/anthropic-skills.md`) — e.g. `@anthropic-pdf`, `@anthropic-frontend-design`, `@anthropic-mcp-builder`. Claude-skills examples: `@senior-architect`, `@senior-frontend`, `@content-creator`, `@product-manager-toolkit`.

Key routing rules:
- **Task observer / skill improvement** → `@task-observer` (`npm run sync:task-observer`, `docs/task-observer.md`); also "One skill to rule them all"
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Logo, CIP, banners, slides, icons, social images, brand/design system → invoke **design** skill (`.cursor/skills/design/`)
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore

## Task observer

At the start of task-oriented sessions (tools + deliverables), invoke `@task-observer` and read `CORTEX-WORKSPACE.md` in that skill folder. Check `skill-observations/log.md` for OPEN items affecting skills in use. End sessions with "Any observations logged?" when work was substantive.

## OpenClaw as primary host

There is **no** OpenClaw-specific wiring in this repository (no `openclaw`, `OpenClaw`, or `.openclaw` references in tracked source). `.cursor/` is **gitignored**, so Cursor rules or model defaults are not shared through git.

**To drive Cortex mainly from OpenClaw:** open this repo root as the working tree in OpenClaw; use OpenClaw’s own docs for browser control, pair-agent, and MCP. Keep the skill routing above as the contract for *which* workflows to run (review, QA, ship, etc.); only the host and skill install path change.

**Skills:** if you use gstack, install or sync the OpenClaw-oriented skill copies where OpenClaw discovers them (upstream gstack ships `gstack-openclaw-*` variants alongside the generic skills; exact paths depend on your install).

**Cursor-only chats:** nothing here auto-selects OpenClaw; use local Cursor user rules or a tracked doc if you want explicit reminders.

## Multi-agent review (team workflow)

Use this when several agents (or parallel chats) touch the same codebase so work gets **reviewed, not only written**.

**Roles (conceptual — can be separate chats or sequential passes):**

1. **Implementer** — ships the feature or fix (focused diff).
2. **Reviewer** — invoke `/review` (pre-landing PR review: SQL safety, LLM boundaries, side effects, structure).
3. **Challenger** — invoke `/codex` in *challenge* mode (or `/claude` challenge on non-Claude hosts; use the adversarial skill your OpenClaw session documents when OpenClaw is the host) for adversarial “break this” pass.
4. **Integrator** — resolves conflicts, applies only agreed fixes, re-runs tests; human approves ambiguous tradeoffs.

**Order of operations:**

- After each agent’s edits: **Reviewer** runs on the **combined diff** against the target branch (not per-file noise in isolation).
- If Reviewer and Challenger disagree: **human decides**; document the decision in the PR or commit message.
- For large cross-cutting changes: run **`/autoplan`** once up front (CEO + design + eng + DX) so scope is aligned before parallel implementation.

**Quality bar:**

- No merge without at least **Review** (or equivalent human review) on the final diff.
- Optional **Challenger** pass for auth, mail, AI, or anything security- or data-sensitive.
