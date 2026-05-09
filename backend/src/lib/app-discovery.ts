export interface DiscoveredApp {
  id: string;
  name: string;
  executablePath: string;
  source: "mock" | "windows-registry" | "custom";
}

export interface AppDiscoveryQuery {
  search?: string;
  limit?: number;
}

export interface AppDiscoveryProvider {
  readonly providerName: string;
  discoverApps(query?: AppDiscoveryQuery): Promise<DiscoveredApp[]>;
}

export interface AppDiscoveryService {
  discoverApps(query?: AppDiscoveryQuery): Promise<DiscoveredApp[]>;
}
