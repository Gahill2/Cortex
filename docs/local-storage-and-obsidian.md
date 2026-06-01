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

# 1) Partition, format, mount (ERASES /dev/sdb)
npm run storage:setup

# 2) Create vault + update homelab env
npm run storage:vault

# 3) Sync sidecar into Docker data dir
npm run server:sync-local

# 4) Redeploy API (new vault bind mount)
npm run server:deploy
# or Homelab → Redeploy now
```

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

Point Obsidian at the same folder:

```text
/mnt/cortex/obsidian/greyhill_brain
```

Edits on disk are what Cortex indexes; restart is not required for every file (index refreshes on search/graph).

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
