import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { api } from "../api/client";
const playbackAction = async (action) => {
    try {
        await api.post(`/spotify/playback/${action}`);
    }
    catch { /* best-effort */ }
};
export const SpotifyWidget = ({ connected, nowPlaying, onRefresh }) => {
    if (!connected) {
        return (_jsxs("div", { className: "spotify-widget spotify-widget--disconnected", children: [_jsx("div", { className: "spotify-widget-icon", children: "\u266B" }), _jsxs("div", { children: [_jsx("p", { className: "spotify-widget-title", children: "Spotify" }), _jsx("p", { className: "spotify-widget-sub", children: "Not connected" })] }), _jsx("a", { className: "spotify-connect-btn", href: `${import.meta.env.VITE_API_BASE_URL ?? "/api"}/spotify/oauth/url`, children: "Connect" })] }));
    }
    if (!nowPlaying || !nowPlaying.isPlaying) {
        return (_jsxs("div", { className: "spotify-widget spotify-widget--idle", children: [_jsx("div", { className: "spotify-widget-icon", children: "\u266B" }), _jsxs("div", { className: "spotify-widget-info", children: [_jsx("p", { className: "spotify-widget-title", children: "Spotify" }), _jsx("p", { className: "spotify-widget-sub", children: "Nothing playing" })] }), _jsx("button", { className: "spotify-refresh-btn", onClick: onRefresh, "aria-label": "Refresh", children: "\u21BB" })] }));
    }
    const { track, device } = nowPlaying;
    return (_jsxs("div", { className: "spotify-widget spotify-widget--playing", children: [_jsx("div", { className: "spotify-art", children: track?.albumArt ? (_jsx("img", { src: track.albumArt, alt: "Album art", className: "spotify-art-img" })) : (_jsx("div", { className: "spotify-art-placeholder", children: "\u266B" })) }), _jsxs("div", { className: "spotify-widget-body", children: [_jsx("p", { className: "spotify-track-name", children: track?.name ?? "—" }), _jsx("p", { className: "spotify-artist", children: track?.artists ?? "—" }), device && _jsxs("p", { className: "spotify-device", children: ["\u25B8 ", device.name] }), _jsxs("div", { className: "spotify-controls", children: [_jsx("button", { onClick: () => void playbackAction("previous"), "aria-label": "Previous", children: "\u23EE" }), _jsx("button", { className: "spotify-playpause", onClick: () => void playbackAction(nowPlaying.isPlaying ? "pause" : "play"), "aria-label": nowPlaying.isPlaying ? "Pause" : "Play", children: nowPlaying.isPlaying ? "⏸" : "▶" }), _jsx("button", { onClick: () => void playbackAction("next"), "aria-label": "Next", children: "\u23ED" }), _jsx("button", { className: "spotify-refresh-small", onClick: onRefresh, "aria-label": "Refresh", children: "\u21BB" })] })] })] }));
};
