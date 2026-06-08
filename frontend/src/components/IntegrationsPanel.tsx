import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { getServerIntegrationConfig } from "../api/server-config";

export type IntegrationItem = {
  id: string;
  name: string;
  configured: boolean;
  connected: boolean;
  detail?: string;
};

interface Props {
  compact?: boolean;
  onNavigateSettings?: () => void;
}

export const IntegrationsPanel = ({ compact, onNavigateSettings }: Props) => {
  const [items, setItems] = useState<IntegrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiStale, setApiStale] = useState(false);

  useEffect(() => {
    void (async () => {
      const server = await getServerIntegrationConfig();
      try {
        const r = await api.get<{ data?: { items?: IntegrationItem[] } }>("/integrations/status");
        const fromApi = r.data?.data?.items ?? [];
        setItems(
          fromApi.map((item) => {
            const envConfigured =
              item.id === "spotify"
                ? server.spotify
                : item.id === "linkedin"
                  ? server.linkedin
                : item.id === "google" || item.id === "gmail"
                  ? server.gmail
                  : item.id === "notion"
                    ? server.notion
                    : item.configured;
            return envConfigured ? { ...item, configured: true } : item;
          })
        );
        setApiStale(false);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        setApiStale(status === 404);
        setItems(
          [
            { id: "spotify", name: "Spotify", configured: server.spotify, connected: false },
            { id: "google", name: "Google", configured: server.gmail, connected: false },
            { id: "linkedin", name: "LinkedIn", configured: server.linkedin, connected: false },
            { id: "notion", name: "Notion", configured: server.notion, connected: false },
          ].filter((i) => i.configured)
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <p className="integrations-loading">Loading integrations…</p>;
  }

  if (apiStale) {
    return (
      <p className="integrations-stale">
        API is out of date — stop dev servers and run <code>npm run dev:web</code> or <code>npm run dev</code>, then refresh.
      </p>
    );
  }

  return (
    <motion.div
      className={`integrations-panel ${compact ? "integrations-panel--compact" : ""}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {!compact && (
        <div className="integrations-panel-header">
          <h2 className="integrations-panel-title">Connected services</h2>
          {onNavigateSettings && (
            <button type="button" className="btn-ghost btn-sm" onClick={onNavigateSettings}>
              Manage
            </button>
          )}
        </div>
      )}
      <div className="integrations-grid">
        {items.map((item) => (
          <div
            key={item.id}
            className={`integration-chip integration-chip--${item.id} ${
              item.connected ? "integration-chip--on" : item.configured ? "integration-chip--partial" : ""
            }`}
            title={item.detail}
          >
            <span className="integration-chip-dot" />
            <span className="integration-chip-name">{item.name}</span>
            {!compact && item.detail && (
              <span className="integration-chip-detail">{item.detail}</span>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
};
