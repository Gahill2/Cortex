import { Router } from "express";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http-error.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { requireAuth } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api-response.js";
import { signNotionOAuthState, verifyNotionOAuthState } from "../../features/notion/notion-state.js";
import {
  buildNotionAuthUrl,
  exchangeNotionCode,
  isNotionConfigured,
  isNotionConnected,
  isNotionOAuthConfigured,
  hasNotionInternalToken,
  notionAppendMarkdown,
  notionContext,
  notionCreateChildPage,
  notionGetPage,
  notionListDatabases,
  notionQueryDatabase,
  notionSearch,
} from "../../features/notion/notion-service.js";
import { getVaults } from "./obsidian.routes.js";
import {
  clearNotionTokens,
  isNotionUserConnected,
  saveNotionTokens,
} from "../../features/notion/notion-token-store.js";

export const notionRouter = Router();

function safeVaultPath(vaultRoot: string, relativePath: string): string {
  const root = path.resolve(vaultRoot);
  const rel = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const joined = path.resolve(root, rel);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (joined !== root && !joined.startsWith(rootWithSep)) {
    throw new HttpError(400, "Path escapes vault");
  }
  return joined;
}

notionRouter.get("/status", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  const oauth = isNotionOAuthConfigured();
  const internal = hasNotionInternalToken();
  const configured = isNotionConfigured();
  const userOAuth = await isNotionUserConnected(req.auth!.userId);
  const connected = await isNotionConnected(req.auth!.userId);
  sendSuccess(res, {
    configured,
    oauth_configured: oauth,
    internal_token_configured: internal,
    user_oauth_connected: userOAuth,
    connected,
  });
});

notionRouter.get("/oauth/url", requireAuth, routeRateLimit(10, 60_000), (req, res) => {
  if (!isNotionOAuthConfigured()) {
    throw new HttpError(
      503,
      "Notion OAuth not configured. Set NOTION_CLIENT_ID, NOTION_CLIENT_SECRET, and NOTION_REDIRECT_URI (see developers.notion.com)."
    );
  }
  const state = signNotionOAuthState(req.auth!.userId);
  const url = buildNotionAuthUrl(state);
  sendSuccess(res, { url });
});

notionRouter.post("/oauth/exchange", requireAuth, routeRateLimit(10, 60_000), async (req, res) => {
  const { code, state } = z
    .object({
      code: z.string().min(1),
      state: z.string().min(1),
    })
    .parse(req.body);
  const { userId } = verifyNotionOAuthState(state);
  if (userId !== req.auth!.userId) throw new HttpError(403, "State userId mismatch");
  const tokens = await exchangeNotionCode(code);
  await saveNotionTokens(req.auth!.userId, tokens);
  sendSuccess(res, { connected: true });
});

notionRouter.get("/oauth/callback", routeRateLimit(60, 60_000), async (req, res) => {
  const frontend = env.CORTEX_FRONTEND_URL || "http://localhost:5173";
  try {
    if (typeof req.query.error === "string") {
      res.redirect(`${frontend}/?notion_error=${encodeURIComponent(req.query.error)}`);
      return;
    }
    const code = req.query.code;
    const state = req.query.state;
    if (typeof code !== "string" || typeof state !== "string") {
      res.redirect(`${frontend}/?notion_error=missing_code`);
      return;
    }
    const { userId } = verifyNotionOAuthState(state);
    const tokens = await exchangeNotionCode(code);
    await saveNotionTokens(userId, tokens);
    res.redirect(`${frontend}/?notion_connected=1`);
  } catch {
    res.redirect(`${frontend}/?notion_error=oauth_failed`);
  }
});

notionRouter.post("/disconnect", requireAuth, routeRateLimit(5, 60_000), async (req, res) => {
  await clearNotionTokens(req.auth!.userId);
  sendSuccess(res, { disconnected: true });
});

notionRouter.get("/search", requireAuth, routeRateLimit(40, 60_000), async (req, res) => {
  if (!isNotionConfigured()) throw new HttpError(503, "Notion not configured");
  if (!(await isNotionConnected(req.auth!.userId))) throw new HttpError(400, "Notion not connected");
  const q = z.string().max(200).optional().default("").parse(req.query.q ?? "");
  const results = await notionSearch(req.auth!.userId, q);
  sendSuccess(res, { results });
});

notionRouter.get("/page", requireAuth, routeRateLimit(40, 60_000), async (req, res) => {
  if (!isNotionConfigured()) throw new HttpError(503, "Notion not configured");
  if (!(await isNotionConnected(req.auth!.userId))) throw new HttpError(400, "Notion not connected");
  const pageId = z.string().min(8).max(40).parse(req.query.id as string);
  const page = await notionGetPage(req.auth!.userId, pageId);
  sendSuccess(res, { page });
});

