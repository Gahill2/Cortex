import {
  type AppDiscoveryProvider,
  type AppDiscoveryQuery,
  type AppDiscoveryService,
  type DiscoveredApp
} from "../lib/app-discovery.js";

const MOCK_APPS: DiscoveredApp[] = [
  {
    id: "obsidian",
    name: "Obsidian",
    executablePath: "C:\\Program Files\\Obsidian\\Obsidian.exe",
    source: "mock"
  },
  {
    id: "vscode",
    name: "Visual Studio Code",
    executablePath: "C:\\Users\\Public\\Code.exe",
    source: "mock"
  },
  {
    id: "chrome",
    name: "Google Chrome",
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    source: "mock"
  }
];

function applyAppQueryFilters(apps: DiscoveredApp[], query?: AppDiscoveryQuery): DiscoveredApp[] {
  const searchTerm = query?.search?.trim().toLowerCase();
  const filtered = searchTerm
    ? apps.filter((app) => app.name.toLowerCase().includes(searchTerm) || app.id.toLowerCase().includes(searchTerm))
    : apps;

  const limit = query?.limit ?? filtered.length;
  return filtered.slice(0, Math.max(0, limit));
}

export function createMockAppDiscoveryProvider(seedApps: DiscoveredApp[] = MOCK_APPS): AppDiscoveryProvider {
  return {
    providerName: "mock-app-discovery",
    async discoverApps(query?: AppDiscoveryQuery): Promise<DiscoveredApp[]> {
      return applyAppQueryFilters(seedApps, query);
    }
  };
}

/**
 * Extension point for future native registry-based app discovery on Windows.
 * This stub intentionally returns no results until registry integration is implemented.
 */
export function createWindowsRegistryAppDiscoveryProvider(): AppDiscoveryProvider {
  return {
    providerName: "windows-registry-app-discovery",
    async discoverApps(_query?: AppDiscoveryQuery): Promise<DiscoveredApp[]> {
      return [];
    }
  };
}

export interface AppDiscoveryServiceOptions {
  providers?: AppDiscoveryProvider[];
}

export function createAppDiscoveryService(options: AppDiscoveryServiceOptions = {}): AppDiscoveryService {
  const providers = options.providers ?? [createMockAppDiscoveryProvider()];

  return {
    async discoverApps(query?: AppDiscoveryQuery): Promise<DiscoveredApp[]> {
      const results = await Promise.all(providers.map((provider) => provider.discoverApps(query)));
      return results.flat();
    }
  };
}
