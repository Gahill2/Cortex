# Easier domain for Cortex (Tailscale + Google OAuth)

Google OAuth **does not allow** raw IPs (`100.x.x.x`) or plain HTTP. You need **HTTPS + a domain name**.

## Option 1 — Shorter Tailscale name (free, no new domain)

Your machine is already **`cortex`**. The long part is the tailnet slug (`tail4f977b`).

1. [Tailscale admin → DNS](https://login.tailscale.com/admin/dns)
2. Under **Tailnet DNS name**, if offered, choose or generate a **memorable** name (e.g. `greyhill.ts.net` instead of `tail4f977b.ts.net`)
3. Enable **HTTPS certificates** and **MagicDNS**
4. On cortex:
   ```bash
   tailscale serve --bg 8080
   ```
5. Open: **`https://cortex.YOUR-TAILNET.ts.net`**

Update Google OAuth redirect URI to match:
`https://cortex.YOUR-TAILNET.ts.net/api/gmail/oauth/callback`

Run `./scripts/configure-homelab-https.sh` after Serve is on (it reads MagicDNS automatically).

---

## Option 2 — Your own domain (best UX, e.g. `cortex.greyhill.com`)

You need a domain you control (Cloudflare, Porkbun, Namecheap, etc.).

### A. DNS (Tailscale-only — not public internet)

In [Tailscale admin → DNS → Nameservers](https://login.tailscale.com/admin/dns):

- Add a **Split DNS** or **Extra record** so your subdomain resolves to this machine’s Tailscale IP (`100.104.120.29`) **for devices on your tailnet only**.

Example extra record:

| Name | Type | Value |
|------|------|--------|
| `cortex.greyhill.com` | A | `100.104.120.29` |

Or use **NextDNS / Cloudflare** as tailnet nameserver with a rewrite (see [Tailscale custom DNS notes](https://tailscale.com/kb/1054/dns)).

### B. HTTPS (Caddy + Let’s Encrypt)

Tailscale’s built-in certs only cover `*.ts.net`. For **your** domain, run Caddy on the cortex host:

```bash
# Example — see deploy/homelab/caddy/ when added
# Caddy obtains cert via DNS-01 (Cloudflare API token) or HTTP-01 if you expose 80 publicly
```

### C. Google Cloud Console

| Setting | Value |
|---------|--------|
| Authorized JavaScript origins | `https://cortex.greyhill.com` |
| Authorized redirect URIs | `https://cortex.greyhill.com/api/gmail/oauth/callback` |
| OAuth consent → Authorized domains | `greyhill.com` |

### D. Cortex env

In `deploy/homelab/env/api.env`:

```env
CORTEX_FRONTEND_URL=https://cortex.greyhill.com
GOOGLE_REDIRECT_URI=https://cortex.greyhill.com/api/gmail/oauth/callback
CORS_ORIGINS=https://cortex.greyhill.com,...
```

Restart API: `cd deploy/homelab && docker compose --env-file .env up -d cortex-api`

---

## Option 3 — Public subdomain (optional, if you want access outside Tailscale)

Use **Cloudflare Tunnel** or **Tailscale Funnel** with a real domain — heavier setup; only needed if non-Tailscale users must reach Cortex.

For personal homelab, **Option 1 or 2 on tailnet only** is enough.

---

## Quick comparison

| Approach | Example URL | Google OAuth | Effort |
|----------|-------------|--------------|--------|
| Tailscale MagicDNS + Serve | `https://cortex.tail4f977b.ts.net` | ✅ | Low |
| Nicer tailnet name | `https://cortex.greyhill.ts.net` | ✅ | Low |
| Own subdomain | `https://cortex.greyhill.com` | ✅ | Medium (DNS + Caddy) |
| Raw IP `:8080` | `http://100.x.x.x:8080` | ❌ Blocked |

---

## Current cortex host

| Item | Value |
|------|--------|
| Tailscale IP | `100.104.120.29` |
| MagicDNS | `cortex.tail4f977b.ts.net` |
| Target OAuth redirect | `https://cortex.tail4f977b.ts.net/api/gmail/oauth/callback` |

After any domain change, re-run `./scripts/configure-homelab-https.sh` and update Google OAuth console to match.
