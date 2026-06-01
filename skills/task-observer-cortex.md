# Cortex / Cursor workspace adaptation

This appendix applies when task-observer runs in the **Cortex** repository on Cursor (or OpenClaw with this repo as workspace). Read it together with the upstream `SKILL.md` from [rebelytics/one-skill-to-rule-them-all](https://github.com/rebelytics/one-skill-to-rule-them-all).

## Workspace paths

| Concept | Cortex path |
|---------|-------------|
| `[workspace folder]` | Cortex repo root (e.g. `~/Documents/Cortex`) |
| Observation log | `skill-observations/log.md` |
| Cross-cutting principles | `skill-observations/cross-cutting-principles.md` |
| Last review date | `skill-observations/last-review-date.txt` |
| Archive | `skill-observations/archive/log-YYYY-MM-DD.md` |
| Staged skill updates | `skill-updates/YYYY-MM-DD/{skill-name}/SKILL.md` |
| Activation config | `AGENTS.md` and `CLAUDE.md` (repo root) |

## Skill locations in Cursor

| Location | Role |
|----------|------|
| `.cursor/skills/` | Project skills (synced via `npm run sync:task-observer`, etc.) — **edit here for Cortex-specific skills** |
| `~/.cursor/skills-cursor/` | Cursor built-in skills (`create-skill`, `review`, …) — read-only |
| `vendor/claude-skills/` | Upstream claude-skills submodule — sync with `npm run sync:claude-skills` |
| `vendor/anthropic-skills/` | Anthropic official skills — sync with `npm run sync:anthropic-skills` |
| `vendor/task-observer/` | This meta-skill upstream — sync with `npm run sync:task-observer` |

When improving skills, prefer editing `.cursor/skills/{name}/SKILL.md` (or the tracked source under `skills/` if present). Stage substantial changes under `skill-updates/` before replacing live files.

## Cursor-specific substitutions

- **`present_files` (Cowork)** → Write the updated `SKILL.md` to `skill-updates/YYYY-MM-DD/{skill-name}/SKILL.md` and tell the user the path. They can review in the editor or ask the agent to apply.
- **Read-only Cowork mount** → Not applicable. Project skills in `.cursor/skills/` are writable locally (directory is gitignored; sync scripts restore from vendor/tracked sources).
- **`skill-creator` (Claude built-in)** → Use `@create-skill` (Cursor built-in at `~/.cursor/skills-cursor/create-skill/SKILL.md`) for new skills or major rewrites.
- **`<available_skills>`** → Use Cursor's available skills list from the session, plus `Glob .cursor/skills/**/SKILL.md` and `AGENTS.md` routing when inventorying.
- **Scheduled review (Cowork shortcuts)** → Use Cursor **loop** skill, a cron on the homelab PC, or ask at session end: *"Any observations logged?"* Review cadence: Mon/Wed/Fri recommended (see upstream USER-GUIDE).

## Cortex skill routing (observe these too)

When logging observations, include friction from Cortex workflows:

- Homelab Docker deploy (`deploy/homelab/`, `sudo docker compose up -d --build`)
- Tailscale Serve URL vs LAN ports (`docs/insforge-tailscale.md`, `:8080` not `:8084`)
- Backend vs Vite dev port conflicts (`:4000` Docker vs `npm run dev`)
- Settings sync / Postgres prefs (`PreferencesContext`, `extraJson`)
- OpenClaw terminal agent (`npm run openclaw:dev`)

Tag homelab-specific observations as **internal**. General methodology (pre-flight checks, lean skills, etc.) can be **open-source**.

## Session-end prompt

The maintainer recommends asking before archiving a session:

> Any observations logged?

Do this after substantive Cortex work (features, deploys, UI polish, debugging).
