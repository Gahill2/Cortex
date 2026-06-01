# iCloud Photos → local (icloudpd)

Apple does **not** let third-party apps log into iCloud Drive the way Nextcloud works. This stack **downloads your iCloud Photo library** to disk so **Immich** (or backups) can use it.

This is **not** a live two-way sync with Apple — it pulls photos on a schedule.

## Prerequisites

1. [App-specific password](https://appleid.apple.com/account/manage) (if using non-MFA mode), **or**
2. **MFA mode** (default) — one interactive login to store a session cookie in `/config`.

## First-time login (MFA)

```bash
cd deploy/nas/icloudpd
cp .env.example .env
# Edit ICLOUD_APPLE_ID

docker compose --env-file .env run --rm icloudpd sync-icloud.sh --Initialise
```

Follow prompts (Apple ID password + 2FA code). Then:

```bash
docker compose --env-file .env up -d
```

Photos land in: `NAS_DATA_ROOT/photos/icloud-import/`

## Wire into Immich

1. Open Immich → **Administration → External Libraries**
2. Add library path (inside Immich container this is under `/data`):
   - Host: `/home/greyhill/nas-data/photos/icloud-import`
   - Immich path: `/data/icloud-import` (create symlink or adjust Immich `UPLOAD_LOCATION` layout)
3. Or copy imports into main library after sync.

## Cortex “Cloud” tab

That is **Nextcloud** (files), not Apple iCloud. Use:

- **Files** → Cortex **Cloud** / Nextcloud `:8081`
- **Photos** → Immich `:2283` + this icloudpd import

## Related

- [deploy/nas/immich/](../immich/) — photo library UI
- [docs/nas-homelab-layout.md](../../../docs/nas-homelab-layout.md)
