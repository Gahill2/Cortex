import { api } from "./client";
let cache = null;
let inflight = null;
export async function getServerIntegrationConfig() {
    if (cache)
        return cache;
    if (inflight)
        return inflight;
    inflight = (async () => {
        try {
            const r = await api.get("/health");
            const h = r.data;
            const cfg = {
                spotify: Boolean(h.spotify_configured),
                gmail: Boolean(h.gmail_configured?.is_configured),
                notion: Boolean(h.notion_configured),
                anthropic: Boolean(h.anthropic_configured),
                firebase: Boolean(h.firebase_configured),
                n8n: Boolean(h.n8n_configured),
            };
            cache = cfg;
            return cfg;
        }
        catch {
            return {
                spotify: false,
                gmail: false,
                notion: false,
                anthropic: false,
                firebase: false,
                n8n: false,
            };
        }
        finally {
            inflight = null;
        }
    })();
    return inflight;
}
export function clearServerIntegrationConfigCache() {
    cache = null;
}
