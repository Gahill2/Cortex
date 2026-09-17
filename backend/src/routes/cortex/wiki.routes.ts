import { Router } from "express";
import { z } from "zod";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { requireAuth } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api-response.js";
import {
  createDefaultWikiSearchService,
  createMockWikiSearchProvider
} from "../../services/wiki-search.service.js";
import type { WikiSearchResult } from "../../lib/wiki-search.js";

const wikiSearchQuerySchema = z.object({
  q: z.string().min(2),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20)
});

const FALLBACK_RESULTS: WikiSearchResult[] = [
  {
    id: "wiki-mock-1",
    title: "Project Cortex Overview",
    snippet: "High-level product goals and integration requirements.",
    path: "C:/Notes/Cortex/Project Cortex Overview.md",
    source: "mock"
  },
  {
    id: "wiki-mock-2",
    title: "Adapter Layer Notes",
    snippet: "Adapters normalize launcher, scanner, and wiki data sources.",
    path: "C:/Notes/Cortex/Adapter Layer Notes.md",
    source: "mock"
  }
];

export const cortexWikiRouter = Router();
const wikiSearchService = createDefaultWikiSearchService();

function toEnvelopeSource(results: WikiSearchResult[]): "live" | "mock" {
  return results.some((result) => result.source !== "mock") ? "live" : "mock";
}

cortexWikiRouter.use(requireAuth);

cortexWikiRouter.get("/search", routeRateLimit(30, 60_000), async (req, res) => {
  const { q, limit } = wikiSearchQuerySchema.parse(req.query);
  let results = FALLBACK_RESULTS;
  let sourceMode: "provider" | "mock-fallback" = "mock-fallback";

  try {
    const serviceResults = await wikiSearchService.search({ term: q, limit });
    if (serviceResults.length > 0) {
      results = serviceResults;
      sourceMode = "provider";
    }
  } catch (err) {
    console.warn("[wiki] search failed, using mock fallback:", err);
    results = await createMockWikiSearchProvider(FALLBACK_RESULTS).search({ term: q, limit });
  }

  sendSuccess(
    res,
    {
      results: results.slice(0, limit),
      query: q,
      limit,
      source: {
        mode: sourceMode,
        itemSources: [...new Set(results.map((result) => result.source))]
      }
    },
    toEnvelopeSource(results)
  );
});
