# Cortex dev loop backlog

Actionable checklist for the **continuous improvement loop**. Parent playbook: [continuous-improvement-loop.md](./continuous-improvement-loop.md).

Each **Build** pass: first unchecked item in **Build** → implement → deploy if API/web changed → mark `[x]`.

## Manual (user — not autonomous Build)

- [ ] Gaming PC Ollama: `OLLAMA_BASE_URL` + `OLLAMA_PC_NAME` in `deploy/homelab/env/api.env` — [ollama-remote-pc.md](./ollama-remote-pc.md)
- [ ] Azure `MICROSOFT_*` in `api.env` + Mail Outlook connect — [microsoft-oauth-homelab.md](./microsoft-oauth-homelab.md)
- [ ] `npm run vault:fix-perms` (sudo once)
- [ ] Obsidian desktop: `snap install obsidian --classic`

## Build (agent — first unchecked wins)

### UI polish

- [x] Mail Lucide icons + list/detail spacing (`styles-mail.css` 2026-06-04)
- [x] Brand transparent SVG only — grep: no `.png` logos in `frontend/src`; favicon `favicon.svg`
- [x] AI remote PC offline dialog spacing (`styles-ai-settings.css` 2026-06-04)

### Homelab ops

- [x] agentmemory reachable from Docker API (`agentmemory-docker-bind.sh`)
- [x] Document no `sudo docker compose` ([homelab-auto-deploy.md](./homelab-auto-deploy.md))
- [x] `server:docker:doctor` passes (snap/AppArmor warnings only — deploy workaround OK)
- [ ] qBit RAM limits or off-peak schedule (docs note in homelab)
- [ ] Chrome smoke note for Tasks/Calendar ([dev-resources.md](./dev-resources.md))

### AI / integrations (code)

- [x] Remote Ollama path + offline UI ([ollama-remote-pc.md](./ollama-remote-pc.md))
- [x] Homelab page clearer Ollama target when offline (`HomelabPage.tsx` 2026-06-04)

## Done archive

- [x] Kimi region fallback, AIProviderBanner, ollama setup script
- [x] Outlook setup card, MICROSOFT_* in health
- [x] Desktop padding, command palette, EmptyState, mobile padding
- [x] Vault clone scripts, canvas homelab widget

## Deploy

```bash
npm run server:deploy
```

## Loop

```bash
npm run dev:improve-loop      # timer → this chat executes wakes
npm run dev:improve:status
pkill -f cortex-improvement-loop.sh   # stop
```
