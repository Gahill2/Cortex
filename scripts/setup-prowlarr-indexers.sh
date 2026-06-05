#!/usr/bin/env bash
# Add public torrent indexers to Prowlarr and sync to Radarr/Sonarr.
# Run: npm run media:setup-indexers
set -euo pipefail

NAS_ROOT="${NAS_DATA_ROOT:-/mnt/cortex/nas-data}"
PKEY="$(grep -oP '(?<=<ApiKey>)[^<]+' "$NAS_ROOT/appdata/prowlarr/config.xml" | head -1)"

export PKEY
python3 <<'PY'
import json, os, urllib.request, urllib.error

PKEY = os.environ["PKEY"]

def req(url, method="GET", data=None):
    h = {"X-Api-Key": PKEY, "Content-Type": "application/json"}
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=90) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode(errors="replace")[:300]
        return {"_err": e.code, "_body": err}

schema = req("http://127.0.0.1:9696/api/v1/indexer/schema")
existing = {i["name"] for i in req("http://127.0.0.1:9696/api/v1/indexer")}

# (implementation, schema name, cardigann definition)
INDEXERS = [
    ("Cardigann", "YTS", "yts"),
    ("Cardigann", "LimeTorrents", "limetorrents"),
    ("TorrentsCSV", "TorrentsCSV", None),
    ("Cardigann", "TorrentDownload", "torrentdownload"),
    ("Cardigann", "The Pirate Bay", "thepiratebay"),
    ("Cardigann", "EZTV", "eztv"),
]

def find_schema(impl, name):
    for s in schema:
        if s.get("implementation") == impl and s.get("name") == name:
            return json.loads(json.dumps(s))
    return None

for impl, name, definition in INDEXERS:
    if name in existing:
        print(f"OK (exists) {name}")
        continue
    idx = find_schema(impl, name)
    if not idx:
        print(f"SKIP missing schema: {name}")
        continue
    idx["enable"] = True
    idx["appProfileId"] = 1
    if definition:
        for f in idx.get("fields", []):
            if f.get("name") == "definition":
                f["value"] = definition
    out = req("http://127.0.0.1:9696/api/v1/indexer", "POST", idx)
    if "_err" in out:
        print(f"FAIL {name}: HTTP {out['_err']}")
    else:
        print(f"Added {name}")
        existing.add(name)

req("http://127.0.0.1:9696/api/v1/indexer/sync", "POST", {})
print("Synced indexers → Radarr / Sonarr")
for i in req("http://127.0.0.1:9696/api/v1/indexer"):
    print(f"  • {i['name']}")
PY

echo "[indexers] Open Prowlarr: http://$(tailscale ip -4 2>/dev/null || echo 127.0.0.1):9696/settings/indexers"
