#!/usr/bin/env bash
# Sync agentmemory plugin skills into .cursor/skills/ (Linux/macOS).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor/agentmemory"
SKILLS_SRC="$VENDOR/plugin/skills"
DEST="$ROOT/.cursor/skills"

if [[ -n "${AGENTMEMORY_REPO:-}" && -d "$AGENTMEMORY_REPO/plugin/skills" ]]; then
  SKILLS_SRC="$AGENTMEMORY_REPO/plugin/skills"
fi

if [[ ! -d "$SKILLS_SRC" ]]; then
  SIBLING="$(dirname "$ROOT")/agentmemory/plugin/skills"
  if [[ -d "$SIBLING" ]]; then
    SKILLS_SRC="$SIBLING"
  else
    echo "Missing agentmemory skills. Run:" >&2
    echo "  git submodule update --init vendor/agentmemory" >&2
    echo "  or: git clone --depth 1 https://github.com/rohitg00/agentmemory.git vendor/agentmemory" >&2
    exit 1
  fi
fi

mkdir -p "$DEST"
CORTEX_FOOTER=$'

## Cortex

- Memory server: `npm run dev:memory` or homelab `cortex-agentmemory.service` (port 3111).
- Set `AGENTMEMORY_PROJECT=cortex` and `AGENTMEMORY_URL=http://127.0.0.1:3111` in `backend/.env` / `deploy/homelab/env/api.env`.
- Cursor MCP: `npx -y @agentmemory/mcp` with the same `AGENTMEMORY_URL` (see Memory in Cortex or `docs/agentmemory-setup.md`).
'

installed=0
for dir in "$SKILLS_SRC"/*/; do
  [[ -d "$dir" ]] || continue
  name="$(basename "$dir")"
  skill="$dir/SKILL.md"
  [[ -f "$skill" ]] || continue
  case "$name" in design|goal|lazyweb) continue ;; esac
  target="$DEST/agentmemory-$name"
  mkdir -p "$target"
  cp "$skill" "$target/SKILL.md"
  if ! grep -q "## Cortex" "$target/SKILL.md" 2>/dev/null; then
    printf '%s\n' "$CORTEX_FOOTER" >>"$target/SKILL.md"
  fi
  installed=$((installed + 1))
done

echo "[agentmemory-skills] Installed $installed skills under .cursor/skills/agentmemory-*"
