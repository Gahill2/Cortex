import { createHash } from "node:crypto";
import { promises as fsPromises, watch, type FSWatcher } from "node:fs";
import path from "node:path";
import os from "node:os";

export interface VaultSearchResult {
  id: string;
  title: string;
  snippet: string;
  path: string;
  relPath: string;
  tags: string[];
  aliases: string[];
  source: "obsidian-local";
  obsidianUri: string;
}

interface VaultIndexCache {
  vaultRoot: string;
  indexedAt: string;
  entries: VaultSearchResult[];
}

export interface VaultIndexStatus {
  configured: boolean;
  vaultRoot: string;
  cachePath: string;
  entryCount: number;
  indexedAt: string | null;
  watcherEnabled: boolean;
  watcherActive: boolean;
  lastError: string | null;
}

interface VaultIndexOptions {
  vaultRoot?: string;
  enableWatcher?: boolean;
  cachePath?: string;
}

const DEFAULT_CACHE_PATH = path.resolve(process.cwd(), ".cortex", "vault-index.json");
const FRONTMATTER_DELIMITER = "---";

const toForwardSlashes = (value: string): string => value.replaceAll("\\", "/");

const splitInlineList = (value: string): string[] => {
  return value
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
};

const splitTags = (value: string): string[] => {
  if (!value) return [];
  if (value.startsWith("[") && value.endsWith("]")) {
    return splitInlineList(value);
  }
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim().replace(/^#/, ""))
    .filter(Boolean);
};

const splitAliases = (value: string): string[] => {
  if (!value) return [];
  if (value.startsWith("[") && value.endsWith("]")) {
    return splitInlineList(value);
  }
  return value
    .split(",")
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
};

const compactSpaces = (value: string): string => value.replace(/\s+/g, " ").trim();

function parseFrontmatter(content: string): { body: string; tags: string[]; aliases: string[] } {
  if (!content.startsWith(`${FRONTMATTER_DELIMITER}\n`) && !content.startsWith(`${FRONTMATTER_DELIMITER}\r\n`)) {
    return { body: content, tags: [], aliases: [] };
  }

  const lines = content.split(/\r?\n/);
  if (lines[0].trim() !== FRONTMATTER_DELIMITER) {
    return { body: content, tags: [], aliases: [] };
  }

  let closingIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === FRONTMATTER_DELIMITER) {
      closingIndex = i;
      break;
    }
  }

  if (closingIndex < 0) {
    return { body: content, tags: [], aliases: [] };
  }

  const frontmatterLines = lines.slice(1, closingIndex);
  const body = lines.slice(closingIndex + 1).join("\n");
  const tags: string[] = [];
  const aliases: string[] = [];

  for (let i = 0; i < frontmatterLines.length; i += 1) {
    const line = frontmatterLines[i].trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const [rawKey, ...rest] = line.split(":");
    if (!rawKey || rest.length === 0) {
      continue;
    }

    const key = rawKey.trim().toLowerCase();
    let value = rest.join(":").trim();

    if ((key === "tags" || key === "aliases") && !value) {
      const listItems: string[] = [];
      for (let j = i + 1; j < frontmatterLines.length; j += 1) {
        const listLine = frontmatterLines[j].trim();
        if (!listLine.startsWith("- ")) {
          break;
        }
        listItems.push(listLine.slice(2).trim());
        i = j;
      }
      value = `[${listItems.join(",")}]`;
    }

    if (key === "tags") {
      tags.push(...splitTags(value));
    } else if (key === "aliases") {
      aliases.push(...splitAliases(value));
    }
  }

  return {
    body,
    tags: [...new Set(tags)],
    aliases: [...new Set(aliases)]
  };
}

function extractTitle(markdownBody: string, absolutePath: string): string {
  const headingLine = markdownBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("# "));
  if (headingLine) {
    return headingLine.replace(/^#\s+/, "").trim();
  }
  return path.basename(absolutePath, path.extname(absolutePath));
}

