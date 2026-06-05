#!/usr/bin/env bash
# Add local + remote folder paths to Jellyfin Movies / TV libraries (options.xml).
# Run after remote mount: npm run nas:jellyfin:library-paths
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAS_ENV="${NAS_ENV_FILE:-$ROOT/deploy/nas/.env}"
REMOTE_ENV="${JELLYFIN_REMOTE_ENV:-$ROOT/deploy/nas/.remote-storage.env}"
JELLYFIN_CONTAINER="${JELLYFIN_CONTAINER:-cortex-nas-jellyfin-1}"

read_env_var() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  grep -m1 "^${key}=" "$file" 2>/dev/null | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

NAS_ROOT="${NAS_DATA_ROOT:-$(read_env_var "$NAS_ENV" NAS_DATA_ROOT)}"
NAS_ROOT="${NAS_ROOT:-/mnt/cortex/nas-data}"

if [[ -f "$REMOTE_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$REMOTE_ENV"
  set +a
fi

JELLYFIN_CONFIG="$NAS_ROOT/appdata/jellyfin/config"
LOCAL_MOVIES="${JELLYFIN_LOCAL_MOVIES_PATH:-/media/movies}"
LOCAL_TV="${JELLYFIN_LOCAL_TV_PATH:-/media/tv}"
REMOTE_MOVIES="${JELLYFIN_REMOTE_MOVIES_PATH:-/media-remote/movies}"
REMOTE_TV="${JELLYFIN_REMOTE_TV_PATH:-}"
REMOTE_MOUNT="${JELLYFIN_REMOTE_MOUNT:-/mnt/cortex/jellyfin-remote}"

export JELLYFIN_CONFIG LOCAL_MOVIES LOCAL_TV REMOTE_MOVIES REMOTE_TV REMOTE_MOUNT

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export TMP

python3 <<'PY'
import os
import sys
import shutil
import xml.etree.ElementTree as ET

config = os.environ["JELLYFIN_CONFIG"]
tmp = os.environ["TMP"]
local_movies = os.environ["LOCAL_MOVIES"]
local_tv = os.environ["LOCAL_TV"]
remote_movies = os.environ["REMOTE_MOVIES"]
remote_tv = os.environ["REMOTE_TV"]
remote_mount = os.environ["REMOTE_MOUNT"]


def set_paths(options_path: str, paths: list[str], out_path: str) -> None:
    tree = ET.parse(options_path)
    root = tree.getroot()
    path_infos = root.find("PathInfos")
    if path_infos is None:
        path_infos = ET.SubElement(root, "PathInfos")
    for el in list(path_infos.findall("MediaPathInfo")):
        path_infos.remove(el)
    for path in paths:
        if not path or not str(path).strip():
            continue
        info = ET.SubElement(path_infos, "MediaPathInfo")
        p = ET.SubElement(info, "Path")
        p.text = path
    try:
        ET.indent(tree, space="  ")
    except AttributeError:
        pass
    tree.write(out_path, encoding="utf-8", xml_declaration=True)


movies_xml = f"{config}/root/default/Movies/options.xml"
tv_xml = f"{config}/root/default/TV Shows/options.xml"

if not os.path.isfile(movies_xml):
    print(f"Missing {movies_xml}", file=sys.stderr)
    sys.exit(1)

always_remote = os.environ.get("JELLYFIN_REMOTE_ALWAYS_ADD_PATHS", "1") == "1"
remote_ok = os.path.ismount(remote_mount)
movie_paths = [local_movies]
tv_paths = [local_tv]
if remote_ok or always_remote:
    if remote_movies.strip():
        movie_paths.append(remote_movies)
    if remote_tv.strip():
        tv_paths.append(remote_tv)
if remote_ok:
    print(f"Remote mount OK: {remote_mount}")
elif always_remote:
    print(f"Remote paths configured; mount still needed at {remote_mount}")
    print("Run: npm run nas:remote-storage:mount")
else:
    print(f"Remote mount not present ({remote_mount}) — only local paths.")

set_paths(movies_xml, movie_paths, f"{tmp}/movies.xml")
set_paths(tv_xml, tv_paths, f"{tmp}/tv.xml")
print("Movies paths:", movie_paths)
print("TV paths:", tv_paths)
PY

install_config() {
  local rel="$1"
  local src="$2"
  local host="$JELLYFIN_CONFIG/$rel"
  local container="/config/$rel"

  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$JELLYFIN_CONTAINER"; then
    docker exec -u root -i "$JELLYFIN_CONTAINER" tee "$container" >/dev/null <"$src"
    return
  fi
  if sudo -n tee "$host" >/dev/null <"$src" 2>/dev/null; then
    return
  fi
  echo "Could not install $host (owned by root). Start Jellyfin or run with sudo." >&2
  exit 1
}

install_config "root/default/Movies/options.xml" "$TMP/movies.xml"
install_config "root/default/TV Shows/options.xml" "$TMP/tv.xml"

COMPOSE_DIR="$ROOT/deploy/nas"
if [[ -f "$NAS_ENV" ]]; then
  (cd "$COMPOSE_DIR" && docker compose --env-file .env up -d jellyfin) 2>/dev/null || \
    echo "Recreate Jellyfin: cd deploy/nas && docker compose --env-file .env up -d jellyfin"
fi

echo "Then Jellyfin → Dashboard → Libraries → Scan all libraries."
