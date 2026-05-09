import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable, } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api/client";
const WIDGET_COLS = {
    clock: 1,
    spotify: 2,
    tasks: 1,
    ai: 2,
    gmail: 2,
    settings: 1,
};
const DEFAULT_ORDER = ["clock", "spotify", "tasks", "ai", "gmail", "settings"];
const STORAGE_KEY = "cortex_widget_order";
// ── Sortable wrapper ──────────────────────────────────────
function SortableWidget({ id, editMode, colSpan, children, }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    return (_jsx(motion.div, { ref: setNodeRef, style: {
            gridColumn: `span ${colSpan}`,
            transform: CSS.Transform.toString(transform),
            transition,
            zIndex: isDragging ? 50 : 1,
            position: "relative",
        }, animate: editMode && !isDragging
            ? { rotate: [-0.7, 0.7, -0.7], transition: { repeat: Infinity, duration: 0.28, ease: "easeInOut" } }
            : { rotate: 0 }, ...(editMode ? { ...attributes, ...listeners } : {}), children: children }));
}
// ── Clock ─────────────────────────────────────────────────
function ClockWidget() {
    const [t, setT] = useState(new Date());
    useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
    const hh = t.getHours().toString().padStart(2, "0");
    const mm = t.getMinutes().toString().padStart(2, "0");
    const ss = t.getSeconds().toString().padStart(2, "0");
    const date = t.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    return (_jsxs("div", { className: "widget widget--clock", children: [_jsxs("p", { className: "clock-time", children: [hh, ":", mm, _jsxs("span", { className: "clock-sec", children: [":", ss] })] }), _jsx("p", { className: "clock-date", children: date }), _jsxs("div", { className: "widget-status-row", children: [_jsx("span", { className: "widget-status-dot" }), _jsx("span", { className: "widget-status-text", children: "Cortex online" })] })] }));
}
// ── Spotify ───────────────────────────────────────────────
function SpotifyWidget({ onNavigate }) {
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const [np, setNp] = useState(null);
    const load = async () => {
        try {
            const s = await api.get("/spotify/status");
            const conn = s.data?.data?.connected ?? false;
            setConnected(conn);
            if (conn) {
                const r = await api.get("/spotify/now-playing");
                setNp(r.data?.data ?? r.data ?? null);
            }
        }
        catch { /* ignore */ }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => { void load(); }, []);
    const ctrl = async (action) => {
        try {
            await api.post(`/spotify/playback/${action}`);
            setTimeout(load, 700);
        }
        catch { /* ignore */ }
    };
    return (_jsxs("div", { className: `widget widget--spotify ${connected && np?.isPlaying ? "widget--spotify-active" : ""}`, children: [_jsx("div", { className: "widget-label", children: "\u266B Spotify" }), loading ? _jsx("p", { className: "widget-empty", children: "Checking\u2026" })
                : !connected ? (_jsxs("div", { className: "widget-cta", children: [_jsx("p", { className: "widget-cta-text", children: "Not connected" }), _jsx("button", { className: "widget-cta-btn", onClick: () => onNavigate("settings"), children: "Connect in Settings \u2192" })] })) : !np?.isPlaying ? (_jsx("p", { className: "widget-empty", children: "Nothing playing \u2014 open Spotify to start" })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "spotify-widget-body", children: [_jsx("div", { className: "spotify-widget-art", children: np.track?.albumArt ? _jsx("img", { src: np.track.albumArt, alt: "" }) : _jsx("div", { className: "spotify-art-fallback", children: "\u266B" }) }), _jsxs("div", { className: "spotify-widget-info", children: [_jsx("p", { className: "spotify-widget-track", children: np.track?.name }), _jsx("p", { className: "spotify-widget-artist", children: np.track?.artists }), np.device && _jsxs("p", { className: "spotify-widget-device", children: ["\u25B8 ", np.device.name] })] })] }), _jsxs("div", { className: "spotify-widget-controls", children: [_jsx("button", { onClick: () => void ctrl("previous"), children: "\u23EE" }), _jsx("button", { className: "spotify-pp", onClick: () => void ctrl(np.isPlaying ? "pause" : "play"), children: np.isPlaying ? "⏸" : "▶" }), _jsx("button", { onClick: () => void ctrl("next"), children: "\u23ED" }), _jsx("button", { className: "spotify-refresh", onClick: load, children: "\u21BB" })] })] }))] }));
}
// ── Tasks ─────────────────────────────────────────────────
function TasksWidget({ onNavigate }) {
    const [tasks, setTasks] = useState([]);
    useEffect(() => {
        api.get("/tasks").then((r) => {
            const t = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
            setTasks(t);
        }).catch(() => { });
    }, []);
    const todo = tasks.filter((t) => t.status === "TODO");
    const inProg = tasks.filter((t) => t.status === "IN_PROGRESS");
    const done = tasks.filter((t) => t.status === "DONE");
    return (_jsxs("div", { className: "widget widget--tasks", onClick: () => onNavigate("tasks"), role: "button", tabIndex: 0, children: [_jsx("div", { className: "widget-label", children: "\u2713 Tasks" }), _jsxs("div", { className: "widget-task-stats", children: [_jsxs("div", { className: "widget-task-stat", children: [_jsx("span", { className: "widget-task-num", children: todo.length }), _jsx("span", { className: "widget-task-lbl", children: "To do" })] }), _jsxs("div", { className: "widget-task-stat widget-task-stat--active", children: [_jsx("span", { className: "widget-task-num", children: inProg.length }), _jsx("span", { className: "widget-task-lbl", children: "Active" })] }), _jsxs("div", { className: "widget-task-stat widget-task-stat--done", children: [_jsx("span", { className: "widget-task-num", children: done.length }), _jsx("span", { className: "widget-task-lbl", children: "Done" })] })] }), _jsxs("ul", { className: "widget-task-list", children: [[...inProg, ...todo].slice(0, 6).map((t) => (_jsxs("li", { className: `widget-task-item ${t.status === "IN_PROGRESS" ? "widget-task-item--active" : ""}`, children: [_jsx("span", { className: "widget-task-dot", children: t.status === "IN_PROGRESS" ? "◑" : "○" }), _jsx("span", { className: "widget-task-title", children: t.title })] }, t.id))), tasks.length === 0 && _jsx("li", { className: "widget-empty", children: "No tasks yet" })] }), _jsx("div", { className: "widget-open-hint", children: "Click to open Tasks \u2192" })] }));
}
// ── AI ────────────────────────────────────────────────────
function AIWidget({ onNavigate }) {
    const [prompt, setPrompt] = useState("");
    const [reply, setReply] = useState(null);
    const [loading, setLoading] = useState(false);
    const send = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const msg = prompt.trim();
        if (!msg)
            return;
        setLoading(true);
        setReply(null);
        try {
            const r = await api.post("/ai/chat", { message: msg });
            setReply(r.data?.data?.reply ?? r.data?.reply ?? "Done.");
            setPrompt("");
        }
        catch {
            setReply("Unavailable.");
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { className: "widget widget--ai", children: [_jsx("div", { className: "widget-label", children: "\u25C8 AI Assistant" }), reply
                ? _jsxs("div", { className: "widget-ai-reply", children: [_jsx("p", { children: reply }), _jsx("button", { onClick: () => setReply(null), children: "\u00D7" })] })
                : _jsx("p", { className: "widget-ai-idle", children: "Ask anything or open full chat below" }), _jsxs("form", { className: "widget-ai-form", onSubmit: send, onClick: (e) => e.stopPropagation(), children: [_jsx("input", { className: "widget-ai-input", value: prompt, onChange: (e) => setPrompt(e.target.value), placeholder: "Quick question\u2026", disabled: loading }), _jsx("button", { type: "submit", className: "widget-ai-send", disabled: loading || !prompt.trim(), children: loading ? "…" : "→" })] }), _jsx("button", { className: "widget-open-hint", onClick: () => onNavigate("ai"), children: "Open full chat \u2192" })] }));
}
// ── Gmail ─────────────────────────────────────────────────
function GmailWidget({ onNavigate }) {
    const [connected, setConnected] = useState(false);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        api.get("/gmail/status").then(async (s) => {
            const conn = s.data?.data?.connected ?? false;
            setConnected(conn);
            if (conn) {
                const r = await api.get("/gmail/inbox", { params: { maxResults: 8 } });
                setMessages(r.data?.data?.messages ?? []);
            }
        }).catch(() => { })
            .finally(() => setLoading(false));
    }, []);
    const unread = messages.filter((m) => m.unread).length;
    return (_jsxs("div", { className: "widget widget--gmail", onClick: () => onNavigate("gmail"), role: "button", tabIndex: 0, children: [_jsxs("div", { className: "widget-label", children: ["\u2709 Gmail ", unread > 0 && _jsx("span", { className: "widget-gmail-badge", children: unread })] }), loading ? _jsx("p", { className: "widget-empty", children: "Loading\u2026" })
                : !connected ? (_jsxs("div", { className: "widget-cta", children: [_jsx("p", { className: "widget-cta-text", children: "Not connected" }), _jsx("button", { className: "widget-cta-btn", onClick: (e) => { e.stopPropagation(); onNavigate("gmail"); }, children: "Connect Gmail \u2192" })] })) : (_jsxs("ul", { className: "gmail-widget-list", children: [messages.slice(0, 6).map((m) => (_jsxs("li", { className: `gmail-widget-row ${m.unread ? "unread" : ""}`, children: [_jsx("span", { className: "gmail-widget-dot", children: m.unread ? "●" : "○" }), _jsxs("div", { className: "gmail-widget-body", children: [_jsx("span", { className: "gmail-widget-from", children: m.from.split("<")[0].trim().slice(0, 20) }), _jsx("span", { className: "gmail-widget-subject", children: m.subject || "(no subject)" })] })] }, m.id))), messages.length === 0 && _jsx("li", { className: "widget-empty", children: "Inbox empty" })] })), _jsx("div", { className: "widget-open-hint", children: "Open Gmail \u2192" })] }));
}
// ── Settings ──────────────────────────────────────────────
function SettingsWidget({ onNavigate }) {
    return (_jsxs("div", { className: "widget widget--settings", onClick: () => onNavigate("settings"), role: "button", tabIndex: 0, children: [_jsx("div", { className: "widget-label", children: "\u2699 Settings" }), _jsx("div", { className: "widget-settings-links", children: ["Spotify", "Gmail", "Account"].map((item) => (_jsxs("div", { className: "widget-settings-row", children: [_jsx("span", { children: item }), _jsx("span", { className: "widget-settings-arrow", children: "\u203A" })] }, item))) }), _jsx("div", { className: "widget-open-hint", children: "Open Settings \u2192" })] }));
}
// ── Home page ─────────────────────────────────────────────
export const HomePage = ({ onNavigate }) => {
    const [widgetOrder, setWidgetOrder] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.length === DEFAULT_ORDER.length)
                    return parsed;
            }
        }
        catch { /* ignore */ }
        return DEFAULT_ORDER;
    });
    const [editMode, setEditMode] = useState(false);
    const longPressRef = useRef(null);
    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12)
            return "Good morning";
        if (h < 17)
            return "Good afternoon";
        return "Good evening";
    };
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setWidgetOrder((prev) => {
                const oldIdx = prev.indexOf(active.id);
                const newIdx = prev.indexOf(over.id);
                const next = arrayMove(prev, oldIdx, newIdx);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                return next;
            });
        }
    };
    const renderWidget = (id) => {
        switch (id) {
            case "clock": return _jsx(ClockWidget, {});
            case "spotify": return _jsx(SpotifyWidget, { onNavigate: onNavigate });
            case "tasks": return _jsx(TasksWidget, { onNavigate: onNavigate });
            case "ai": return _jsx(AIWidget, { onNavigate: onNavigate });
            case "gmail": return _jsx(GmailWidget, { onNavigate: onNavigate });
            case "settings": return _jsx(SettingsWidget, { onNavigate: onNavigate });
        }
    };
    return (_jsxs("div", { className: "page home-page", children: [_jsxs("div", { className: "page-titlebar", children: [_jsxs("div", { children: [_jsx("p", { className: "page-eyebrow", children: greeting() }), _jsx("h1", { className: "page-title", children: "Home" })] }), _jsx("div", { className: "page-actions", children: _jsx(AnimatePresence, { mode: "wait", children: editMode ? (_jsx(motion.button, { className: "btn-primary btn-sm", onClick: () => setEditMode(false), initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.9 }, children: "Done" }, "done")) : (_jsx(motion.button, { className: "btn-ghost btn-sm", onClick: () => setEditMode(true), initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, children: "\u2726 Edit widgets" }, "edit")) }) })] }), editMode && (_jsx(motion.p, { className: "edit-mode-hint", initial: { opacity: 0, y: -8 }, animate: { opacity: 1, y: 0 }, children: "Drag widgets to rearrange \u2022 Click Done when finished" })), _jsx(DndContext, { sensors: sensors, collisionDetection: closestCenter, onDragEnd: handleDragEnd, children: _jsx(SortableContext, { items: widgetOrder, strategy: rectSortingStrategy, children: _jsx("div", { className: "widget-grid", children: widgetOrder.map((id) => (_jsx(SortableWidget, { id: id, editMode: editMode, colSpan: WIDGET_COLS[id], children: _jsx("div", { className: `widget-shell ${editMode ? "widget-shell--edit" : ""}`, onMouseDown: editMode ? undefined : undefined, children: renderWidget(id) }) }, id))) }) }) })] }));
};
