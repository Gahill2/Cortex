import os from "node:os";
import path from "node:path";
import {
  type FileScannerProvider,
  type FileScannerService,
  type FileSearchQuery,
  type ScannedFile
} from "../lib/file-scanner.js";

function defaultRoots(): string[] {
  const home = os.homedir();
  return [path.join(home, "Desktop"), path.join(home, "Downloads")];
}

function extensionFromPath(filePath: string): string {
  return path.extname(filePath).replace(".", "").toLowerCase();
}

function applyFileQueryFilters(files: ScannedFile[], query?: FileSearchQuery): ScannedFile[] {
  const normalizedTerm = query?.term?.trim().toLowerCase();
  const requestedExtensions = new Set(query?.extensions?.map((ext) => ext.toLowerCase().replace(".", "")));

  const filtered = files.filter((file) => {
    const nameMatch = normalizedTerm ? file.name.toLowerCase().includes(normalizedTerm) : true;
    const extensionMatch = requestedExtensions.size > 0 ? requestedExtensions.has(file.extension) : true;
    return nameMatch && extensionMatch;
  });

  const limit = query?.limit ?? filtered.length;
  return filtered.slice(0, Math.max(0, limit));
}

export function createMockFileScannerProvider(seedFiles?: string[]): FileScannerProvider {
  const now = new Date().toISOString();
  const roots = defaultRoots();
  const files = (seedFiles ?? [
    path.join(roots[0], "architecture-notes.md"),
    path.join(roots[0], "roadmap-draft.txt"),
    path.join(roots[1], "release-plan.pdf")
  ]).map((filePath) => ({
    path: filePath,
    name: path.basename(filePath),
    extension: extensionFromPath(filePath),
    source: "mock" as const,
    modifiedAt: now
  }));

  return {
    providerName: "mock-file-scanner",
    async scanFiles(query?: FileSearchQuery): Promise<ScannedFile[]> {
      return applyFileQueryFilters(files, query);
    }
  };
}

/**
 * Extension point for real filesystem scanning.
 * A future implementation can walk query roots with fs/promises and stream indexed results.
 */
export function createLocalFilesystemScannerProvider(): FileScannerProvider {
  return {
    providerName: "local-filesystem-scanner",
    async scanFiles(_query?: FileSearchQuery): Promise<ScannedFile[]> {
      return [];
    }
  };
}

export interface FileScannerServiceOptions {
  providers?: FileScannerProvider[];
}

export function createFileScannerService(options: FileScannerServiceOptions = {}): FileScannerService {
  const providers = options.providers ?? [createMockFileScannerProvider()];

  return {
    async scanFiles(query?: FileSearchQuery): Promise<ScannedFile[]> {
      const results = await Promise.all(providers.map((provider) => provider.scanFiles(query)));
      return results.flat();
    }
  };
}
