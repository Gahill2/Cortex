import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { sendSuccess } from "../../utils/api-response.js";
import {
  deleteCloudPath,
  downloadCloudFile,
  getCloudStatus,
  getNextcloudOpenUrl,
  isNextcloudConfigured,
  listCloudFiles,
  normalizeCloudPath,
  uploadCloudFile
} from "../../features/nextcloud/nextcloud-service.js";

export const cortexCloudRouter = Router();

cortexCloudRouter.use(requireAuth);

cortexCloudRouter.get("/status", routeRateLimit(60, 60_000), async (_req, res) => {
  const status = await getCloudStatus();
  sendSuccess(
    res,
    {
      ...status,
      openUrl: getNextcloudOpenUrl()
    },
    status.connected ? "live" : status.configured ? "mock" : "mock"
  );
});

const listQuerySchema = z.object({
  path: z.string().optional().default("")
});

cortexCloudRouter.get("/list", routeRateLimit(60, 60_000), async (req, res) => {
  if (!isNextcloudConfigured()) {
    res.status(503).json({ error: { message: "Nextcloud not configured on server" } });
    return;
  }
  const { path } = listQuerySchema.parse(req.query);
  try {
    const files = await listCloudFiles(path);
    sendSuccess(res, { path: normalizeCloudPath(path), files }, "live");
  } catch (e) {
    res.status(502).json({
      error: { message: e instanceof Error ? e.message : "Could not list files" }
    });
  }
});

/** Download file — path in query to avoid wildcard routing issues. */
cortexCloudRouter.get("/download", routeRateLimit(30, 60_000), async (req, res) => {
  if (!isNextcloudConfigured()) {
    res.status(503).json({ error: { message: "Nextcloud not configured" } });
    return;
  }
  const path = typeof req.query.path === "string" ? req.query.path : "";
  if (!path.trim()) {
    res.status(400).json({ error: { message: "path query required" } });
    return;
  }
  try {
    const { buffer, contentType } = await downloadCloudFile(path);
    const name = normalizeCloudPath(path).split("/").pop() ?? "download";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(name)}"`);
    res.send(buffer);
  } catch (e) {
    res.status(502).json({
      error: { message: e instanceof Error ? e.message : "Download failed" }
    });
  }
});

const uploadQuerySchema = z.object({
  path: z.string().optional().default(""),
  name: z.string().min(1).max(512)
});

/** Raw body upload — client sets Content-Type to file mime. */
cortexCloudRouter.post(
  "/upload",
  routeRateLimit(20, 60_000),
  async (req, res) => {
    if (!isNextcloudConfigured()) {
      res.status(503).json({ error: { message: "Nextcloud not configured" } });
      return;
    }
    const parsed = uploadQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: { message: "name query required" } });
      return;
    }
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => resolve());
      req.on("error", reject);
    });
    const body = Buffer.concat(chunks);
    if (body.length === 0) {
      res.status(400).json({ error: { message: "Empty body" } });
      return;
    }
    try {
      const result = await uploadCloudFile(
        parsed.data.path,
        parsed.data.name,
        body,
        typeof req.headers["content-type"] === "string" ? req.headers["content-type"] : undefined
      );
      sendSuccess(res, result, "live");
    } catch (e) {
      res.status(502).json({
        error: { message: e instanceof Error ? e.message : "Upload failed" }
      });
    }
  }
);

cortexCloudRouter.delete("/files", routeRateLimit(20, 60_000), async (req, res) => {
  if (!isNextcloudConfigured()) {
    res.status(503).json({ error: { message: "Nextcloud not configured" } });
    return;
  }
  const path = typeof req.query.path === "string" ? req.query.path : "";
  if (!path.trim()) {
    res.status(400).json({ error: { message: "path query required" } });
    return;
  }
  try {
    await deleteCloudPath(path);
    sendSuccess(res, { deleted: normalizeCloudPath(path) }, "live");
  } catch (e) {
    res.status(502).json({
      error: { message: e instanceof Error ? e.message : "Delete failed" }
    });
  }
});
