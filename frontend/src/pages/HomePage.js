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
    const [openTasks, setOpenTasks] = useState(null);
    const [quickPrompt, setQuickPrompt] = useState("");
    const [quickReply, setQuickReply] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    useEffect(() => {
        void loadSpotify();
        void loadTaskCount();
    }, []);
    const loadSpotify = async () => {
        try {
            const status = await api.get("/spotify/status");
            const connected = status.data?.data?.connected ?? false;
            setSpotifyConnected(connected);
            if (connected) {
                const np = await api.get("/spotify/now-playing");
                setNowPlaying(np.data?.data ?? np.data ?? null);
            }
        }
        catch {
            /* ignore */
        }
    };
    const loadTaskCount = async () => {
        try {
            const res = await api.get("/tasks");
            const tasks = Array.isArray(res.data)
                ? res.data
                : (res.data?.data ?? []);
            setOpenTasks(tasks.filter((t) => t.status !== "DONE").length);
        }
        catch {
            /* ignore */
        }
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
            setQuickReply("AI unavailable right now.");
        }
        finally {
            setAiLoading(false);
        }
    };
    return (_jsxs("div", { className: "page home-page", children: [_jsxs("header", { className: "page-header", children: [_jsxs("div", { children: [_jsx("p", { className: "page-eyebrow", children: greeting() }), _jsx("h1", { className: "page-title", children: "Cortex" })] }), _jsx("div", { className: "status-dot", title: "Online" })] }), _jsx(SpotifyWidget, { connected: spotifyConnected, nowPlaying: nowPlaying, onRefresh: loadSpotify }), openTasks !== null && (_jsxs("div", { className: "home-card", children: [_jsx("span", { className: "home-card-icon", children: "\u2713" }), _jsxs("div", { children: [_jsx("p", { className: "home-card-count", children: openTasks }), _jsxs("p", { className: "home-card-label", children: ["open task", openTasks !== 1 ? "s" : ""] })] })] })), _jsxs("div", { className: "quick-ai-card", children: [_jsx("p", { className: "quick-ai-label", children: "Quick ask" }), quickReply && _jsx("p", { className: "quick-ai-reply", children: quickReply }), _jsxs("div", { className: "quick-ai-row", children: [_jsx("input", { className: "quick-ai-input", value: quickPrompt, onChange: (e) => setQuickPrompt(e.target.value), onKeyDown: (e) => e.key === "Enter" && void sendQuick(), placeholder: "Ask anything\u2026" }), _jsx("button", { className: "quick-ai-btn", onClick: () => void sendQuick(), disabled: aiLoading || !quickPrompt.trim(), children: aiLoading ? "…" : "→" })] })] })] }));
};
