# Nextcloud — family / non-admin users

Anyone with the URL and an account can upload and download **their own files**. They do not get admin unless you put them in the `admin` group.

**Witness Protection Program onboarding:** [tailscale-family-setup.md](./tailscale-family-setup.md) · Discord pins: [discord-setup-pin.md](./discord-setup-pin.md)

## URLs to share

| Network | URL |
|---------|-----|
| Pi-hole DNS | http://cloud.cortex:8081 |
| Tailscale IP | http://100.104.120.29:8081 |
| Home LAN | http://10.0.0.49:8081 |

Devices must reach the server (Tailscale on, or home Wi‑Fi). Pi-hole DNS is optional but makes the link easier.

## Create a user (web UI)

1. Log in as **admin** (password in `deploy/nas/.env`: `NEXTCLOUD_ADMIN_USER` / `NEXTCLOUD_ADMIN_PASSWORD`).
2. Click your avatar (top right) → **Users**.
3. **Add user** → username + display name + password (or “Send email” if mail is configured).
4. Leave **Administrator** unchecked.
5. Optional: set **Storage quota** (e.g. `50 GB`) per user.

That user can sign in, use Files, upload, download, and share links from their account only.

## Create a user (CLI)

```bash
npm run nas:nextcloud:user -- --user steve --password 'ChooseAStrongPassword' --display-name "Steve"
```

## What regular users can and cannot do

| Can | Cannot (unless you grant it) |
|-----|------------------------------|
| Upload / download in their home folder | Change server settings |
| Share files/folders they own | See other users’ files |
| Use Nextcloud apps you enable | Install apps (admin only) |

## Cortex “Cloud” tab vs Nextcloud login

The **Cortex app Cloud tab** uses the admin (or one service account) in `deploy/homelab/env/api.env` (`NEXTCLOUD_USERNAME` / `NEXTCLOUD_PASSWORD`). That is separate from family logins on http://cloud.cortex:8081.

## Trusted domain errors

If login works on IP but fails on `cloud.cortex`, run:

```bash
npm run nas:nextcloud:trusted-domains
```

## Optional: shared folder for everyone

Admin → **Files** → create folder → **Share** → share with specific users or a group. Do not share the whole server as “public upload” unless you intend open uploads.
