#!/usr/bin/env bash
# Set Jellyfin display name (fixes Docker hostname like 99e27d2162ce in the UI header).
#
#   npm run nas:jellyfin:server-name
#   npm run nas:jellyfin:server-name -- --name "Greyhill Media"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAS_ENV="$ROOT/deploy/nas/.env"
NAS_ROOT="${NAS_DATA_ROOT:-/mnt/cortex/nas-data}"
NAME="${JELLYFIN_SERVER_NAME:-Cortex Media}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name=*) NAME="${1#*=}"; shift ;;
    --name) NAME="${2:?}"; shift 2 ;;
    -h|--help)
      sed -n '1,8p' "$0"
      exit 0
      ;;
    *) shift ;;
  esac
done

if [[ -f "$NAS_ENV" ]]; then
  NAS_ROOT="$(grep -E '^NAS_DATA_ROOT=' "$NAS_ENV" | cut -d= -f2- | tr -d '"' || echo "$NAS_ROOT")"
  NAME="$(grep -E '^JELLYFIN_SERVER_NAME=' "$NAS_ENV" 2>/dev/null | cut -d= -f2- | tr -d '"' || echo "$NAME")"
  NAME="${NAME:-Cortex Media}"
fi

SYSTEM_XML="${NAS_ROOT}/appdata/jellyfin/config/config/system.xml"
if [[ ! -f "$SYSTEM_XML" ]]; then
  echo "Missing $SYSTEM_XML — start Jellyfin once." >&2
  exit 1
fi

apply_name() {
  local target="$1"
  python3 <<PY
import re, pathlib
path = pathlib.Path("$target")
text = path.read_text(encoding="utf-8")
name = """$NAME""".replace("&", "&amp;").replace("<", "&lt;")
if "<ServerName>" not in text:
    raise SystemExit("No <ServerName> in system.xml")
text = re.sub(r"<ServerName>[^<]*</ServerName>", f"<ServerName>{name}</ServerName>", text, count=1)
path.write_text(text, encoding="utf-8")
print(f"ServerName → {name!r}")
PY
}

JELLYFIN_CTR="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -E 'cortex-nas-jellyfin-1|jellyfin' | head -1 || true)"
if [[ -n "${JELLYFIN_CTR:-}" ]]; then
  docker exec "$JELLYFIN_CTR" sed -i "s|<ServerName>.*</ServerName>|<ServerName>${NAME}</ServerName>|" /config/config/system.xml
  echo "ServerName → ${NAME!r} (via ${JELLYFIN_CTR})"
elif apply_name "$SYSTEM_XML" 2>/dev/null; then
  :
else
  echo "Could not write $SYSTEM_XML — start Jellyfin or run as user that owns appdata." >&2
  exit 1
fi

PIHOLE_DOMAIN="${CORTEX_DNS_DOMAIN:-cortex}"
PUBLISHED="$(grep -E '^JELLYFIN_PUBLISHED_URL=' "$NAS_ENV" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
if [[ -z "${PUBLISHED:-}" ]]; then
  PUBLISHED="http://jellyfin.${PIHOLE_DOMAIN}:8096"
fi
echo ""
echo "Restart Jellyfin to apply (or wait ~30s):"
echo "  npm run nas:jellyfin:recreate"
echo ""
echo "Published stream URL for clients: $PUBLISHED"
echo "  Set in deploy/nas/.env as JELLYFIN_PUBLISHED_URL if TVs/apps need correct links."
