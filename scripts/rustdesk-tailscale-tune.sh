#!/usr/bin/env bash
# Tune RustDesk for direct Tailscale access (lower latency than public relay).
set -euo pipefail

CFG="${HOME}/.config/rustdesk/RustDesk2.toml"
TS_IP="$(tailscale ip -4 2>/dev/null | head -1 || true)"

if [[ ! -f "$CFG" ]]; then
  echo "RustDesk config not found at $CFG — install RustDesk first."
  exit 1
fi

backup="${CFG}.bak.$(date +%Y%m%d%H%M%S)"
cp "$CFG" "$backup"
echo "Backed up to $backup"

# Prefer direct peer connection; disable AV1 test (often slower on Linux iGPU).
if grep -q '^\[options\]' "$CFG"; then
  sed -i '/^av1-test = /d' "$CFG"
  sed -i '/^direct-server = /d' "$CFG"
  sed -i '/^local-ip-addr = /d' "$CFG"
else
  printf '\n[options]\n' >>"$CFG"
fi

{
  echo "direct-server = 'Y'"
  if [[ -n "$TS_IP" ]]; then
    echo "local-ip-addr = '${TS_IP}'"
  fi
  echo "# AV1 can stutter on some Linux hosts; use H.264 hardware path"
  echo "av1-test = 'N'"
} >>"$CFG"

echo "Updated $CFG"
if [[ -n "$TS_IP" ]]; then
  echo "Connect from remote RustDesk client to: ${TS_IP}"
else
  echo "Tailscale IP not found — run: tailscale up"
fi
echo "Restart RustDesk service if needed: sudo systemctl restart rustdesk"
