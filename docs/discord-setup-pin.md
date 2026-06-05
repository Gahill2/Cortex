# Discord `#setup` — copy/paste pins

Full guide (permanent): **[tailscale-family-setup.md](./tailscale-family-setup.md)**

---

## Welcome channel (post above `#setup`)

Copy into `#welcome`, `#general`, or the category description:

```text
👋 Welcome to the Witness Protection Program

WPP is our private homelab—movies, files, and photos hosted at home, shared only with people we invite. Nothing here is on the public internet; you reach it through Tailscale (a small VPN app), like a secret tunnel back to the house.

Behind the scenes: Greyhill’s server (cortex) runs the apps; Joey’s homelab feeds extra movies into Jellyfin when his PC is on. You only set up Tailscale once, then use the same links everyone else uses.

What you get after setup:
🎬 Jellyfin — watch movies & TV
📁 Nextcloud — your own upload/download folder
📷 Immich (optional) — photos

⬇️ New witness? Go to #setup
Read the pinned messages in order (invite → Tailscale Connect → app links).

Need a Jellyfin or Nextcloud login? Ask here or DM an admin—never post passwords in chat.
```

---

## Pin 1 — Welcome (post first)

```text
📡 WITNESS PROTECTION PROGRAM — SETUP (read pins in order)

You’re joining our private homelab: Jellyfin, Nextcloud, and more on Greyhill’s server, plus Joey’s movies when his PC is online—all over one Tailscale connection.

Invite only. Follow the pins below.

Questions → ask in #homelab-help (no passwords in chat).
```

---

## Pin 2 — Get on the network (invite)

**Admin:** Generate invite at https://login.tailscale.com/admin/users → paste your link below.

```text
🔗 STEP 1 — JOIN OUR PRIVATE NETWORK

1) Open this invite link (admin posts current link here):
   → PASTE_INVITE_LINK_HERE

2) Sign in and accept joining the tailnet.

3) Install Tailscale on your phone/PC when prompted:
   • iPhone: App Store → "Tailscale"
   • Android: Play Store → "Tailscale"
   • PC/Mac: https://tailscale.com/download

4) Open Tailscale → turn CONNECT on (must stay on to use Jellyfin/Nextcloud).
```

---

## Pin 3 — Your apps (everyone)

```text
📺 STEP 2 — OPEN APPS (Tailscale must be Connected)

Movies & TV (Jellyfin):
  http://jellyfin.cortex:8096
  → Login: ask admin for your Jellyfin username/password

Files (Nextcloud):
  http://cloud.cortex:8081
  → Login: ask admin for your personal (non-admin) account

Photos (Immich, optional):
  http://photos.cortex:2283

If links don't work, use IP fallback (admin updates when needed):
  Jellyfin:    http://100.104.120.29:8096
  Nextcloud:   http://100.104.120.29:8081
  Immich:      http://100.104.120.29:2283

Mobile apps: add the same URLs as "server address" in Jellyfin / Nextcloud apps.
```

---

## Pin 4 — Why Tailscale? (short)

```text
❓ WHY TAILSCALE?

• Private encrypted tunnel into WPP—like home Wi-Fi from anywhere (Greyhill’s apps + Joey’s library when online).
• No random port forwarding on the router; only invited people get access.
• Friendly names (jellyfin.cortex) work when "Use Tailscale DNS" is on in the app.

Troubleshooting:
  • Page won't load → check Tailscale shows Connected
  • Android ads/DNS → Settings → Private DNS → Off
  • iPhone → disable iCloud Private Relay while testing

Full doc (admins): docs/tailscale-family-setup.md in Cortex repo
```

---

## Discord bot (optional)

The **WPP Discord bot** welcomes new members in `#setup` and adds slash commands (`/wpp-status`, `/wpp-links`, admin container control). Setup: [discord-bot.md](./discord-bot.md).

---

## Suggested channel layout

| Channel | Purpose |
|---------|---------|
| `#setup` | Pins + bot welcome messages |
| `#homelab-help` | Questions, broken links, password resets |
| `#admin` | Invite links, IP updates, credentials (private) |

**Do not post** admin passwords, qBittorrent/Radarr links, or Pi-hole admin in `#setup`.
