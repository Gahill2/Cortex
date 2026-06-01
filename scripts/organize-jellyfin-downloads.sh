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
  # Strip release-group junk for folder title
  sed -E 's/ \[[^]]+\]$//; s/ \([^)]*\)$//' <<< "$1" | sed 's/[[:space:]]*$//'
}

move_movie_file() {
  local src="$1"
  local base
  base="$(basename "$src")"
  local title="${base%.*}"
  title="$(clean_name "$title")"
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

shopt -s nullglob
for item in "$DL"/*; do
  if [[ -f "$item" ]]; then
    if is_safe_media "$item"; then
      organize_tv_episode "$item" || move_movie_file "$item"
    else
      echo "DELETE unsafe: $item"
      rm -f "$item"
    fi
    continue
  fi
  [[ -d "$item" ]] || continue
  shopt -s nullglob
  for f in "$item"/*.{mp4,mkv,avi,m4v,mov,webm} "$item"/*/*.{mp4,mkv,avi,m4v}; do
    [[ -f "$f" ]] || continue
    is_safe_media "$f" || { rm -f "$f"; continue; }
    organize_tv_episode "$f" || move_movie_file "$f"
  done
  # Remove empty torrent folders and junk (subs-only dirs stay if non-empty)
  find "$item" -type d -empty -delete 2>/dev/null || true
  rmdir "$item" 2>/dev/null || true
done

echo "Done. Scan libraries in Jellyfin: Dashboard → Libraries → Scan."
