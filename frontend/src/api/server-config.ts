import { api } from "./client";

/** Public `/api/health` flags — env keys on the API server (no OAuth). */
export type ServerIntegrationConfig = {
  spotify: boolean;
  linkedin: boolean;
  gmail: boolean;
  notion: boolean;
  anthropic: boolean;
  firebase: boolean;
  n8n: boolean;
};

type HealthResponse = {
  anthropic_configured?: boolean;
  firebase_configured?: boolean;
  n8n_configured?: boolean;
  spotify_configured?: boolean;
  linkedin_configured?: boolean;
  notion_configured?: boolean;
  gmail_configured?: { is_configured?: boolean };
};

let cache: ServerIntegrationConfig | null = null;
let inflight: Promise<ServerIntegrationConfig> | null = null;

export async function getServerIntegrationConfig(): Promise<ServerIntegrationConfig> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const r = await api.get<HealthResponse>("/health");
      const h = r.data;
      const cfg: ServerIntegrationConfig = {
        spotify: Boolean(h.spotify_configured),
        linkedin: Boolean(h.linkedin_configured),
        gmail: Boolean(h.gmail_configured?.is_configured),
        notion: Boolean(h.notion_configured),
        anthropic: Boolean(h.anthropic_configured),
        firebase: Boolean(h.firebase_configured),
        n8n: Boolean(h.n8n_configured),
      };
      cache = cfg;
      return cfg;
    } catch {
      return {
        spotify: false,
        linkedin: false,
        gmail: false,
        notion: false,
        anthropic: false,
        firebase: false,
        n8n: false,
      };
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function clearServerIntegrationConfigCache(): void {
  cache = null;
}
