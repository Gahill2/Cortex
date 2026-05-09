import { Router } from "express";
import { z } from "zod";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { requireAuth } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api-response.js";
import { createFileScannerService, createMockFileScannerProvider } from "../../services/file-scanner.service.js";
import type { ScannedFile } from "../../lib/file-scanner.js";

const recentFilesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10)
});

const searchFilesQuerySchema = z.object({
  q: z.string().min(2),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20)
});

export const cortexFilesRouter = Router();
const fileScannerService = createFileScannerService();

const FALLBACK_FILES: ScannedFile[] = [
  {
    name: "cortex-spec.md",
    path: "~/Documents/GitHub/Cortex/cortex-spec.md",
    extension: "md",
    source: "mock",
    modifiedAt: new Date().toISOString()
  },
  {
    name: "notes.txt",
    path: "~/Desktop/notes.txt",
    extension: "txt",
    source: "mock",
    modifiedAt: new Date().toISOString()
  },
  {
    name: "todo.md",
    path: "~/Documents/todo.md",
    extension: "md",
    source: "mock",
    modifiedAt: new Date().toISOString()
  }
];

function toEnvelopeSource(files: ScannedFile[]): "live" | "mock" {
  return files.some((file) => file.source !== "mock") ? "live" : "mock";
}

cortexFilesRouter.use(requireAuth);

cortexFilesRouter.get("/desktop", routeRateLimit(60, 60_000), async (_req, res) => {
  let files = FALLBACK_FILES;
  let sourceMode: "provider" | "mock-fallback" = "mock-fallback";

  try {
    const scanned = await fileScannerService.scanFiles({ roots: ["~/Desktop"], limit: 50 });
    if (scanned.length > 0) {
      files = scanned;
      sourceMode = "provider";
    }
  } catch {
    files = await createMockFileScannerProvider(FALLBACK_FILES.map((file) => file.path)).scanFiles({
      roots: ["~/Desktop"],
      limit: 50
    });
  }

  sendSuccess(
    res,
    {
      path: "~/Desktop",
      files,
      source: {
        mode: sourceMode,
        itemSources: [...new Set(files.map((file) => file.source))]
      }
    },
    toEnvelopeSource(files)
  );
});

cortexFilesRouter.get("/downloads", routeRateLimit(60, 60_000), async (_req, res) => {
  let files = FALLBACK_FILES;
  let sourceMode: "provider" | "mock-fallback" = "mock-fallback";

  try {
    const scanned = await fileScannerService.scanFiles({ roots: ["~/Downloads"], limit: 50 });
    if (scanned.length > 0) {
      files = scanned;
      sourceMode = "provider";
    }
  } catch {
    files = await createMockFileScannerProvider(FALLBACK_FILES.map((file) => file.path)).scanFiles({
      roots: ["~/Downloads"],
      limit: 50
    });
  }

  sendSuccess(
    res,
    {
      path: "~/Downloads",
      files,
      source: {
        mode: sourceMode,
        itemSources: [...new Set(files.map((file) => file.source))]
      }
    },
    toEnvelopeSource(files)
  );
});

cortexFilesRouter.get("/recent", routeRateLimit(60, 60_000), async (req, res) => {
  const { limit } = recentFilesQuerySchema.parse(req.query);
  let files = FALLBACK_FILES;
  let sourceMode: "provider" | "mock-fallback" = "mock-fallback";

  try {
    const scanned = await fileScannerService.scanFiles({ limit });
    if (scanned.length > 0) {
      files = scanned;
      sourceMode = "provider";
    }
  } catch {
    files = await createMockFileScannerProvider(FALLBACK_FILES.map((file) => file.path)).scanFiles({ limit });
  }

  sendSuccess(
    res,
    {
      files: files.slice(0, limit),
      limit,
      source: {
        mode: sourceMode,
        itemSources: [...new Set(files.map((file) => file.source))]
      }
    },
    toEnvelopeSource(files)
  );
});

cortexFilesRouter.get("/search", routeRateLimit(30, 60_000), async (req, res) => {
  const { q, limit } = searchFilesQuerySchema.parse(req.query);
  let results = FALLBACK_FILES;
  let sourceMode: "provider" | "mock-fallback" = "mock-fallback";

  try {
    const scanned = await fileScannerService.scanFiles({ term: q, limit });
    if (scanned.length > 0) {
      results = scanned;
      sourceMode = "provider";
    }
  } catch {
    results = await createMockFileScannerProvider(FALLBACK_FILES.map((file) => file.path)).scanFiles({ term: q, limit });
  }

  sendSuccess(
    res,
    {
      results: results.slice(0, limit),
      query: q,
      limit,
      source: {
        mode: sourceMode,
        itemSources: [...new Set(results.map((file) => file.source))]
      }
    },
    toEnvelopeSource(results)
  );
});
