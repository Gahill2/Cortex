import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { getServerIntegrationConfig } from "../api/server-config";
import { IntegrationsPanel } from "../components/IntegrationsPanel";
import { ConnectOAuthButton } from "../components/ConnectOAuthButton";
export const SettingsPage = ({ onLogout }) => {
    const [spotifyConnected, setSpotifyConnected] = useState(false);
    const [spotifyConfigured, setSpotifyConfigured] = useState(false);
    const [oauthUrl, setOauthUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [firebaseSyncing, setFirebaseSyncing] = useState(false);
    const [firebaseMsg, setFirebaseMsg] = useState(null);
    const [integrations, setIntegrations] = useState([]);
    const [billingStatus, setBillingStatus] = useState("free");
    const [billingConfigured, setBillingConfigured] = useState(false);
    const [billingBusy, setBillingBusy] = useState(false);
    const [memoryConfig, setMemoryConfig] = useState(null);
    const [memoryLoading, setMemoryLoading] = useState(true);
    const [syncingMemory, setSyncingMemory] = useState(false);
    const [memoryMsg, setMemoryMsg] = useState(null);
    const [electronMemory, setElectronMemory] = useState(null);
    const isElectron = Boolean(window.electron?.isElectron);
    useEffect(() => {
        void loadSpotify();
        void loadIntegrations();
        void loadBilling();
        void loadMemoryConfig();
        if (isElectron)
            void loadElectronMemory();
    }, []);
    const loadMemoryConfig = async () => {
        setMemoryLoading(true);
        try {
            const r = await api.get("/memory/config");
            setMemoryConfig(r.data?.data ?? null);
        }
        catch {
            setMemoryConfig(null);
        }
        finally {
            setMemoryLoading(false);
        }
    };
    const syncMemoryConfig = async () => {
        setSyncingMemory(true);
        setMemoryMsg(null);
        try {
            const r = await api.put("/memory/config", {});
            setMemoryConfig(r.data?.data ?? null);
            setMemoryMsg(r.data?.data?.sync.firebaseConfigured ? "Memory config synced." : "Firebase not configured — local only.");
        }
        catch {
            setMemoryMsg("Sync failed.");
        }
        finally {
            setSyncingMemory(false);
        }
    };
    const loadElectronMemory = async () => {
        const bridge = window.electron;
        if (!bridge?.getMemoryStatus)
            return;
        try {
            setElectronMemory(await bridge.getMemoryStatus());
        }
        catch {
            setElectronMemory(null);
        }
    };
    const loadBilling = async () => {
        try {
            const r = await api.get("/billing/status");
            setBillingStatus(r.data?.data?.subscriptionStatus ?? "free");
            setBillingConfigured(r.data?.data?.configured ?? false);
        }
        catch { /* ignore */ }
    };
    const startCheckout = async () => {
        setBillingBusy(true);
        try {
            const r = await api.post("/billing/checkout", {});
            const url = r.data?.data?.url;
            if (url)
                window.location.href = url;
        }
        catch { /* ignore */ }
        finally {
            setBillingBusy(false);
        }
    };
    const openPortal = async () => {
        setBillingBusy(true);
        try {
            const r = await api.post("/billing/portal", {});
            const url = r.data?.data?.url;
            if (url)
                window.location.href = url;
        }
        catch { /* ignore */ }
        finally {
            setBillingBusy(false);
        }
    };
    const loadIntegrations = async () => {
        try {
            const r = await api.get("/integrations/status");
            setIntegrations(r.data?.data?.items ?? []);
        }
        catch {
            setIntegrations([]);
        }
    };
    const loadSpotify = async () => {
        setLoading(true);
        const server = await getServerIntegrationConfig();
        setSpotifyConfigured(server.spotify);
        try {
            const r = await api.get("/spotify/status");
            const data = r.data?.data;
            const connected = data?.connected ?? false;
            const configured = data?.configured ?? server.spotify;
            setSpotifyConnected(connected);
            setSpotifyConfigured(configured);
            if (!connected && configured) {
                try {
                    const u = await api.get("/spotify/oauth/url");
                    setOauthUrl(u.data?.data?.url ?? null);
                }
                catch {
                    setOauthUrl(null);
                }
            }
            else {
                setOauthUrl(null);
            }
        }
        catch { /* ignore */ }
        finally {
            setLoading(false);
        }
    };
    const disconnect = async () => {
        try {
            await api.post("/spotify/disconnect");
            await loadSpotify();
        }
        catch { /* ignore */ }
    };
    const pushEnvToFirestore = async () => {
        setFirebaseSyncing(true);
        setFirebaseMsg(null);
        try {
            await api.post("/firebase/env/push");
            setFirebaseMsg("Env pushed to Firestore.");
        }
        catch {
            setFirebaseMsg("Push failed — check Firebase config.");
        }
        finally {
            setFirebaseSyncing(false);
        }
    };
    const pullEnvFromFirestore = async () => {
        setFirebaseSyncing(true);
        setFirebaseMsg(null);
        try {
            await api.post("/firebase/env/pull");
            setFirebaseMsg("Env pulled from Firestore (restart API to apply).");
        }
        catch {
            setFirebaseMsg("Pull failed — check Firebase config.");
        }
        finally {
            setFirebaseSyncing(false);
        }
    };
    const gmail = integrations.find((i) => i.id === "gmail");
    const notion = integrations.find((i) => i.id === "notion");
    const firebase = integrations.find((i) => i.id === "firebase");
    const n8n = integrations.find((i) => i.id === "n8n");
    return (_jsxs("div", { className: "page", children: [_jsx("div", { className: "page-titlebar", children: _jsx("h1", { className: "page-title", children: "Settings" }) }), _jsx(IntegrationsPanel, { compact: false }), _jsx("div", { className: "settings-layout", children: _jsxs("div", { className: "settings-col", children: [_jsxs("section", { className: "settings-section", children: [_jsx("h2", { className: "settings-section-title", children: "Integrations" }), _jsxs("div", { className: "settings-item", children: [_jsxs("div", { className: "settings-item-left", children: [_jsx("div", { className: "settings-item-icon settings-item-icon--spotify", children: "\u266B" }), _jsxs("div", { children: [_jsx("p", { className: "settings-item-name", children: "Spotify" }), _jsx("p", { className: "settings-item-desc", children: loading
                                                                ? "Checking…"
                                                                : spotifyConnected
                                                                    ? "Connected"
                                                                    : spotifyConfigured
                                                                        ? "Keys in .env — link your Spotify account once"
                                                                        : "Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to backend .env" })] })] }), !loading && (spotifyConnected
                                            ? _jsx("button", { type: "button", className: "btn-ghost btn-sm", onClick: () => void disconnect(), children: "Disconnect" })
                                            : spotifyConfigured
                                                ? _jsx(ConnectOAuthButton, { service: "spotify", label: "Connect", className: "btn-primary btn-sm" })
                                                : _jsx("span", { className: "btn-ghost btn-sm settings-muted", children: "Not configured" }))] }), _jsxs("div", { className: "settings-item", children: [_jsxs("div", { className: "settings-item-left", children: [_jsx("div", { className: "settings-item-icon settings-item-icon--gmail", children: "\u2709" }), _jsxs("div", { children: [_jsx("p", { className: "settings-item-name", children: "Gmail" }), _jsx("p", { className: "settings-item-desc", children: !gmail?.configured
                                                                ? "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env"
                                                                : gmail.connected
                                                                    ? "Inbox linked"
                                                                    : "API keys in .env — one-time Google sign-in required" })] })] }), gmail?.connected ? (_jsx("span", { className: "integration-pill integration-pill--on", children: "Live" })) : gmail?.configured ? (_jsx(ConnectOAuthButton, { service: "gmail", label: "Connect", className: "btn-primary btn-sm" })) : (_jsx("span", { className: "integration-pill", children: "Off" }))] }), _jsxs("div", { className: "settings-item", children: [_jsxs("div", { className: "settings-item-left", children: [_jsx("div", { className: "settings-item-icon settings-item-icon--notion", children: "N" }), _jsxs("div", { children: [_jsx("p", { className: "settings-item-name", children: "Notion" }), _jsx("p", { className: "settings-item-desc", children: notion?.connected
                                                                ? notion.detail ?? "Connected"
                                                                : notion?.configured
                                                                    ? notion.detail ?? "Token set — connection failed"
                                                                    : "Add NOTION_PERSONAL_TOKEN in env" })] })] }), _jsx("span", { className: `integration-pill ${notion?.connected ? "integration-pill--on" : ""}`, children: notion?.connected ? "Live" : notion?.configured ? "Configured" : "Off" })] }), _jsxs("div", { className: "settings-item", children: [_jsxs("div", { className: "settings-item-left", children: [_jsx("div", { className: "settings-item-icon settings-item-icon--firebase", children: "\u26A1" }), _jsxs("div", { children: [_jsx("p", { className: "settings-item-name", children: "Firebase / Firestore" }), _jsx("p", { className: "settings-item-desc", children: firebase?.detail ?? "Cross-device env sync" }), firebaseMsg && _jsx("p", { className: "settings-item-hint", children: firebaseMsg })] })] }), _jsxs("div", { className: "settings-item-actions", children: [_jsx("button", { type: "button", className: "btn-ghost btn-sm", disabled: firebaseSyncing || !firebase?.configured, onClick: () => void pullEnvFromFirestore(), children: "Pull env" }), _jsx("button", { type: "button", className: "btn-primary btn-sm", disabled: firebaseSyncing || !firebase?.configured, onClick: () => void pushEnvToFirestore(), children: "Push env" })] })] }), _jsxs("div", { className: "settings-item", children: [_jsxs("div", { className: "settings-item-left", children: [_jsx("div", { className: "settings-item-icon", children: "\u27F3" }), _jsxs("div", { children: [_jsx("p", { className: "settings-item-name", children: "n8n" }), _jsx("p", { className: "settings-item-desc", children: n8n?.detail ?? "Self-hosted automation" })] })] }), _jsx("span", { className: `integration-pill ${n8n?.configured ? "integration-pill--on" : ""}`, children: n8n?.configured ? "Webhook set" : "Off" })] })] }), _jsxs("section", { className: "settings-section", children: [_jsx("h2", { className: "settings-section-title", children: "Memory" }), _jsxs("div", { className: "settings-item", children: [_jsxs("div", { className: "settings-item-left", children: [_jsx("div", { className: "settings-item-icon", children: "\u25CE" }), _jsxs("div", { children: [_jsx("p", { className: "settings-item-name", children: "Cross-device config" }), _jsx("p", { className: "settings-item-desc", children: memoryLoading
                                                                ? "Loading…"
                                                                : memoryConfig?.sync.firebaseConfigured
                                                                    ? `Source: ${memoryConfig.sync.source}${memoryConfig.sync.updatedAt ? ` · ${new Date(memoryConfig.sync.updatedAt).toLocaleString()}` : ""}`
                                                                    : "Firebase not configured — using local .env" }), memoryConfig && (_jsxs("p", { className: "settings-item-hint", children: [memoryConfig.config.agentmemoryProject || "default project", " \u00B7", " ", memoryConfig.config.vaultPaths.length, " vault path(s)"] })), memoryMsg && _jsx("p", { className: "settings-item-hint", children: memoryMsg })] })] }), _jsx("button", { type: "button", className: "btn-primary btn-sm", disabled: memoryLoading || syncingMemory, onClick: () => void syncMemoryConfig(), children: syncingMemory ? "Syncing…" : "Sync across devices" })] }), isElectron && (_jsxs("div", { className: "settings-item", children: [_jsxs("div", { className: "settings-item-left", children: [_jsx("div", { className: "settings-item-icon", children: "\uD83D\uDDA5" }), _jsxs("div", { children: [_jsx("p", { className: "settings-item-name", children: "Desktop agentmemory" }), _jsxs("p", { className: "settings-item-desc", children: [electronMemory?.online ? "Online" : "Offline", electronMemory?.managed ? " · managed by Cortex" : ""] })] })] }), _jsxs("div", { className: "settings-item-actions", children: [_jsx("button", { type: "button", className: "btn-ghost btn-sm", onClick: () => void window.electron?.openMemoryViewer?.(), children: "Viewer" }), _jsx("button", { type: "button", className: "btn-ghost btn-sm", onClick: () => void window.electron?.copyMemoryMcpConfig?.(), children: "Copy MCP" })] })] }))] }), _jsxs("section", { className: "settings-section", children: [_jsx("h2", { className: "settings-section-title", children: "Billing" }), _jsxs("div", { className: "settings-item", children: [_jsxs("div", { className: "settings-item-left", children: [_jsx("div", { className: "settings-item-icon", children: "\u25C6" }), _jsxs("div", { children: [_jsx("p", { className: "settings-item-name", children: "Cortex Pro" }), _jsx("p", { className: "settings-item-desc", children: billingConfigured
                                                                ? `Status: ${billingStatus}`
                                                                : "Add Stripe keys to enable subscriptions" })] })] }), _jsx("div", { className: "settings-item-actions", children: billingStatus === "active" || billingStatus === "trialing" ? (_jsx("button", { type: "button", className: "btn-ghost btn-sm", disabled: billingBusy || !billingConfigured, onClick: () => void openPortal(), children: "Manage" })) : (_jsx("button", { type: "button", className: "btn-primary btn-sm", disabled: billingBusy || !billingConfigured, onClick: () => void startCheckout(), children: "Upgrade" })) })] })] }), _jsxs("section", { className: "settings-section", children: [_jsx("h2", { className: "settings-section-title", children: "Session" }), _jsxs("div", { className: "settings-item", children: [_jsxs("div", { className: "settings-item-left", children: [_jsx("div", { className: "settings-item-icon", children: "\uD83D\uDC64" }), _jsxs("div", { children: [_jsx("p", { className: "settings-item-name", children: "Account" }), _jsx("p", { className: "settings-item-desc", children: "Signed in via email OTP" })] })] }), _jsx("button", { type: "button", className: "btn-danger btn-sm", onClick: () => {
                                                void api.post("/auth/logout").catch(() => { });
                                                onLogout();
                                            }, children: "Sign out" })] })] })] }) })] }));
};
