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

export const cortexRouter = Router();

cortexRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "cortex-api",
    phase: "phase-1-foundation",
    gmail_configured: {
      has_client_id: Boolean(process.env.GOOGLE_CLIENT_ID),
      has_client_secret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      has_redirect_uri: Boolean(process.env.GOOGLE_REDIRECT_URI),
      has_redirect_url: Boolean(process.env.GOOGLE_REDIRECT_URL),
    }
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
