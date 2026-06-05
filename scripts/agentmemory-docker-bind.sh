#!/usr/bin/env bash
# Patch agentmemory iii-config so Docker (host.docker.internal) can reach :3111.
# Default iii binds 127.0.0.1 only — containers cannot connect.
set -euo pipefail

find_iii_config() {
  local f
  for f in \
    "$HOME/.npm/_npx"/*/node_modules/@agentmemory/agentmemory/dist/iii-config.yaml \
    "$(npm root -g 2>/dev/null)/@agentmemory/agentmemory/dist/iii-config.yaml" \
    ; do
    [[ -f "$f" ]] || continue
    echo "$f"
    return 0
  done
  return 1
}

CONFIG="$(find_iii_config)" || {
  echo "[agentmemory-docker-bind] No iii-config.yaml yet (run agentmemory once)" >&2
  exit 0
}

python3 - "$CONFIG" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
lines = path.read_text().splitlines()
in_http = in_stream = False
changed = 0
out = []
for line in lines:
    if "- name: iii-http" in line:
        in_http, in_stream = True, False
    elif "- name: iii-stream" in line:
        in_http, in_stream = False, True
    elif line.strip().startswith("- name:"):
        in_http = in_stream = False
    if (in_http or in_stream) and "host: 127.0.0.1" in line:
        line = line.replace("127.0.0.1", "0.0.0.0")
        changed += 1
    out.append(line)
path.write_text("\n".join(out) + "\n")
print(f"[agentmemory-docker-bind] {path} ({changed} host line(s) → 0.0.0.0)")
PY
