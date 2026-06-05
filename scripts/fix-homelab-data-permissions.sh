#!/usr/bin/env bash
# Fix root-owned homelab data + obsidian paths (common after Docker created them as root).
# Requires sudo once.
set -euo pipefail

USER_NAME="${SUDO_USER:-$(id -un)}"
GROUP_NAME="$(id -gn "$USER_NAME" 2>/dev/null || echo "$USER_NAME")"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

paths=(
  "$ROOT/deploy/homelab/data"
  /mnt/cortex/obsidian
)

echo "Will chown these paths to ${USER_NAME}:${GROUP_NAME}:"
printf '  %s\n' "${paths[@]}"
echo ""

if [[ "$(id -u)" -ne 0 ]]; then
  exec sudo bash "$0" "$@"
fi

for p in "${paths[@]}"; do
  [[ -e "$p" ]] || continue
  chown -R "$USER_NAME:$GROUP_NAME" "$p"
  echo "[fix-perms] $p"
done

echo ""
echo "Done. Re-run: npm run vault:clone"
