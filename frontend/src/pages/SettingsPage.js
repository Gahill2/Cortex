import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api } from "../api/client";
export const SettingsPage = ({ onLogout }) => {
    const [spotifyConnected, setSpotifyConnected] = useState(false);
    const [spotifyLoading, setSpotifyLoading] = useState(true);
    const [oauthUrl, setOauthUrl] = useState(null);
    useEffect(() => {
        void loadSpotifyStatus();
    }, []);
    const loadSpotifyStatus = async () => {
        setSpotifyLoading(true);
        try {
            const res = await api.get("/spotify/status");
            setSpotifyConnected(res.data?.data?.connected ?? false);
            if (!res.data?.data?.connected) {
                try {
                    const urlRes = await api.get("/spotify/oauth/url");
                    setOauthUrl(urlRes.data?.data?.url ?? null);
                }
                catch { /* ignore */ }
            }
        }
        catch { /* ignore */ }
        finally {
            setSpotifyLoading(false);
        }
    };
    const disconnectSpotify = async () => {
        try {
            await api.post("/spotify/disconnect");
            setSpotifyConnected(false);
            await loadSpotifyStatus();
        }
        catch { /* ignore */ }
    };
    return (_jsxs("div", { className: "page settings-page", children: [_jsx("header", { className: "page-header", children: _jsx("h1", { className: "page-title", children: "Settings" }) }), _jsxs("section", { className: "settings-section", children: [_jsx("h2", { className: "settings-section-title", children: "Connections" }), _jsxs("div", { className: "settings-row", children: [_jsx("div", { className: "settings-row-icon settings-row-icon--spotify", children: "\u266B" }), _jsxs("div", { className: "settings-row-body", children: [_jsx("p", { className: "settings-row-label", children: "Spotify" }), _jsx("p", { className: "settings-row-sub", children: spotifyLoading ? "Checking…" : spotifyConnected ? "Connected" : "Not connected" })] }), !spotifyLoading && (spotifyConnected ? (_jsx("button", { className: "settings-disconnect-btn", onClick: () => void disconnectSpotify(), children: "Disconnect" })) : (_jsx("a", { className: "settings-connect-btn", href: oauthUrl ?? "#", rel: "noopener noreferrer", children: "Connect" })))] })] }), _jsxs("section", { className: "settings-section", children: [_jsx("h2", { className: "settings-section-title", children: "Account" }), _jsxs("div", { className: "settings-row", children: [_jsx("div", { className: "settings-row-icon", children: "\u2699" }), _jsxs("div", { className: "settings-row-body", children: [_jsx("p", { className: "settings-row-label", children: "Session" }), _jsx("p", { className: "settings-row-sub", children: "Signed in via email OTP" })] })] })] }), _jsx("button", { className: "settings-logout-btn", onClick: onLogout, children: "Sign out" })] }));
};