function buildSnippet(markdownBody: string, tags: string[], aliases: string[]): string {
  const cleaned = compactSpaces(markdownBody.replaceAll(/[#>*`]/g, " "));
  const firstSegment = cleaned.slice(0, 180);
  const metadataSegments: string[] = [];
  if (tags.length > 0) {
    metadataSegments.push(`tags: ${tags.join(", ")}`);
  }
  if (aliases.length > 0) {
    metadataSegments.push(`aliases: ${aliases.join(", ")}`);
  }
  if (metadataSegments.length === 0) {
    return firstSegment;
  }
  const metadata = metadataSegments.join(" | ");
  return firstSegment ? `${firstSegment} • ${metadata}` : metadata;
}

function createObsidianUri(vaultRoot: string, absoluteFilePath: string): string {
  const vaultName = path.basename(vaultRoot);
  const relFilePath = toForwardSlashes(path.relative(vaultRoot, absoluteFilePath)).replace(/\.md$/i, "");
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relFilePath)}`;
}

async function walkMarkdownFiles(rootDir: string): Promise<string[]> {
  const stack = [rootDir];
  const markdownFiles: string[] = [];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) {
      continue;
    }

    const entries = await fsPromises.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        markdownFiles.push(fullPath);
      }
    }
  }

  return markdownFiles;
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export class VaultIndexService {
  private readonly vaultRoot: string;

  private readonly cachePath: string;

  private readonly enableWatcher: boolean;

  private entries: VaultSearchResult[] = [];

  private indexedAt: string | null = null;

  private indexPromise: Promise<void> | null = null;

  private watcher: FSWatcher | null = null;

  private reindexDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  private lastError: string | null = null;

  constructor(options: VaultIndexOptions = {}) {
    this.vaultRoot = (options.vaultRoot || "").trim();
    this.enableWatcher = Boolean(options.enableWatcher);
    this.cachePath = options.cachePath || DEFAULT_CACHE_PATH;
  }

  async ensureInitialized(): Promise<void> {
    if (!this.vaultRoot) {
      return;
    }
    await this.loadCache();
    if (this.enableWatcher) {
      this.startWatcher();
    }
    if (this.entries.length === 0) {
      await this.reindex();
    }
  }

  async reindex(): Promise<VaultIndexStatus> {
    if (!this.vaultRoot) {
      return this.getStatus();
    }
    if (this.indexPromise) {
      await this.indexPromise;
      return this.getStatus();
    }

    this.indexPromise = this.performReindex();
    try {
      await this.indexPromise;
    } finally {
      this.indexPromise = null;
    }

    return this.getStatus();
  }

  search(term: string, limit = 20): VaultSearchResult[] {
    const normalizedTerm = term.trim().toLowerCase();
    if (!normalizedTerm) {
      return [];
    }
    const cappedLimit = Math.max(1, Math.min(limit, 100));
    return this.entries
      .filter((entry) => {
        return (
          entry.title.toLowerCase().includes(normalizedTerm) ||
          entry.snippet.toLowerCase().includes(normalizedTerm) ||
          entry.path.toLowerCase().includes(normalizedTerm) ||
          entry.tags.some((tag) => tag.toLowerCase().includes(normalizedTerm)) ||
          entry.aliases.some((alias) => alias.toLowerCase().includes(normalizedTerm))
        );
      })
      .slice(0, cappedLimit);
  }

  getStatus(): VaultIndexStatus {
    return {
      configured: Boolean(this.vaultRoot),
      vaultRoot: this.vaultRoot,
      cachePath: this.cachePath,
      entryCount: this.entries.length,
      indexedAt: this.indexedAt,
      watcherEnabled: this.enableWatcher,
      watcherActive: Boolean(this.watcher),
      lastError: this.lastError
    };
  }

  private async loadCache(): Promise<void> {
    try {
      const raw = await fsPromises.readFile(this.cachePath, "utf8");
      const parsed = JSON.parse(raw) as VaultIndexCache;
      if (parsed.vaultRoot !== this.vaultRoot || !Array.isArray(parsed.entries)) {
        return;
      }
      this.entries = parsed.entries;
      this.indexedAt = parsed.indexedAt;
    } catch {
      // Cache is optional. Misses are expected on first run.
    }
  }

  private async saveCache(): Promise<void> {
    const payload: VaultIndexCache = {
      vaultRoot: this.vaultRoot,
      indexedAt: this.indexedAt || new Date().toISOString(),
      entries: this.entries
    };

    await fsPromises.mkdir(path.dirname(this.cachePath), { recursive: true });
    await fsPromises.writeFile(this.cachePath, JSON.stringify(payload, null, 2), "utf8");
  }

  private async performReindex(): Promise<void> {
    try {
      const markdownFiles = await walkMarkdownFiles(this.vaultRoot);
      const nextEntries: VaultSearchResult[] = [];

      for (const markdownFile of markdownFiles) {
        const markdown = await fsPromises.readFile(markdownFile, "utf8");
        const { body, tags, aliases } = parseFrontmatter(markdown);
        const title = extractTitle(body, markdownFile);
        const relPath = toForwardSlashes(path.relative(this.vaultRoot, markdownFile));
        const id = createHash("sha1").update(relPath).digest("hex");

        nextEntries.push({
          id,
          title,
          snippet: buildSnippet(body, tags, aliases),
          path: markdownFile,
          relPath,
          tags,
          aliases,
          source: "obsidian-local",
          obsidianUri: createObsidianUri(this.vaultRoot, markdownFile)
        });
      }

      this.entries = nextEntries.sort((a, b) => a.title.localeCompare(b.title));
      this.indexedAt = new Date().toISOString();
      this.lastError = null;
      await this.saveCache();
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : "Unknown reindex error";
      throw error;
    }
  }

  private startWatcher(): void {
    if (this.watcher || !this.vaultRoot) {
      return;
    }

    try {
      this.watcher = watch(this.vaultRoot, { recursive: os.platform() === "win32" }, (_eventType, filename) => {
        if (!filename || !filename.toLowerCase().endsWith(".md")) {
          return;
        }
        if (this.reindexDebounceTimer) {
          clearTimeout(this.reindexDebounceTimer);
        }
        this.reindexDebounceTimer = setTimeout(() => {
          void this.reindex().catch(() => {
            // Reindex errors are surfaced in status.lastError.
          });
        }, 400);
      });
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : "Unable to start watcher";
    }
  }
}

export function createVaultIndexService(options: VaultIndexOptions = {}): VaultIndexService {
  const envVaultRoot = process.env.OBSIDIAN_VAULT_PATH;
  const envWatchEnabled = parseBoolean(process.env.CORTEX_ENABLE_VAULT_WATCHER);
  return new VaultIndexService({
    vaultRoot: options.vaultRoot ?? envVaultRoot,
    enableWatcher: options.enableWatcher ?? envWatchEnabled,
    cachePath: options.cachePath
  });
}

export function getObsidianVaultPaths(envLike: {
  OBSIDIAN_VAULT_PATH?: string;
  OBSIDIAN_VAULT_PATHS?: string;
}): string[] {
  const raw = envLike.OBSIDIAN_VAULT_PATHS?.trim();
  if (raw) {
    return [...new Set(raw.split(/[;,]/).map((p) => p.trim()).filter(Boolean))];
  }
  const single = envLike.OBSIDIAN_VAULT_PATH?.trim();
  return single ? [single] : [];
}

export type MultiVaultStatus = {
  vaults: VaultIndexStatus[];
  entryCount: number;
  configured: boolean;
};

export class MultiVaultIndexService {
  private readonly services: VaultIndexService[];

  constructor(vaultPaths: string[]) {
    const watch = parseBoolean(process.env.CORTEX_ENABLE_VAULT_WATCHER);
    this.services = vaultPaths.map(
      (vaultRoot) => new VaultIndexService({ vaultRoot, enableWatcher: watch })
    );
  }

  async ensureInitialized(): Promise<void> {
    await Promise.all(this.services.map((s) => s.ensureInitialized()));
  }

  search(term: string, limit = 20): VaultSearchResult[] {
    if (this.services.length === 0) return [];
    const perVault = Math.max(1, Math.ceil(limit / this.services.length));
    return this.services
      .flatMap((s) => s.search(term, perVault))
      .slice(0, limit);
  }

  async reindex(): Promise<MultiVaultStatus> {
    await Promise.all(this.services.map((s) => s.reindex()));
    return this.getStatus();
  }

  getStatus(): MultiVaultStatus {
    const vaults = this.services.map((s) => s.getStatus());
    return {
      vaults,
      entryCount: vaults.reduce((sum, v) => sum + v.entryCount, 0),
      configured: vaults.some((v) => v.configured)
    };
  }
}

let registry: MultiVaultIndexService | null = null;

export function getVaultIndexRegistry(vaultPaths: string[]): MultiVaultIndexService {
  if (!registry || registry.getStatus().vaults.length !== vaultPaths.length) {
    registry = new MultiVaultIndexService(vaultPaths);
  }
  return registry;
}
