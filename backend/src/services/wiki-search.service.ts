import path from "node:path";
import { env } from "../config/env.js";
import {
  getObsidianVaultPaths,
  getVaultIndexRegistry
} from "../features/obsidian/vault-index.js";
import {
  type WikiSearchProvider,
  type WikiSearchQuery,
  type WikiSearchResult,
  type WikiSearchService
} from "../lib/wiki-search.js";

const MOCK_RESULTS: WikiSearchResult[] = [
  {
    id: "vault-01",
    title: "Project Cortex Overview",
    snippet: "High-level product goals and integration requirements.",
    path: "C:/Notes/Cortex/Project Cortex Overview.md",
    source: "mock"
  },
  {
    id: "vault-02",
    title: "Adapter Layer Notes",
    snippet: "Adapters normalize launcher, scanner, and wiki data sources.",
    path: "C:/Notes/Cortex/Adapter Layer Notes.md",
    source: "mock"
  }
];

function applyWikiQueryFilters(results: WikiSearchResult[], query: WikiSearchQuery): WikiSearchResult[] {
  const term = query.term.trim().toLowerCase();
  const filtered = results.filter(
    (result) =>
      result.title.toLowerCase().includes(term) ||
      result.snippet.toLowerCase().includes(term) ||
      result.path.toLowerCase().includes(term)
  );

  const limit = query.limit ?? filtered.length;
  return filtered.slice(0, Math.max(0, limit));
}

export function createMockWikiSearchProvider(seedResults: WikiSearchResult[] = MOCK_RESULTS): WikiSearchProvider {
  return {
    providerName: "mock-wiki-search",
    async search(query: WikiSearchQuery): Promise<WikiSearchResult[]> {
      return applyWikiQueryFilters(seedResults, query);
    }
  };
}

export interface ObsidianWikiSearchProviderOptions {
  vaultRoot: string;
}

/**
 * Extension point for real Obsidian note search.
 * The current stub returns deterministic local paths so routes can integrate now.
 */
export function createObsidianWikiSearchProvider(
  options: ObsidianWikiSearchProviderOptions
): WikiSearchProvider {
  return {
    providerName: "obsidian-local-wiki-search",
    async search(query: WikiSearchQuery): Promise<WikiSearchResult[]> {
      const root = options.vaultRoot.replace(/\\/g, "/");
      const mockObsidianResults: WikiSearchResult[] = [
        {
          id: "obsidian-01",
          title: "Daily Notes",
          snippet: `Obsidian vault at ${root}`,
          path: path.join(options.vaultRoot, "Daily Notes.md"),
          source: "obsidian-local"
        },
        {
          id: "obsidian-02",
          title: "Research Index",
          snippet: "Index of linked research notes.",
          path: path.join(options.vaultRoot, "Research Index.md"),
          source: "obsidian-local"
        }
      ];

      return applyWikiQueryFilters(mockObsidianResults, query);
    }
  };
}

export interface WikiSearchServiceOptions {
  providers?: WikiSearchProvider[];
}

export function createWikiSearchService(options: WikiSearchServiceOptions = {}): WikiSearchService {
  const providers = options.providers ?? [createMockWikiSearchProvider()];

  return {
    async search(query: WikiSearchQuery): Promise<WikiSearchResult[]> {
      const results = await Promise.all(providers.map((provider) => provider.search(query)));
      return results.flat();
    }
  };
}

/** Live scan of configured Obsidian vault folders on disk. */
export function createObsidianVaultWikiSearchProvider(vaultPaths: string[]): WikiSearchProvider {
  const registry = getVaultIndexRegistry(vaultPaths);
  void registry.ensureInitialized();
  return {
    providerName: "obsidian-vault-scan",
    async search(query: WikiSearchQuery): Promise<WikiSearchResult[]> {
      const hits = registry.search(query.term, query.limit ?? 20);
      return hits.map((h) => ({
        id: h.id,
        title: h.title,
        snippet: h.snippet,
        path: h.path,
        source: "obsidian-local"
      }));
    }
  };
}

export function createDefaultWikiSearchService(): WikiSearchService {
  const vaults = getObsidianVaultPaths(env);
  const providers =
    vaults.length > 0
      ? [createObsidianVaultWikiSearchProvider(vaults)]
      : [createMockWikiSearchProvider()];
  return createWikiSearchService({ providers });
}
