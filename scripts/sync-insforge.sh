#!/usr/bin/env bash
# Shallow clone / update InsForge into vendor/insforge for docker compose include.
set -euo pipefail
REF="${1:-main}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$ROOT/vendor/insforge"
REPO="https://github.com/InsForge/InsForge.git"

if [[ -d "$TARGET/.git" ]]; then
  echo "Updating vendor/insforge ..."
  git -C "$TARGET" fetch origin "$REF" --depth 1
  git -C "$TARGET" checkout "$REF"
  git -C "$TARGET" pull origin "$REF" --depth 1
else
  mkdir -p "$ROOT/vendor"
  echo "Cloning InsForge into vendor/insforge ..."
  git clone --depth 1 --branch "$REF" "$REPO" "$TARGET"
fi

echo "Done. Hub: npm run hub:up  |  Local only: npm run insforge:up"
