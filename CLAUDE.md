
## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

**Vendored library:** 260+ skills from [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) live under `vendor/claude-skills/`. Sync to Cursor with `.\scripts\sync-claude-skills.ps1` (see `docs/claude-skills.md`). Examples: `@senior-architect`, `@senior-frontend`, `@content-creator`, `@product-manager-toolkit`, `@skill-security-auditor`.

Key routing rules:
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
