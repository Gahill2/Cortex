# Canva and Cortex

Short guide for developers: what Canva officially offers, how the CLI fits in, and what Cortex does today.

## What Canva officially supports (third-party surfaces)

| Surface | What it is | Typical use |
|--------|------------|-------------|
| **Apps SDK** | Your code runs **inside an iframe in the Canva editor** (side panel). Canva injects APIs (`@canva/design`, `@canva/asset`, `@canva/user`, etc.). | Build a **Canva app** that users install from the marketplace (or sideload in dev). **Not** a way to embed the full Canva editor inside your own website. |
| **Connect APIs** | REST-style APIs for **programmatic access** to designs/assets where your product integrates with Canva’s platform (OAuth, app registration, review). | Server-backed flows (export, asset libraries, enterprise-style integrations). Governed by developer terms and a shared responsibility model. |
| **Embeds (user-facing)** | Canva Help Center documents **embedding published designs** on a site via embed code / smart embed (visibility rules apply). | End users embed **their** public (or enterprise private) designs—distinct from building an Apps SDK app. |

**Important:** Cortex is a **separate web/desktop shell**. It does **not** embed the Canva editor. Using Canva “design elements” in product UI means either (a) assets your app is licensed to use, (b) user-supplied exports/embeds, or (c) a **Canva app** you ship that runs **inside** Canva—not an iframe of Canva inside Cortex. Follow [Canva API and App Developer Terms](https://www.canva.com/policies/api-developer-terms/) and product terms for any integration.

Official entry points:

- [Canva Developers](https://www.canva.com/developers/)
- [Apps SDK — Integrating with Canva](https://www.canva.dev/docs/apps/integrating-canva/)
- [Connect APIs](https://www.canva.dev/docs/connect/)

## CLI: local setup (interactive login)

`canva login` **requires a human in the loop** (browser/device auth). Do **not** run it in CI or unattended pipelines.

**Option A — no global install (recommended in this repo):** from the repo root:

```bash
npm run canva -- login
```

**Option B — global CLI:**

```bash
npm install -g @canva/cli@latest
canva login
```

Create a new app (still local; may prompt for org/app choices):

```bash
npm run canva -- apps create "My New App" --template="hello_world" --distribution="public" --git --installDependencies
cd my-new-app
npm start
```

If `canva apps create` asks questions you cannot answer non-interactively, run the same command in an interactive terminal.

**Secrets:** never commit tokens, refresh tokens, or `.env` files from the Canva app folder. Add generated app paths to `.gitignore` if you keep a local scaffold outside this repo.

## What Cortex does today

- **Settings → Integrations → Canva:** reads **`GET /api/canva/status`** (authenticated) for server-side env flags and Connect link state; **Link Connect (OAuth)** appears only when `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, and `CANVA_REDIRECT_URI` are all set on the API server. After a successful OAuth round-trip, tokens are stored per user in `OAuthToken` with `provider = "canva"` (server only).
- **Public checks (no secrets in the body):**
  - **`GET /api/health`** — includes `canva_configured` booleans (whether relevant env vars are non-empty).
  - **`GET /api/canva/health-env`** — minimal booleans for dev sanity checks.

### Connect OAuth — redirect URL to register

Canva’s Connect docs require that **`redirect_uri` in the authorize URL** matches an **allowed redirect URL** in the Developer Portal for your Connect integration.

Default on the Cortex API (override with `CANVA_REDIRECT_URI`):

`http://localhost:4000/api/canva/oauth/callback`

For production or Tailscale, set `CANVA_REDIRECT_URI` to the HTTPS (or HTTP) URL that points at this route and register that **exact** string in the portal.

Authorize URL format (reference): [Connect — Authentication](https://www.canva.dev/docs/connect/authentication/) (`https://www.canva.com/api/oauth/authorize?…`).

### Server env (Apps SDK + Connect)

Set these in **`backend/.env`** (never commit). Names align with the [Canva CLI / app scaffold `.env`](https://www.canva.dev/docs/apps/integrating-canva/) and [Connect integrations](https://www.canva.dev/docs/connect/creating-integrations/):

| Variable | Role |
|----------|------|
| `CANVA_APP_ID` | Apps SDK app ID from the developer portal / CLI. |
| `CANVA_APP_ORIGIN` | Hosted app origin (often `https://app-….canva-apps.com`). |
| `CANVA_HMR_ENABLED` | CLI/local dev flag (`true` / `false`) for hot reload in the editor. |
| `CANVA_CLIENT_ID` | Connect OAuth **client id** (`OC-…`). |
| `CANVA_CLIENT_SECRET` | Connect OAuth **client secret** (`cnvca…`) — **server only**. |
| `CANVA_REDIRECT_URI` | Must match portal + the callback route above. |
| `CANVA_CONNECT_SCOPES` | Space-separated scopes; must be enabled for the integration (default `design:meta:read`). See [scopes appendix](https://www.canva.dev/docs/connect/appendix/scopes/). |

## Optional frontend env

In `frontend/.env` (local only; not committed):

```bash
# Optional: Canva app ID from the developer portal (labeling / parity with Vite; server uses CANVA_APP_ID)
VITE_CANVA_APP_ID=
```

Rebuild the frontend after changing env: `npm run build --prefix frontend`.

## Future hook (sketch)

A defensible path for “use Canva design elements” with Cortex:

1. Build a **Canva app** with the CLI; implement asset/design actions with the Apps SDK **inside Canva**.
2. If you need Cortex ↔ Canva server data, use **Connect OAuth** on this API (see above), keep secrets only on the server, and call Connect REST endpoints from the backend (not from the browser).

Next steps after linking: call [Connect API](https://www.canva.dev/docs/connect/) resources with the stored bearer token (refresh flow can mirror the [generate access token](https://www.canva.dev/docs/connect/api-reference/authentication/generate-access-token/) docs).
