import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { SpotifyWidget } from "../components/SpotifyWidget";
const greeting = () => {
    const h = new Date().getHours();
    if (h < 12)
        return "Good morning";
    if (h < 17)
        return "Good afternoon";
    return "Good evening";
};
export const HomePage = () => {
    const [nowPlaying, setNowPlaying] = useState(null);
    const [spotifyConnected, setSpotifyConnected] = useState(false);
    const [tasks, setTasks] = useState([]);
    const [quickPrompt, setQuickPrompt] = useState("");
    const [quickReply, setQuickReply] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    useEffect(() => {
        void loadSpotify();
        void loadTasks();
    }, []);
    const loadSpotify = async () => {
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
    };
    const loadTasks = async () => {
        try {
            const res = await api.get("/tasks");
            const t = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
            setTasks(t);
        }
        catch { /* ignore */ }
    };
    const sendQuick = async () => {
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
    const open = tasks.filter((t) => t.status === "TODO").length;
    const active = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const done = tasks.filter((t) => t.status === "DONE").length;
    return (_jsxs("div", { className: "page", children: [_jsx("div", { className: "page-titlebar", children: _jsxs("div", { children: [_jsx("p", { className: "page-eyebrow", children: greeting() }), _jsx("h1", { className: "page-title", children: "Home" })] }) }), _jsxs("div", { className: "stats-row", children: [_jsxs("div", { className: "stat-card", children: [_jsx("p", { className: "stat-value", children: open }), _jsx("p", { className: "stat-label", children: "To do" })] }), _jsxs("div", { className: "stat-card stat-card--active", children: [_jsx("p", { className: "stat-value", children: active }), _jsx("p", { className: "stat-label", children: "In progress" })] }), _jsxs("div", { className: "stat-card stat-card--done", children: [_jsx("p", { className: "stat-value", children: done }), _jsx("p", { className: "stat-label", children: "Done" })] }), _jsxs("div", { className: "stat-card", children: [_jsx("p", { className: "stat-value", children: tasks.length }), _jsx("p", { className: "stat-label", children: "Total tasks" })] })] }), _jsxs("div", { className: "home-grid", children: [_jsxs("div", { className: "home-col", children: [_jsx(SpotifyWidget, { connected: spotifyConnected, nowPlaying: nowPlaying, onRefresh: loadSpotify }), _jsxs("div", { className: "widget-card", children: [_jsx("div", { className: "widget-header", children: _jsx("h2", { className: "widget-title", children: "Recent tasks" }) }), tasks.length === 0 ? (_jsx("p", { className: "widget-empty", children: "No tasks yet" })) : (_jsx("ul", { className: "task-list-mini", children: tasks.slice(0, 8).map((t) => (_jsxs("li", { className: `task-list-mini-item ${t.status === "DONE" ? "done" : ""}`, children: [_jsx("span", { className: "task-mini-dot", children: t.status === "DONE" ? "●" : t.status === "IN_PROGRESS" ? "◑" : "○" }), _jsx("span", { className: "task-mini-title", children: t.title }), _jsx("span", { className: "task-mini-project", children: t.project.name })] }, t.id))) }))] })] }), _jsx("div", { className: "home-col", children: _jsxs("div", { className: "widget-card widget-card--ai", children: [_jsx("div", { className: "widget-header", children: _jsx("h2", { className: "widget-title", children: "\u25C8 Quick AI" }) }), quickReply && (_jsx("div", { className: "quick-reply-box", children: _jsx("p", { className: "quick-reply-text", children: quickReply }) })), _jsxs("div", { className: "quick-ai-row", children: [_jsx("input", { className: "quick-ai-input", value: quickPrompt, onChange: (e) => setQuickPrompt(e.target.value), onKeyDown: (e) => e.key === "Enter" && void sendQuick(), placeholder: "Ask anything\u2026" }), _jsx("button", { className: "quick-ai-btn", onClick: () => void sendQuick(), disabled: aiLoading || !quickPrompt.trim(), children: aiLoading ? "…" : "Ask →" })] })] }) })] })] }));
};