notionRouter.get("/context", requireAuth, routeRateLimit(20, 60_000), async (req, res) => {
  if (!(await isNotionConnected(req.auth!.userId))) {
    sendSuccess(res, { context: "" });
    return;
  }
  const context = await notionContext(req.auth!.userId);
  sendSuccess(res, { context });
});

notionRouter.get("/databases", requireAuth, routeRateLimit(40, 60_000), async (req, res) => {
  if (!isNotionConfigured()) throw new HttpError(503, "Notion not configured");
  if (!(await isNotionConnected(req.auth!.userId))) throw new HttpError(400, "Notion not connected");
  const q = z.string().max(200).optional().default("").parse(req.query.q ?? "");
  const databases = await notionListDatabases(req.auth!.userId, q);
  sendSuccess(res, { databases });
});

notionRouter.get("/database/query", requireAuth, routeRateLimit(40, 60_000), async (req, res) => {
  if (!isNotionConfigured()) throw new HttpError(503, "Notion not configured");
  if (!(await isNotionConnected(req.auth!.userId))) throw new HttpError(400, "Notion not connected");
  const databaseId = z.string().min(8).max(40).parse(req.query.id as string);
  const cursor =
    typeof req.query.cursor === "string" && req.query.cursor.length > 0
      ? z.string().max(200).parse(req.query.cursor)
      : undefined;
  const result = await notionQueryDatabase(req.auth!.userId, databaseId, cursor);
  sendSuccess(res, result);
});

notionRouter.post("/pages", requireAuth, routeRateLimit(20, 60_000), async (req, res) => {
  if (!isNotionConfigured()) throw new HttpError(503, "Notion not configured");
  if (!(await isNotionConnected(req.auth!.userId))) throw new HttpError(400, "Notion not connected");
  const { parentPageId, title, body } = z
    .object({
      parentPageId: z.string().min(8).max(40),
      title: z.string().min(1).max(500),
      body: z.string().max(50_000).optional().default(""),
    })
    .parse(req.body);
  const page = await notionCreateChildPage(req.auth!.userId, parentPageId, title, body);
  sendSuccess(res, { page });
});

notionRouter.post("/pages/append", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  if (!isNotionConfigured()) throw new HttpError(503, "Notion not configured");
  if (!(await isNotionConnected(req.auth!.userId))) throw new HttpError(400, "Notion not connected");
  const { pageId, markdown } = z
    .object({
      pageId: z.string().min(8).max(40),
      markdown: z.string().min(1).max(100_000),
    })
    .parse(req.body);
  await notionAppendMarkdown(req.auth!.userId, pageId, markdown);
  sendSuccess(res, { appended: true });
});

notionRouter.post("/sync/to-obsidian", requireAuth, routeRateLimit(20, 60_000), async (req, res) => {
  if (!isNotionConfigured()) throw new HttpError(503, "Notion not configured");
  if (!(await isNotionConnected(req.auth!.userId))) throw new HttpError(400, "Notion not connected");
  const { pageId, relativePath } = z
    .object({
      pageId: z.string().min(8).max(40),
      relativePath: z.string().min(1).max(500),
    })
    .parse(req.body);
  const vaults = await getVaults();
  const vaultRoot = vaults[req.auth!.userId];
  if (!vaultRoot) throw new HttpError(400, "Obsidian vault not configured");
  const full = safeVaultPath(vaultRoot, relativePath.endsWith(".md") ? relativePath : `${relativePath}.md`);
  const page = await notionGetPage(req.auth!.userId, pageId);
  const md = `# ${page.title}\n\n${page.body}\n`;
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, md, "utf8");
  sendSuccess(res, { path: full, title: page.title });
});

notionRouter.post("/sync/from-obsidian", requireAuth, routeRateLimit(20, 60_000), async (req, res) => {
  if (!isNotionConfigured()) throw new HttpError(503, "Notion not configured");
  if (!(await isNotionConnected(req.auth!.userId))) throw new HttpError(400, "Notion not connected");
  const { parentPageId, relativePath } = z
    .object({
      parentPageId: z.string().min(8).max(40),
      relativePath: z.string().min(1).max(500),
    })
    .parse(req.body);
  const vaults = await getVaults();
  const vaultRoot = vaults[req.auth!.userId];
  if (!vaultRoot) throw new HttpError(400, "Obsidian vault not configured");
  const full = safeVaultPath(
    vaultRoot,
    relativePath.endsWith(".md") ? relativePath : `${relativePath}.md`
  );
  const raw = await fs.readFile(full, "utf8").catch(() => {
    throw new HttpError(404, "Vault file not found");
  });
  const base = path.basename(full, ".md");
  const title = base;
  const body = raw.replace(/^#\s+.+\n+/, "").trim();
  const page = await notionCreateChildPage(req.auth!.userId, parentPageId, title, body);
  sendSuccess(res, { page });
});
