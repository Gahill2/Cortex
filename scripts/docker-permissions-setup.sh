#!/usr/bin/env bash
# One-time setup: passwordless Docker control + fix dual snap/apt Docker (root cause of
# "permission denied" on stop/restart). Run on the cortex hub in your terminal:
#   npm run server:docker:setup-perms
# Requires sudo (will prompt for your password once).
set -euo pipefail

USER_NAME="${SUDO_USER:-${USER:-greyhill}}"
DOCKER_GROUP="docker"
SUDOERS_FILE="/etc/sudoers.d/cortex-docker-${USER_NAME}"

echo "=== Cortex Docker permissions setup ==="
echo "User: $USER_NAME"
echo ""

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Re-running with sudo..."
  exec sudo bash "$0" "$@"
fi

# 1. docker group
if getent group "$DOCKER_GROUP" >/dev/null; then
  if id -nG "$USER_NAME" | grep -qw "$DOCKER_GROUP"; then
    echo "✓ $USER_NAME already in group $DOCKER_GROUP"
  else
    usermod -aG "$DOCKER_GROUP" "$USER_NAME"
    echo "✓ Added $USER_NAME to group $DOCKER_GROUP (log out/in or: newgrp docker)"
  fi
else
  groupadd "$DOCKER_GROUP" 2>/dev/null || true
  usermod -aG "$DOCKER_GROUP" "$USER_NAME"
  echo "✓ Created docker group and added $USER_NAME"
fi

# 2. Passwordless sudo for Docker + compose + snap docker daemon (dev / recovery)
cat >"$SUDOERS_FILE" <<EOF
# Cortex homelab — passwordless Docker for $USER_NAME (managed by docker-permissions-setup.sh)
$USER_NAME ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/local/bin/docker, /snap/bin/docker
$USER_NAME ALL=(ALL) NOPASSWD: /usr/bin/docker-compose, /usr/local/bin/docker-compose
$USER_NAME ALL=(ALL) NOPASSWD: /usr/bin/systemctl start docker, /usr/bin/systemctl stop docker, /usr/bin/systemctl restart docker
$USER_NAME ALL=(ALL) NOPASSWD: /usr/bin/systemctl start docker.socket, /usr/bin/systemctl stop docker.socket, /usr/bin/systemctl restart docker.socket
$USER_NAME ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart docker.socket docker, /usr/bin/systemctl restart docker docker.socket
$USER_NAME ALL=(ALL) NOPASSWD: /usr/bin/systemctl start snap.docker.dockerd, /usr/bin/systemctl stop snap.docker.dockerd, /usr/bin/systemctl restart snap.docker.dockerd
$USER_NAME ALL=(ALL) NOPASSWD: /usr/bin/snap restart docker, /usr/bin/snap stop docker, /usr/bin/snap start docker
EOF
chmod 0440 "$SUDOERS_FILE"
visudo -cf "$SUDOERS_FILE"
echo "✓ Passwordless sudo for Docker → $SUDOERS_FILE"

# 3. Dual Docker installs (snap + apt) — main cause of AppArmor "permission denied"
HAS_APT=false
HAS_SNAP=false
dpkg -s docker.io >/dev/null 2>&1 && HAS_APT=true
snap list docker >/dev/null 2>&1 && HAS_SNAP=true

if [[ "$HAS_APT" == true && "$HAS_SNAP" == true ]]; then
  echo ""
  echo "⚠ Both apt docker.io AND snap docker are installed (AppArmor conflicts)."
  echo "  Active root: $(docker info 2>/dev/null | grep 'Docker Root Dir' | awk -F': ' '{print $2}' || echo unknown)"
  echo ""
  read -r -p "Remove snap docker and use apt docker.io only? [Y/n] " REPLY
  REPLY="${REPLY:-Y}"
  if [[ "$REPLY" =~ ^[Yy]$ ]]; then
    echo "Stopping snap docker..."
    snap stop docker 2>/dev/null || true
    snap remove docker --purge 2>/dev/null || snap remove docker 2>/dev/null || true
    systemctl enable --now docker 2>/dev/null || true
    systemctl restart docker 2>/dev/null || true
    echo "✓ Removed snap docker; using apt docker.io"
    if command -v aa-remove-unknown >/dev/null; then
      aa-remove-unknown 2>/dev/null || true
      echo "✓ Cleared stale AppArmor profiles (aa-remove-unknown)"
    fi
    echo "  Reboot recommended after removing snap docker."
  else
    echo "  Skipped snap removal — use: bash scripts/docker-manage.sh restart <name>"
  fi
elif [[ "$HAS_SNAP" == true ]]; then
  echo "ℹ Using snap docker only"
elif [[ "$HAS_APT" == true ]]; then
  echo "✓ Using apt docker.io only"
  systemctl enable --now docker 2>/dev/null || true
fi

echo "Restarting Docker daemon..."
systemctl restart docker.socket docker 2>/dev/null || true
sleep 2
if docker info >/dev/null 2>&1; then
  echo "✓ docker ps works"
else
  echo "⚠ docker ps still fails — run: newgrp docker   then: docker ps"
  echo "  Or reboot once after snap removal"
fi

echo ""
echo "=== Done ==="
echo "  Manage containers:  npm run docker:restart -- cortex-radarr"
echo "  Check permissions:  npm run server:docker:doctor"
echo "  If you were added to group docker: log out/in or run: newgrp docker"
