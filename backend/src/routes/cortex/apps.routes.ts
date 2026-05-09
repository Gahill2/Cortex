import { Router } from "express";
import { z } from "zod";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { requireAuth } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api-response.js";
import { createAppDiscoveryService, createMockAppDiscoveryProvider } from "../../services/app-discovery.service.js";
import type { DiscoveredApp } from "../../lib/app-discovery.js";

const recentAppsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional().default(5)
});

const launchSchema = z.object({
  appId: z.string().min(1),
  source: z.enum(["launcher", "recent", "search"]).optional().default("launcher")
});

export const cortexAppsRouter = Router();
const appDiscoveryService = createAppDiscoveryService();

const FALLBACK_APPS: DiscoveredApp[] = [
  {
    id: "com.cursor.ide",
    name: "Cursor",
    executablePath: "C:\\Program Files\\Cursor\\Cursor.exe",
    source: "mock"
  },
  {
    id: "com.microsoft.vscode",
    name: "Visual Studio Code",
    executablePath: "C:\\Users\\Public\\Code.exe",
    source: "mock"
  },
  {
    id: "com.google.chrome",
    name: "Google Chrome",
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    source: "mock"
  }
];

function toEnvelopeSource(apps: DiscoveredApp[]): "live" | "mock" {
  return apps.some((app) => app.source !== "mock") ? "live" : "mock";
}

cortexAppsRouter.use(requireAuth);

cortexAppsRouter.get("/list", routeRateLimit(60, 60_000), async (_req, res) => {
  let apps = FALLBACK_APPS;
  let sourceMode: "provider" | "mock-fallback" = "mock-fallback";

  try {
    const discoveredApps = await appDiscoveryService.discoverApps();
    if (discoveredApps.length > 0) {
      apps = discoveredApps;
      sourceMode = "provider";
    }
  } catch {
    // Fall back to deterministic mock payload if service providers fail.
    apps = await createMockAppDiscoveryProvider(FALLBACK_APPS).discoverApps();
  }

  sendSuccess(
    res,
    {
      apps,
      source: {
        mode: sourceMode,
        itemSources: [...new Set(apps.map((app) => app.source))]
      }
    },
    toEnvelopeSource(apps)
  );
});

cortexAppsRouter.get("/recent", routeRateLimit(60, 60_000), async (req, res) => {
  const { limit } = recentAppsQuerySchema.parse(req.query);
  let apps = FALLBACK_APPS;
  let sourceMode: "provider" | "mock-fallback" = "mock-fallback";

  try {
    const discoveredApps = await appDiscoveryService.discoverApps({ limit });
    if (discoveredApps.length > 0) {
      apps = discoveredApps;
      sourceMode = "provider";
    }
  } catch {
    apps = await createMockAppDiscoveryProvider(FALLBACK_APPS).discoverApps({ limit });
  }

  sendSuccess(
    res,
    {
      apps: apps.slice(0, limit),
      limit,
      source: {
        mode: sourceMode,
        itemSources: [...new Set(apps.map((app) => app.source))]
      }
    },
    toEnvelopeSource(apps)
  );
});

cortexAppsRouter.post("/launch", routeRateLimit(20, 60_000), (req, res) => {
  const input = launchSchema.parse(req.body);
  sendSuccess(res, {
    requestId: `launch_${Date.now()}`,
    appId: input.appId,
    source: input.source,
    status: "queued"
  });
});
