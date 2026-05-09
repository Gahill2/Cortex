import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api } from "../api/client";
const greeting = () => {
    const h = new Date().getHours();
    if (h < 12)
        return "Good morning";
    if (h < 17)
        return "Good afternoon";
    return "Good evening";
};
const control = async (action, onRefresh) => {
    try {
        await api.post(`/spotify/playback/${action}`);
        setTimeout(onRefresh, 600);
    }
    catch { /* ignore */ }
};
export const HomePage = ({ onNavigate }) => {
    const [nowPlaying, setNowPlaying] = useState(null);
    const [spotifyConnected, setSpotifyConnected] = useState(false);
    const [spotifyLoading, setSpotifyLoading] = useState(true);
    const [tasks, setTasks] = useState([]);
    const [quickPrompt, setQuickPrompt] = useState("");
    const [quickReply, setQuickReply] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        void loadSpotify();
        void loadTasks();
        const tick = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(tick);
    }, []);
    const loadSpotify = async () => {
        setSpotifyLoading(true);
        try {
            const s = await api.get("/spotify/status");
            const connected = s.data?.data?.connected ?? false;
            setSpotifyConnected(connected);
            if (connected) {
                const np = await api.get("/spotify/now-playing");
                setNowPlaying(np.data?.data ?? np.data ?? null);
            }
        }
        catch { /* ignore */ }
        finally {
            setSpotifyLoading(false);
        }
    };
    const loadTasks = async () => {
        try {
            const res = await api.get("/tasks");
            const t = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
            setTasks(t);
        }
        catch { /* ignore */ }
    };
    const sendQuick = async (e) => {
        e.preventDefault();
        const msg = quickPrompt.trim();
        if (!msg)
            return;
        setAiLoading(true);
        setQuickReply(null);
        try {
            const res = await api.post("/ai/chat", { message: msg });
            setQuickReply(res.data?.data?.reply ?? res.data?.reply ?? "Done.");
            setQuickPrompt("");
        }
        catch {
            setQuickReply("AI unavailable.");
        }
        finally {
            setAiLoading(false);
        }
    };
    const todo = tasks.filter((t) => t.status === "TODO");
    const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS");
    const done = tasks.filter((t) => t.status === "DONE");
    const hh = time.getHours().toString().padStart(2, "0");
    const mm = time.getMinutes().toString().padStart(2, "0");
    const ss = time.getSeconds().toString().padStart(2, "0");
    const dateStr = time.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    return (_jsxs("div", { className: "page home-page", children: [_jsx("div", { className: "page-titlebar", children: _jsxs("div", { children: [_jsx("p", { className: "page-eyebrow", children: greeting() }), _jsx("h1", { className: "page-title", children: "Home" })] }) }), _jsxs("div", { className: "widget-grid", children: [_jsxs("div", { className: "widget widget--clock", children: [_jsxs("p", { className: "clock-time", children: [hh, ":", mm, _jsxs("span", { className: "clock-sec", children: [":", ss] })] }), _jsx("p", { className: "clock-date", children: dateStr }), _jsxs("div", { className: "widget-status-row", children: [_jsx("span", { className: "widget-status-dot" }), _jsx("span", { className: "widget-status-text", children: "System online" })] })] }), _jsxs("div", { className: `widget widget--spotify ${spotifyConnected && nowPlaying?.isPlaying ? "widget--spotify-active" : ""}`, onClick: () => !spotifyConnected && onNavigate("settings"), style: { cursor: spotifyConnected ? "default" : "pointer" }, children: [_jsx("div", { className: "widget-label", children: "\u266B Spotify" }), spotifyLoading ? (_jsx("p", { className: "widget-empty", children: "Checking\u2026" })) : !spotifyConnected ? (_jsxs("div", { className: "widget-cta", onClick: (e) => { e.stopPropagation(); onNavigate("settings"); }, children: [_jsx("p", { className: "widget-cta-text", children: "Not connected" }), _jsx("button", { className: "widget-cta-btn", children: "Connect in Settings \u2192" })] })) : !nowPlaying?.isPlaying ? (_jsx("p", { className: "widget-empty", children: "Nothing playing" })) : (_jsxs("div", { className: "spotify-widget-body", children: [_jsx("div", { className: "spotify-widget-art", children: nowPlaying.track?.albumArt
                                            ? _jsx("img", { src: nowPlaying.track.albumArt, alt: "Album" })
                                            : _jsx("div", { className: "spotify-art-fallback", children: "\u266B" }) }), _jsxs("div", { className: "spotify-widget-info", children: [_jsx("p", { className: "spotify-widget-track", children: nowPlaying.track?.name }), _jsx("p", { className: "spotify-widget-artist", children: nowPlaying.track?.artists }), nowPlaying.device && _jsxs("p", { className: "spotify-widget-device", children: ["\u25B8 ", nowPlaying.device.name] })] })] })), spotifyConnected && nowPlaying?.isPlaying && (_jsxs("div", { className: "spotify-widget-controls", onClick: (e) => e.stopPropagation(), children: [_jsx("button", { onClick: () => void control("previous", loadSpotify), children: "\u23EE" }), _jsx("button", { className: "spotify-pp", onClick: () => void control(nowPlaying.isPlaying ? "pause" : "play", loadSpotify), children: nowPlaying.isPlaying ? "⏸" : "▶" }), _jsx("button", { onClick: () => void control("next", loadSpotify), children: "\u23ED" }), _jsx("button", { className: "spotify-refresh", onClick: () => void loadSpotify(), children: "\u21BB" })] }))] }), _jsxs("div", { className: "widget widget--tasks", onClick: () => onNavigate("tasks"), role: "button", tabIndex: 0, children: [_jsx("div", { className: "widget-label", children: "\u2713 Tasks" }), _jsxs("div", { className: "widget-task-stats", children: [_jsxs("div", { className: "widget-task-stat", children: [_jsx("span", { className: "widget-task-num", children: todo.length }), _jsx("span", { className: "widget-task-lbl", children: "To do" })] }), _jsxs("div", { className: "widget-task-stat widget-task-stat--active", children: [_jsx("span", { className: "widget-task-num", children: inProgress.length }), _jsx("span", { className: "widget-task-lbl", children: "Active" })] }), _jsxs("div", { className: "widget-task-stat widget-task-stat--done", children: [_jsx("span", { className: "widget-task-num", children: done.length }), _jsx("span", { className: "widget-task-lbl", children: "Done" })] })] }), _jsxs("ul", { className: "widget-task-list", children: [todo.slice(0, 4).map((t) => (_jsxs("li", { className: "widget-task-item", children: [_jsx("span", { className: "widget-task-dot", children: "\u25CB" }), _jsx("span", { className: "widget-task-title", children: t.title })] }, t.id))), inProgress.slice(0, 2).map((t) => (_jsxs("li", { className: "widget-task-item widget-task-item--active", children: [_jsx("span", { className: "widget-task-dot", children: "\u25D1" }), _jsx("span", { className: "widget-task-title", children: t.title })] }, t.id))), tasks.length === 0 && _jsx("li", { className: "widget-empty", children: "No tasks yet" })] }), _jsx("div", { className: "widget-open-hint", children: "Click to open Tasks \u2192" })] }), _jsxs("div", { className: "widget widget--ai", children: [_jsx("div", { className: "widget-label", children: "\u25C8 AI Assistant" }), quickReply ? (_jsxs("div", { className: "widget-ai-reply", children: [_jsx("p", { children: quickReply }), _jsx("button", { className: "widget-ai-reply-clear", onClick: () => setQuickReply(null), children: "\u00D7" })] })) : (_jsx("p", { className: "widget-ai-idle", children: "Ask anything or open the full chat below" })), _jsxs("form", { className: "widget-ai-form", onSubmit: sendQuick, onClick: (e) => e.stopPropagation(), children: [_jsx("input", { className: "widget-ai-input", value: quickPrompt, onChange: (e) => setQuickPrompt(e.target.value), placeholder: "Quick question\u2026", disabled: aiLoading }), _jsx("button", { type: "submit", className: "widget-ai-send", disabled: aiLoading || !quickPrompt.trim(), children: aiLoading ? "…" : "→" })] }), _jsx("button", { className: "widget-open-hint", onClick: () => onNavigate("ai"), children: "Open full AI chat \u2192" })] }), inProgress.length > 0 && (_jsxs("div", { className: "widget widget--active-tasks", onClick: () => onNavigate("tasks"), role: "button", tabIndex: 0, children: [_jsx("div", { className: "widget-label", children: "\u25D1 In Progress" }), _jsx("ul", { className: "widget-task-list", children: inProgress.map((t) => (_jsxs("li", { className: "widget-task-item widget-task-item--active", children: [_jsx("span", { className: "widget-task-dot", children: "\u25D1" }), _jsx("span", { className: "widget-task-title", children: t.title }), _jsx("span", { className: "widget-task-proj", children: t.project.name })] }, t.id))) }), _jsx("div", { className: "widget-open-hint", children: "Click to manage \u2192" })] })), _jsxs("div", { className: "widget widget--settings", onClick: () => onNavigate("settings"), role: "button", tabIndex: 0, children: [_jsx("div", { className: "widget-label", children: "\u2699 Settings" }), _jsx("div", { className: "widget-integrations", children: _jsxs("div", { className: `widget-integration ${spotifyConnected ? "connected" : ""}`, children: [_jsx("span", { className: "widget-integration-icon", children: "\u266B" }), _jsx("span", { className: "widget-integration-name", children: "Spotify" }), _jsx("span", { className: `widget-integration-status ${spotifyConnected ? "on" : "off"}`, children: spotifyConnected ? "Connected" : "Disconnected" })] }) }), _jsx("div", { className: "widget-open-hint", children: "Open Settings \u2192" })] })] })] }));
};
