import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { sendSuccess } from "../../utils/api-response.js";
import { env } from "../../config/env.js";
import {
  agentmemoryRemember,
  agentmemorySmartSearch,
  getAgentmemoryBaseUrl,
  pingAgentmemory
} from "../../features/agentmemory/client.js";
import {
  getObsidianVaultPaths,
  getVaultIndexRegistry
} from "../../features/obsidian/vault-index.js";
import {
  getMemoryConfigForUser,
  getObsidianVaultPathsFromEnv,
  syncMemoryConfigForUser
} from "../../features/firebase/memory-config.service.js";

const searchBodySchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(30).optional().default(12)
});

const searchQuerySchema = z.object({
  q: z.string().min(2),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20)
});

const putMemoryConfigSchema = z.object({
  agentmemoryUrl: z.string().optional(),
  agentmemoryProject: z.string().optional(),
  vaultPaths: z.array(z.string()).optional()
});

function resolveVaultPaths(): string[] {
  const paths = getObsidianVaultPaths(env);
  return paths.length > 0 ? paths : getObsidianVaultPathsFromEnv();
}

const vaultRegistry = getVaultIndexRegistry(resolveVaultPaths());
void vaultRegistry.ensureInitialized();

export const cortexMemoryRouter = Router();

cortexMemoryRouter.get("/status", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  const vaultPaths = resolveVaultPaths();
  const agentmemory = await pingAgentmemory();
  const project = env.AGENTMEMORY_PROJECT || req.auth!.userId;
  const vaultStatus = vaultRegistry.getStatus();

  sendSuccess(res, {
    agentmemory,
    agentmemoryUrl: getAgentmemoryBaseUrl(),
    viewerUrl: agentmemory.ok ? "http://127.0.0.1:3113" : null,
    project,
    obsidianVaults: vaultPaths.map((p) => ({ path: p, name: p.split(/[/\\]/).pop() ?? p })),
    vaultIndex: vaultStatus,
    mcpConfig: {
      command: "npx",
      args: ["-y", "@agentmemory/mcp"],
      env: { AGENTMEMORY_URL: getAgentmemoryBaseUrl() }
    }
  });
});

cortexMemoryRouter.post("/search", requireAuth, routeRateLimit(20, 60_000), async (req, res) => {
  const { q, limit } = searchBodySchema.parse(req.body ?? {});
  const project = env.AGENTMEMORY_PROJECT || req.auth!.userId;

  const [agentHits, vaultHits] = await Promise.all([
    pingAgentmemory().then(async (health) => {
      if (!health.ok) return [] as Awaited<ReturnType<typeof agentmemorySmartSearch>>;
      try {
        return await agentmemorySmartSearch(project, q, limit);
      } catch {
        return [];
      }
    }),
    Promise.resolve(vaultRegistry.search(q, limit))
  ]);

  sendSuccess(res, {
    query: q,
    project,
    agentmemory: agentHits.map((h, i) => ({
      id: `am-${i}`,
      source: "agentmemory",
      title: (h.text ?? h.content ?? "Memory").slice(0, 120),
      snippet: (h.text ?? h.content ?? "").slice(0, 300),
      sessionId: h.session_id,
      score: h.score
    })),
    obsidian: vaultHits.map((h) => ({
      id: h.id,
      source: "obsidian-local",
      title: h.title,
      snippet: h.snippet,
      path: h.path,
      relPath: h.relPath,
      tags: h.tags,
      aliases: h.aliases,
      obsidianUri: h.obsidianUri
    }))
  });
});

cortexMemoryRouter.get("/search", requireAuth, routeRateLimit(60, 60_000), async (req, res) => {
  const { q, limit } = searchQuerySchema.parse(req.query);
  const results = vaultRegistry.search(q, limit);
  sendSuccess(
    res,
    {
      query: q,
      limit,
      results,
      status: vaultRegistry.getStatus()
    },
    "live"
  );
});

cortexMemoryRouter.get("/vaults/status", requireAuth, routeRateLimit(60, 60_000), (_req, res) => {
  sendSuccess(res, vaultRegistry.getStatus(), "live");
});

cortexMemoryRouter.get("/vaults/reindex", requireAuth, routeRateLimit(10, 60_000), async (_req, res) => {
  const status = await vaultRegistry.reindex();
  sendSuccess(res, status, "live");
});

cortexMemoryRouter.get("/config", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  const config = await getMemoryConfigForUser(req.auth!.userId);
  sendSuccess(res, config, "live");
});

cortexMemoryRouter.put("/config", requireAuth, routeRateLimit(10, 60_000), async (req, res) => {
  const payload = putMemoryConfigSchema.parse(req.body ?? {});
  const config = await syncMemoryConfigForUser(req.auth!.userId, payload);
  sendSuccess(res, config, "live");
});
