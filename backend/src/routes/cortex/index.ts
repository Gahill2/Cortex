import { Router } from "express";
import { cortexAuthRouter } from "./auth.routes.js";
import { cortexAppsRouter } from "./apps.routes.js";
import { cortexFilesRouter } from "./files.routes.js";
import { cortexAiRouter } from "./ai.routes.js";
import { cortexWikiRouter } from "./wiki.routes.js";
import { cortexGmailRouter } from "./gmail.routes.js";
import { cortexMailRouter } from "./mail.routes.js";
import { cortexBillingRouter } from "./billing.routes.js";
import { cortexSpotifyRouter } from "./spotify.routes.js";
import { cortexTasksRouter } from "./tasks.routes.js";
import { cortexProjectsRouter } from "./projects.routes.js";
import { cortexMicrosoftRouter } from "./microsoft.routes.js";
import { cortexWeatherRouter } from "./weather.routes.js";
import { cortexCalendarRouter } from "./calendar.routes.js";
import { obsidianRouter } from "./obsidian.routes.js";
import { notionRouter } from "./notion.routes.js";
import { cortexCanvaRouter } from "./canva.routes.js";
import { cortexFirebaseRouter } from "./firebase.routes.js";
import { cortexN8nRouter } from "./n8n.routes.js";
import { cortexIntegrationsRouter } from "./integrations.routes.js";
import { cortexMemoryRouter } from "./memory.routes.js";
import { cortexSettingsRouter } from "./settings.routes.js";
import { cortexCanvasRouter } from "./canvas.routes.js";
import { pingAgentmemory } from "../../features/agentmemory/client.js";
import { getObsidianVaultPaths } from "../../features/obsidian/vault-index.js";
import { isN8nConfigured } from "../../features/n8n/n8n-client.js";
import { isGmailConfigured } from "../../features/gmail/gmail-service.js";
import { isNotionConfigured } from "../../features/notion/notion-service.js";
import { isSpotifyConfigured } from "../../features/spotify/spotify-service.js";
import { env } from "../../config/env.js";
import { getFirebaseAdminStatus } from "../../features/firebase/admin.js";

export const cortexRouter = Router();

/** Railway / load-balancer liveness — no I/O, must respond before slow dependency pings. */
cortexRouter.get("/health/live", (_req, res) => {
  res.status(200).json({ status: "ok", service: "cortex-api" });
});

cortexRouter.get("/health", async (_req, res) => {
  const agentmemory = await pingAgentmemory();
  const obsidianVaults = getObsidianVaultPaths(env);
  res.json({
    status: "ok",
    service: "cortex-api",
    phase: "phase-1-foundation",
    anthropic_configured: Boolean(env.ANTHROPIC_API_KEY),
    firebase_configured: getFirebaseAdminStatus().configured,
    n8n_configured: isN8nConfigured(),
    spotify_configured: isSpotifyConfigured(),
    notion_configured: isNotionConfigured(),
    agentmemory_configured: agentmemory.ok,
    agentmemory_url: env.AGENTMEMORY_URL,
    obsidian_vaults: obsidianVaults.length,
    gmail_configured: {
      is_configured: isGmailConfigured(),
      has_client_id: Boolean(env.GOOGLE_CLIENT_ID),
      has_client_secret: Boolean(env.GOOGLE_CLIENT_SECRET),
      has_redirect_uri: Boolean(env.GOOGLE_REDIRECT_URI),
      has_redirect_url: Boolean(env.GOOGLE_REDIRECT_URL),
      redirect_uri_value: env.GOOGLE_REDIRECT_URI?.slice(0, 30) + "…",
    },
    canva_configured: {
      apps_sdk_app_id: Boolean(process.env.CANVA_APP_ID?.trim()),
      connect_client_id: Boolean(process.env.CANVA_CLIENT_ID?.trim()),
      connect_client_secret: Boolean(process.env.CANVA_CLIENT_SECRET?.trim()),
      connect_redirect_uri: Boolean(process.env.CANVA_REDIRECT_URI?.trim()),
    },
    firebase: getFirebaseAdminStatus(),
  });
});

cortexRouter.use("/auth", cortexAuthRouter);
cortexRouter.use("/apps", cortexAppsRouter);
cortexRouter.use("/files", cortexFilesRouter);
cortexRouter.use("/ai", cortexAiRouter);
cortexRouter.use("/wiki", cortexWikiRouter);
cortexRouter.use("/gmail", cortexGmailRouter);
cortexRouter.use("/mail", cortexMailRouter);
cortexRouter.use("/billing", cortexBillingRouter);
cortexRouter.use("/spotify", cortexSpotifyRouter);
cortexRouter.use("/tasks", cortexTasksRouter);
cortexRouter.use("/projects", cortexProjectsRouter);
cortexRouter.use("/microsoft", cortexMicrosoftRouter);
cortexRouter.use("/weather", cortexWeatherRouter);
cortexRouter.use("/calendar", cortexCalendarRouter);
cortexRouter.use("/obsidian", obsidianRouter);
cortexRouter.use("/notion", notionRouter);
cortexRouter.use("/canva", cortexCanvaRouter);
cortexRouter.use("/firebase", cortexFirebaseRouter);
cortexRouter.use("/n8n", cortexN8nRouter);
cortexRouter.use("/integrations", cortexIntegrationsRouter);
cortexRouter.use("/memory", cortexMemoryRouter);
cortexRouter.use("/settings", cortexSettingsRouter);
cortexRouter.use("/canvas", cortexCanvasRouter);
