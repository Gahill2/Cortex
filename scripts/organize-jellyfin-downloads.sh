#!/usr/bin/env bash
# Move finished qBittorrent downloads into Jellyfin library folders.
# Usage: NAS_DATA_ROOT=/home/greyhill/nas-data ./scripts/organize-jellyfin-downloads.sh
set -euo pipefail

ROOT="${NAS_DATA_ROOT:-/home/greyhill/nas-data}"
DL="$ROOT/media/downloads"
MOVIES="$ROOT/media/movies"
TV="$ROOT/media/tv"

mkdir -p "$DL" "$MOVIES" "$TV"

is_video() {
  case "${1,,}" in
    *.mp4|*.mkv|*.avi|*.m4v|*.mov|*.webm) return 0 ;;
    *) return 1 ;;
  esac
}

# Reject executables masquerading as media (.scr, .exe, etc.)
is_safe_media() {
  local f="$1"
  is_video "$f" || return 1
  if file -b "$f" 2>/dev/null | grep -qiE 'executable|MS Windows|PE32'; then
    echo "SKIP (not video, possible malware): $f"
    return 1
  fi
  return 0
}

clean_name() {
  local raw="$1"
  raw="$(sed -E 's/ \[[^]]+\]//g; s/ \{[^}]+\}//g; s/www\.UIndex\.org[[:space:]]*-[[:space:]]*//Ig' <<< "$raw")"
  # Drop release tags in parens (1080p, 5.1) but keep (YYYY)
  raw="$(sed -E 's/ \([^)]*[A-Za-z][^)]*\)//g' <<< "$raw")"
  raw="$(sed -E 's/[._]+/ /g' <<< "$raw")"
  if [[ "$raw" =~ ^(.+)[[:space:]]([12][0-9]{3})$ ]]; then
    echo "${BASH_REMATCH[1]} (${BASH_REMATCH[2]})"
    return
  fi
  sed -E 's/ +/ /g;s/^ | $//g' <<< "$raw"
}

move_movie_file() {
  local src="$1"
  local base parent title
  base="$(basename "$src")"
  parent="$(basename "$(dirname "$src")")"
  if [[ "$parent" != "downloads" && "$parent" != "incomplete" && "$parent" != "complete" ]]; then
    title="$(clean_name "$parent")"
  else
    title="$(clean_name "${base%.*}")"
  fi
  local dest_dir="$MOVIES/$title"
  mkdir -p "$dest_dir"
  local ext="${base##*.}"
  mv -n "$src" "$dest_dir/$title.$ext"
  echo "MOVIE → $dest_dir/$title.$ext"
}

organize_tv_episode() {
  local src="$1"
  local base
  base="$(basename "$src")"
  local show season_num season_dir

  # Show.Name.S01E01... or Show Name - S01E01...
  if [[ "$base" =~ ^(.+)\.[Ss]([0-9]{1,2})[Ee]([0-9]{1,2}) ]]; then
    show="${BASH_REMATCH[1]}"
    show="${show//./ }"
    season_num="${BASH_REMATCH[2]}"
    season_dir="$TV/$show/Season $(printf '%02d' "$((10#$season_num))")"
    mkdir -p "$season_dir"
    mv -n "$src" "$season_dir/$base"
    echo "TV → $season_dir/$base"
    return 0
  fi
  if [[ "$base" =~ ^(.+[[:space:]]+-[[:space:]]+S[0-9]{2}E[0-9]{2}) ]]; then
    show="${BASH_REMATCH[1]}"
    show="${show%% - S*}"
    season_dir="$TV/$show/Season 01"
    mkdir -p "$season_dir"
    mv -n "$src" "$season_dir/$base"
    echo "TV → $season_dir/$base"
    return 0
  fi
  return 1
}

process_video() {
  local f="$1"
  is_safe_media "$f" || { rm -f "$f"; return; }
  organize_tv_episode "$f" || move_movie_file "$f"
}

shopt -s nullglob globstar
# Top-level loose files
for item in "$DL"/*; do
  [[ -f "$item" ]] || continue
  process_video "$item"
done
# All videos under download folders (any depth; skips tiny junk)
while IFS= read -r -d '' f; do
  [[ "$(stat -c%s "$f" 2>/dev/null || echo 0)" -gt 50000000 ]] || continue
  case "$f" in
    */Subtitle,info/*|*/Sample/*|*sample*) continue ;;
  esac
  process_video "$f"
done < <(find "$DL" -mindepth 2 -type f \( -iname '*.mp4' -o -iname '*.mkv' -o -iname '*.avi' -o -iname '*.m4v' -o -iname '*.mov' -o -iname '*.webm' \) -print0 2>/dev/null)

# Remove empty torrent folders
find "$DL" -mindepth 1 -type d -empty -delete 2>/dev/null || true

echo "Done. Scan libraries in Jellyfin: Dashboard → Libraries → Scan."
