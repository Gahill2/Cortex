# Local 512GB disk + Obsidian Notes on this PC

Cortex **Notes** reads a local Obsidian vault (markdown on disk). AI search, graph, capture, and backlinks all use that folder — same workflow as before, but stored on this machine instead of a Windows path or the git repo.

## Your disks (cortex PC)

| Device | Model | Role |
|--------|--------|------|
| **/dev/sda** | Micron 512GB | System disk — Ubuntu on `/` |
| **/dev/sdb** | SanDisk 512GB | **Data disk** — was one NTFS partition, unused until you run setup |

Homelab was incorrectly mounting the **whole Cortex repo** as the vault (`OBSIDIAN_VAULT_HOST_PATH=/home/greyhill/Documents/Cortex`). That is fixed by pointing at a real vault on `/mnt/cortex/obsidian/greyhill_brain`.

## Partition plan (after setup)

```text
/dev/sdb
├── sdb1  ~220 GiB  ext4  label=cortex-obsidian
│         └── /mnt/cortex/obsidian/
│                 └── greyhill_brain/     ← Obsidian vault (Cortex Notes)
└── sdb2  ~256 GiB  ext4  label=cortex-archive
          └── /mnt/cortex/archive/
                  ├── backups/
                  ├── media/
                  ├── exports/
                  └── docker-volumes/   (optional future use)
```

`/etc/fstab` entries are added so both mount at boot.

## One-time setup (run in a terminal on this PC)

Needs **sudo** (password prompt). Do not run from a non-interactive agent shell.

```bash
cd /home/greyhill/Documents/Cortex

# 1) Partition, format, mount (ERASES /dev/sdb — wipes old NTFS)
npm run storage:setup
# Type YES when prompted

# 2) Create vault + update homelab env
npm run storage:vault

# 3) Move Jellyfin / Radarr / Sonarr / Pi-hole data to the big archive partition
npm run nas:migrate-to-archive
# Type YES — stops media containers, rsyncs ~/nas-data → /mnt/cortex/archive/nas-data

# 4) Start NAS stacks on the new disk
cd deploy/nas/pihole && docker compose --env-file .env up -d
cd ../.. && cd deploy/nas && docker compose --env-file .env up -d
cd ../nas/media-stack && docker compose --env-file .env up -d

# 5) Sync sidecar + redeploy Cortex API (Obsidian vault)
npm run server:sync-local
npm run server:deploy
```

After step 3 you have **~256 GB** on `/mnt/cortex/archive` for movies/TV (plus **~220 GB** on obsidian partition for notes).

Preview only:

```bash
npm run storage:setup -- --dry-run
```

## Verify

```bash
df -h /mnt/cortex/obsidian /mnt/cortex/archive
ls /mnt/cortex/obsidian/greyhill_brain
curl -s http://127.0.0.1:8080/api/health | jq '.obsidian_vaults'
```

In the app: **Notes** → vault path should be `/mnt/cortex/obsidian/greyhill_brain` (or bind as `/vault` inside the API container).

## Obsidian desktop (optional)

Install on this PC:

```bash
sudo snap install obsidian --classic
```

Point Obsidian at the same folder:

```text
/mnt/cortex/obsidian/greyhill_brain
```

Edits on disk are what Cortex indexes; restart is not required for every file (index refreshes on search/graph).

## GitHub vault (greyhill_brain)

Your Windows path was `Documents\GitHub\greyhill_brain`. On this PC:

```bash
# One-time: GitHub auth (SSH recommended)
ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null
# Add your deploy key or personal key to GitHub, then:

# Add ~/.ssh/id_ed25519.pub to https://github.com/settings/keys first, then:
npm run vault:clone
# (default remote: git@github.com:Gahill2/greyhill_brain.git)

# Or copy from another machine over Tailscale/SSH:
npm run vault:clone -- --from /path/to/greyhill_brain

cd deploy/homelab && docker compose --env-file .env up -d --force-recreate cortex-api
```

Without a repo URL, `npm run vault:clone` scaffolds an empty vault (`storage:vault`) so Cortex Notes works immediately; clone when you have Git access.

## Claude + consistent LLM memory

| Layer | What it does |
|--------|----------------|
| **Cortex → AI** | Talk to Claude (Anthropic key in `api.env`); exchanges append to `Cortex/AI Log.md` in the vault when `OBSIDIAN_AI_LOG_ENABLED=true`. |
| **Cortex → Notes** | Search, graph, capture over the same vault files. |
| **agentmemory** | Cross-session facts (`remember` / `recall`) — same `AGENTMEMORY_PROJECT=cortex` on every machine. |
| **Cursor** | `@agentmemory-remember` etc. after `npm run sync:agentmemory-skills:sh`; MCP: `npx -y @agentmemory/mcp`. |

Homelab (always-on memory server):

```bash
npm run server:memory:setup
npm run sync:agentmemory-skills:sh
```

Dev (all three ports):

```bash
npm run dev:stack   # API + UI + agentmemory :3111
```

In the app: **Settings → Memory** for unified search (vault + agentmemory) and MCP config snippet.

## Migrating from Windows / old vault

If you have notes on another PC or on the old NTFS partition:

1. Before `storage:setup`, mount NTFS read-only and copy:
   ```bash
   sudo mkdir -p /mnt/ntfs-old
   sudo mount -o ro /dev/sdb1 /mnt/ntfs-old
   rsync -av /mnt/ntfs-old/YourVault/ /mnt/cortex/obsidian/greyhill_brain/
   sudo umount /mnt/ntfs-old
   ```
2. Or copy from `C:\Users\greyh\Documents\GitHub\greyhill_brain` over Tailscale/SSH.

## Dev without Docker

```bash
# backend/.env
OBSIDIAN_VAULT_PATH=/mnt/cortex/obsidian/greyhill_brain
```

Then `npm run dev:backend` and open Notes on port 5173.

## Different disk

```bash
CORTEX_STORAGE_DISK=/dev/nvme1n1 npm run storage:setup
```

## Troubleshooting

| Issue | Fix |
|--------|-----|
| Notes empty / wrong path | Run `storage:vault`, redeploy API, check `deploy/homelab/.env` `OBSIDIAN_VAULT_HOST_PATH` |
| Permission denied on `/mnt/cortex` | Re-run setup script (sets owner to your user) |
| Docker still sees old path | `npm run server:sync-local` then recreate `cortex-api` container |
| Disk not sdb | `lsblk` and set `CORTEX_STORAGE_DISK` |
