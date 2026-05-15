import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { getServerIntegrationConfig } from "../api/server-config";
export const IntegrationsPanel = ({ compact, onNavigateSettings }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [apiStale, setApiStale] = useState(false);
    useEffect(() => {
        void (async () => {
            const server = await getServerIntegrationConfig();
            try {
                const r = await api.get("/integrations/status");
                const fromApi = r.data?.data?.items ?? [];
                setItems(fromApi.map((item) => {
                    const envConfigured = item.id === "spotify"
                        ? server.spotify
                        : item.id === "gmail"
                            ? server.gmail
                            : item.id === "notion"
                                ? server.notion
                                : item.configured;
                    return envConfigured ? { ...item, configured: true } : item;
                }));
                setApiStale(false);
            }
            catch (err) {
                const status = err?.response?.status;
                setApiStale(status === 404);
                setItems([
                    { id: "spotify", name: "Spotify", configured: server.spotify, connected: false },
                    { id: "gmail", name: "Gmail", configured: server.gmail, connected: false },
                    { id: "notion", name: "Notion", configured: server.notion, connected: false },
                ].filter((i) => i.configured));
            }
            finally {
                setLoading(false);
            }
        })();
    }, []);
    if (loading) {
        return _jsx("p", { className: "integrations-loading", children: "Loading integrations\u2026" });
    }
    if (apiStale) {
        return (_jsxs("p", { className: "integrations-stale", children: ["API is out of date \u2014 stop dev servers and run ", _jsx("code", { children: "npm run dev:web" }), " or ", _jsx("code", { children: "npm run dev" }), ", then refresh."] }));
    }
    return (_jsxs(motion.div, { className: `integrations-panel ${compact ? "integrations-panel--compact" : ""}`, initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, children: [!compact && (_jsxs("div", { className: "integrations-panel-header", children: [_jsx("h2", { className: "integrations-panel-title", children: "Connected services" }), onNavigateSettings && (_jsx("button", { type: "button", className: "btn-ghost btn-sm", onClick: onNavigateSettings, children: "Manage" }))] })), _jsx("div", { className: "integrations-grid", children: items.map((item) => (_jsxs("div", { className: `integration-chip integration-chip--${item.id} ${item.connected ? "integration-chip--on" : item.configured ? "integration-chip--partial" : ""}`, title: item.detail, children: [_jsx("span", { className: "integration-chip-dot" }), _jsx("span", { className: "integration-chip-name", children: item.name }), !compact && item.detail && (_jsx("span", { className: "integration-chip-detail", children: item.detail }))] }, item.id))) })] }));
};
