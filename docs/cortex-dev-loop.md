# Cortex autonomous dev loop

Checklist for overnight / unattended iteration. Each loop pass: pick the **first unchecked** item, implement, deploy homelab if API/web changed, mark done, commit only if user asked.

## Track A — AI & Ollama

- [x] Kimi region fallback + `KIMI_BASE_URL` for moonshot.cn
- [x] Shared `AIProviderBanner` on AI / Mail / Spotify / Homelab
- [x] `npm run server:ollama:setup` script + api.env OLLAMA_* vars
- [ ] Ollama reachable from API container (`host.docker.internal:11434`)
- [x] Homelab AI section shows Ollama live/running

## Track B — Microsoft Outlook

- [x] `MICROSOFT_*` in integrations status + `/health`
- [x] Settings → Integrations: Outlook setup card with copy redirect URI
- [ ] User adds Azure app creds to `deploy/homelab/env/api.env` (manual)
- [ ] Mail "Add Outlook" works end-to-end

## Track C — UI polish

- [x] Desktop route padding fix (topnav)
- [x] Command palette: all nav + actions + shortcuts displayed
- [x] Reusable `EmptyState` on Mail / Cloud / Notes where missing
- [x] Mobile: padded routes consistent on tablet breakpoints

## Track D — Canvas

- [x] Homelab glance widget on canvas registry
- [x] System widget shows AI + API health
- [x] Canvas toolbar: grouped add menu + tooltips (existing)

## Deploy

```bash
bash scripts/homelab-deploy-api-web.sh
bash scripts/homelab-docker-compose.sh up -d cortex-api cortex-web
```

If `docker compose up` fails with **permission denied** on stop/restart, use the host deploy listener (Homelab → Redeploy now, or):

```bash
curl -X POST http://127.0.0.1:9092/deploy -H "Authorization: Bearer $HOMELAB_DEPLOY_TOKEN"
```

## Loop prompt (for agent)

Continue Cortex dev loop: read `docs/cortex-dev-loop.md`, implement the first unchecked item, run backend lint / deploy if needed, update checkboxes in this file, do not ask the user unless secrets are required.

## When you're back (≈5 min)

1. **Free local AI:** `npm run server:ollama:setup` in a real terminal (sudo), then Homelab → Redeploy now.
2. **Outlook:** Add `MICROSOFT_CLIENT_ID` + `MICROSOFT_CLIENT_SECRET` to `deploy/homelab/env/api.env` — see `docs/microsoft-oauth-homelab.md`, redeploy.
3. **Kimi AI:** Recharge at [platform.moonshot.cn](https://platform.moonshot.cn) if mail/chat AI still fails with quota errors.
4. **Verify:** https://cortex.tail4f977b.ts.net — Mail, AI chat, Homelab → AI providers (Ollama should show **Running**).
