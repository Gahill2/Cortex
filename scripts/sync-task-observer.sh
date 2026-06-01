#!/usr/bin/env bash
# Sync task-observer (One Skill to Rule Them All) into .cursor/skills/
# Run from repo root: ./scripts/sync-task-observer.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor/task-observer"
DEST="$ROOT/.cursor/skills/task-observer"

if [[ ! -f "$VENDOR/SKILL.md" ]]; then
  echo "Missing vendor/task-observer. Run: git submodule update --init vendor/task-observer" >&2
  exit 1
fi

mkdir -p "$DEST"
cp "$VENDOR/SKILL.md" "$DEST/SKILL.md"
cp "$VENDOR/LICENSE.txt" "$DEST/LICENSE.txt" 2>/dev/null || true
cp "$VENDOR/USER-GUIDE.md" "$DEST/USER-GUIDE.md" 2>/dev/null || true
cp "$ROOT/skills/task-observer-cortex.md" "$DEST/CORTEX-WORKSPACE.md"

echo "Synced task-observer to .cursor/skills/task-observer/"
echo "  SKILL.md + CORTEX-WORKSPACE.md (read both in Cursor)"
