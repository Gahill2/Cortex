# Tailscale hub (InsForge + Cortex)

One always-on machine on your tailnet runs Postgres, InsForge, and optionally Cortex API/UI. All other devices connect over Tailscale — no local database.

**Full guide:** [docs/insforge-tailscale.md](../../docs/insforge-tailscale.md)

```bash
npm run hub:sync
cp .env.example .env && cp env/api.env.example env/api.env
# edit TAILSCALE_HOST + secrets
npm run hub:up
```

On Linux hub without npm scripts: `bash scripts/tailscale-hub-up.sh`
