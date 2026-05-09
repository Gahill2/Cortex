import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { api } from "../api/client";
const control = async (action) => {
    try {
        await api.post(`/spotify/playback/${action}`);
    }
    catch { /* best-effort */ }
};
export const SpotifyWidget = ({ connected, nowPlaying, onRefresh }) => {
    if (!connected) {
        return (_jsxs("div", { className: "widget-card spotify-widget", children: [_jsxs("div", { className: "widget-header", children: [_jsx("h2", { className: "widget-title", children: "\u266B Spotify" }), _jsx("a", { className: "btn-primary btn-sm", href: `${import.meta.env.VITE_API_BASE_URL ?? "/api"}/spotify/oauth/url`, children: "Connect" })] }), _jsx("p", { className: "widget-empty", children: "Not connected" })] }));
    }
    if (!nowPlaying?.isPlaying) {
        return (_jsxs("div", { className: "widget-card spotify-widget", children: [_jsxs("div", { className: "widget-header", children: [_jsx("h2", { className: "widget-title", children: "\u266B Spotify" }), _jsx("button", { className: "btn-ghost btn-sm", onClick: onRefresh, children: "Refresh" })] }), _jsx("p", { className: "widget-empty", children: "Nothing playing" })] }));
    }
    const { track, device } = nowPlaying;
    return (_jsxs("div", { className: "widget-card spotify-widget spotify-widget--active", children: [_jsxs("div", { className: "widget-header", children: [_jsx("h2", { className: "widget-title", children: "\u266B Now Playing" }), _jsx("button", { className: "btn-ghost btn-sm", onClick: onRefresh, children: "\u21BB" })] }), _jsxs("div", { className: "spotify-body", children: [_jsx("div", { className: "spotify-art", children: track?.albumArt
                            ? _jsx("img", { src: track.albumArt, alt: "Album art" })
                            : _jsx("div", { className: "spotify-art-fallback", children: "\u266B" }) }), _jsxs("div", { className: "spotify-info", children: [_jsx("p", { className: "spotify-track", children: track?.name }), _jsx("p", { className: "spotify-artist", children: track?.artists }), device && _jsxs("p", { className: "spotify-device", children: ["\u25B8 ", device.name] })] })] }), _jsxs("div", { className: "spotify-controls", children: [_jsx("button", { onClick: () => void control("previous"), title: "Previous", children: "\u23EE" }), _jsx("button", { className: "spotify-playpause", onClick: () => void control(nowPlaying.isPlaying ? "pause" : "play"), children: nowPlaying.isPlaying ? "⏸" : "▶" }), _jsx("button", { onClick: () => void control("next"), title: "Next", children: "\u23ED" })] })] }));
};
