import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api } from "../api/client";
export const SettingsPage = ({ onLogout }) => {
    const [spotifyConnected, setSpotifyConnected] = useState(false);
    const [oauthUrl, setOauthUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => { void loadSpotify(); }, []);
    const loadSpotify = async () => {
        setLoading(true);
        try {
            const r = await api.get("/spotify/status");
            setSpotifyConnected(r.data?.data?.connected ?? false);
            if (!r.data?.data?.connected) {
                const u = await api.get("/spotify/oauth/url");
                setOauthUrl(u.data?.data?.url ?? null);
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
    return (_jsxs("div", { className: "page", children: [_jsx("div", { className: "page-titlebar", children: _jsx("h1", { className: "page-title", children: "Settings" }) }), _jsx("div", { className: "settings-layout", children: _jsxs("div", { className: "settings-col", children: [_jsxs("section", { className: "settings-section", children: [_jsx("h2", { className: "settings-section-title", children: "Integrations" }), _jsxs("div", { className: "settings-item", children: [_jsxs("div", { className: "settings-item-left", children: [_jsx("div", { className: "settings-item-icon settings-item-icon--spotify", children: "\u266B" }), _jsxs("div", { children: [_jsx("p", { className: "settings-item-name", children: "Spotify" }), _jsx("p", { className: "settings-item-desc", children: loading ? "Checking…" : spotifyConnected ? "Connected — now-playing & playback controls active" : "Connect to show what's playing and control playback" })] })] }), !loading && (spotifyConnected
                                            ? _jsx("button", { className: "btn-ghost btn-sm", onClick: () => void disconnect(), children: "Disconnect" })
                                            : _jsx("a", { className: "btn-primary btn-sm", href: oauthUrl ?? "#", children: "Connect" }))] })] }), _jsxs("section", { className: "settings-section", children: [_jsx("h2", { className: "settings-section-title", children: "Session" }), _jsxs("div", { className: "settings-item", children: [_jsxs("div", { className: "settings-item-left", children: [_jsx("div", { className: "settings-item-icon", children: "\uD83D\uDC64" }), _jsxs("div", { children: [_jsx("p", { className: "settings-item-name", children: "Account" }), _jsx("p", { className: "settings-item-desc", children: "Signed in via email OTP" })] })] }), _jsx("button", { className: "btn-danger btn-sm", onClick: onLogout, children: "Sign out" })] })] })] }) })] }));
};
