import { Router } from "express";
import { cortexAuthRouter } from "./auth.routes.js";
import { cortexAppsRouter } from "./apps.routes.js";
import { cortexFilesRouter } from "./files.routes.js";
import { cortexAiRouter } from "./ai.routes.js";
import { cortexWikiRouter } from "./wiki.routes.js";
import { cortexGmailRouter } from "./gmail.routes.js";
import { cortexSpotifyRouter } from "./spotify.routes.js";
import { cortexTasksRouter } from "./tasks.routes.js";
import { cortexProjectsRouter } from "./projects.routes.js";
import { cortexMailRouter } from "./mail.routes.js";
import { cortexMicrosoftRouter } from "./microsoft.routes.js";
import { cortexWeatherRouter } from "./weather.routes.js";
import { cortexCalendarRouter } from "./calendar.routes.js";
import { obsidianRouter } from "./obsidian.routes.js";
import { notionRouter } from "./notion.routes.js";
import { cortexCanvaRouter } from "./canva.routes.js";
import { cortexFirebaseRouter } from "./firebase.routes.js";
import { isGmailConfigured } from "../../features/gmail/gmail-service.js";
import { getFirebaseAdminStatus } from "../../features/firebase/admin.js";

export const cortexRouter = Router();

cortexRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "cortex-api",
    phase: "phase-1-foundation",
    gmail_configured: {
      is_configured: isGmailConfigured(),
      has_client_id: Boolean(process.env.GOOGLE_CLIENT_ID),
      has_client_secret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      has_redirect_uri: Boolean(process.env.GOOGLE_REDIRECT_URI),
      has_redirect_url: Boolean(process.env.GOOGLE_REDIRECT_URL),
      redirect_uri_value: process.env.GOOGLE_REDIRECT_URI?.slice(0, 30) + "…",
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
cortexRouter.use("/spotify", cortexSpotifyRouter);
cortexRouter.use("/tasks", cortexTasksRouter);
cortexRouter.use("/projects", cortexProjectsRouter);
cortexRouter.use("/mail", cortexMailRouter);
cortexRouter.use("/microsoft", cortexMicrosoftRouter);
cortexRouter.use("/weather", cortexWeatherRouter);
cortexRouter.use("/calendar", cortexCalendarRouter);
cortexRouter.use("/obsidian", obsidianRouter);
cortexRouter.use("/notion", notionRouter);
cortexRouter.use("/canva", cortexCanvaRouter);
cortexRouter.use("/firebase", cortexFirebaseRouter);
