# Jellyfin: your server + his server (CIFS over Tailscale)

Jellyfin on **cortex** reads from **two roots**:

| Source | Container path | Host path |
|--------|----------------|-----------|
| **Your server** (cortex disk) | `/media/movies`, `/media/tv` | `NAS_DATA_ROOT/media/...` |
| **His server** (CIFS) | `/media-remote/movies`, `/media-remote/tv` | `/mnt/cortex/jellyfin-remote/...` |

Both paths are already configured in Jellyfin’s Movies and TV libraries. You only need to **mount his CIFS shares** and **recreate** the Jellyfin container so `/media-remote` exists.

## On his Windows PC (Steve)

Folder: `C:\Users\Steve\Videos\Movies`

1. **Settings → Network → Advanced sharing** → turn on file and printer sharing.
2. His PC shares **`Users`** (not a separate `Movies` share). Movies live at `Steve/Videos/Movies` inside it — set `JELLYFIN_REMOTE_SMB_PREFIXPATH` in `.remote-storage.env`.
3. **Permissions** → give **Steve** (or Everyone read-only) read access.
4. `JELLYFIN_REMOTE_SMB_USER` must be his **Windows sign-in name** (`Steve`), not another name.
5. Tailscale running (`zoaurc` at `100.118.7.128`).

Verify from cortex: `npm run nas:remote-storage:list-shares` — you should see `Movies` in the list, not only `C$` / `ADMIN$`.

## On cortex

```bash
cp deploy/nas/.remote-storage.env.example deploy/nas/.remote-storage.env
# Edit: host, share name(s), user, password

npm run nas:remote-storage:list-shares   # confirm share names
npm run nas:remote-storage:mount         # CIFS mount (sudo)
npm run nas:jellyfin:library-paths
npm run nas:jellyfin:recreate            # if "permission denied" on docker stop
# or: npm run server:docker:fix-once       # cortex-api/web only
```

Then in Jellyfin: **Dashboard → Libraries → Scan all libraries**.

### If his movies still do not appear

Jellyfin sometimes ignores a second folder path until added in the UI. Use the **bind-link** workaround (his files appear under your existing Movies library):

```bash
npm run nas:remote-storage:mount
npm run nas:jellyfin:link-remote
npm run nas:jellyfin:recreate
# Dashboard → Libraries → Movies → Scan library
```

His titles show under folder **Steve-Movies** inside Movies.

## One share vs two shares

**One CIFS share** with `movies/` and `tv/` inside:

```env
JELLYFIN_REMOTE_SMB_SHARE=Media
```

**Two CIFS shares**:

```env
JELLYFIN_REMOTE_SMB_SHARE=
JELLYFIN_REMOTE_SMB_SHARE_MOVIES=Movies
JELLYFIN_REMOTE_SMB_SHARE_TV=TV
```

## Verify

```bash
mount | grep jellyfin-remote
docker exec cortex-nas-jellyfin-1 ls /media /media-remote
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `NT_STATUS_ACCESS_DENIED` | Wrong user/password or share permissions on Windows |
| `mount` works but Jellyfin empty | Scan libraries; check folder names match `/media-remote/movies` and `/media-remote/tv` |
| No `/media-remote` in container | `docker compose up -d --force-recreate jellyfin` after mount point exists |
| Host offline | `tailscale status` — use the peer’s current Tailscale IP |

Credentials live in `deploy/nas/.remote-storage.env` and `.remote-storage.creds` (gitignored).
