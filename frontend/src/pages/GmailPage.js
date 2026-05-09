import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api } from "../api/client";
export const GmailPage = () => {
    const [configured, setConfigured] = useState(false);
    const [connected, setConnected] = useState(false);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [oauthUrl, setOauthUrl] = useState(null);
    const [actionBusy, setActionBusy] = useState(null);
    const [selected, setSelected] = useState(null);
    useEffect(() => {
        void load();
        // Handle OAuth callback params
        const params = new URLSearchParams(window.location.search);
        if (params.has("gmail_connected")) {
            window.history.replaceState({}, "", window.location.pathname);
            void load();
        }
    }, []);
    const load = async () => {
        setLoading(true);
        try {
            const status = await api.get("/gmail/status");
            const { configured: conf = false, connected: conn = false } = status.data?.data ?? {};
            setConfigured(conf);
            setConnected(conn);
            if (conn) {
                const inbox = await api.get("/gmail/inbox", { params: { maxResults: 30 } });
                const msgs = inbox.data?.data?.messages ?? [];
                setMessages(msgs);
            }
            else if (conf) {
                const urlRes = await api.get("/gmail/oauth/url");
                setOauthUrl(urlRes.data?.data?.url ?? null);
            }
        }
        catch { /* ignore */ }
        finally {
            setLoading(false);
        }
    };
    const archive = async (id) => {
        setActionBusy(id);
        try {
            await api.post("/gmail/messages/archive", { messageId: id });
            setMessages((prev) => prev.filter((m) => m.id !== id));
            if (selected?.id === id)
                setSelected(null);
        }
        catch { /* ignore */ }
        finally {
            setActionBusy(null);
        }
    };
    const markRead = async (id) => {
        setActionBusy(id);
        try {
            await api.post("/gmail/messages/mark-read", { messageId: id });
            setMessages((prev) => prev.map((m) => m.id === id ? { ...m, unread: false } : m));
        }
        catch { /* ignore */ }
        finally {
            setActionBusy(null);
        }
    };
    const disconnect = async () => {
        await api.post("/gmail/disconnect");
        setConnected(false);
        setMessages([]);
        await load();
    };
    const unreadCount = messages.filter((m) => m.unread).length;
    return (_jsxs("div", { className: "page gmail-page", children: [_jsxs("div", { className: "page-titlebar", children: [_jsx("div", { children: _jsxs("h1", { className: "page-title", children: ["Gmail", unreadCount > 0 && _jsx("span", { className: "gmail-unread-badge", children: unreadCount })] }) }), _jsx("div", { className: "page-actions", children: connected && (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn-ghost btn-sm", onClick: () => void load(), children: "\u21BB Refresh" }), _jsx("button", { className: "btn-ghost btn-sm", onClick: () => void disconnect(), children: "Disconnect" })] })) })] }), loading && _jsx("p", { className: "page-loading", children: "Loading\u2026" }), !loading && !configured && (_jsxs("div", { className: "gmail-setup-card", children: [_jsx("div", { className: "gmail-setup-icon", children: "\u2709" }), _jsx("h2", { children: "Gmail not configured" }), _jsxs("p", { children: ["Add ", _jsx("code", { children: "GOOGLE_CLIENT_ID" }), ", ", _jsx("code", { children: "GOOGLE_CLIENT_SECRET" }), ", and ", _jsx("code", { children: "GOOGLE_REDIRECT_URI" }), " to your Railway environment variables."] })] })), !loading && configured && !connected && (_jsxs("div", { className: "gmail-setup-card", children: [_jsx("div", { className: "gmail-setup-icon", children: "\u2709" }), _jsx("h2", { children: "Connect Gmail" }), _jsx("p", { children: "Sign in with Google to view and manage your inbox inside Cortex." }), _jsx("a", { className: "btn-primary", href: oauthUrl ?? "#", style: { marginTop: 12, width: "fit-content" }, children: "Connect Google account \u2192" })] })), !loading && connected && (_jsxs("div", { className: "gmail-layout", children: [_jsxs("div", { className: "gmail-list", children: [messages.length === 0 && _jsx("p", { className: "gmail-empty", children: "Inbox is empty" }), messages.map((msg) => (_jsxs("div", { className: `gmail-row ${msg.unread ? "unread" : ""} ${selected?.id === msg.id ? "selected" : ""}`, onClick: () => { setSelected(msg); if (msg.unread)
                                    void markRead(msg.id); }, children: [_jsx("div", { className: "gmail-row-dot", children: msg.unread ? "●" : "○" }), _jsxs("div", { className: "gmail-row-body", children: [_jsxs("div", { className: "gmail-row-top", children: [_jsx("span", { className: "gmail-row-from", children: msg.from.split("<")[0].trim() || msg.from }), msg.date && _jsx("span", { className: "gmail-row-date", children: msg.date })] }), _jsx("p", { className: "gmail-row-subject", children: msg.subject || "(no subject)" }), _jsx("p", { className: "gmail-row-snippet", children: msg.snippet })] }), _jsxs("div", { className: "gmail-row-actions", onClick: (e) => e.stopPropagation(), children: [msg.unread && (_jsx("button", { className: "gmail-action-btn", onClick: () => void markRead(msg.id), disabled: actionBusy === msg.id, title: "Mark read", children: "\u2713" })), _jsx("button", { className: "gmail-action-btn gmail-action-btn--archive", onClick: () => void archive(msg.id), disabled: actionBusy === msg.id, title: "Archive", children: "\u2192" })] })] }, msg.id)))] }), _jsx("div", { className: "gmail-preview", children: selected ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "gmail-preview-header", children: [_jsx("p", { className: "gmail-preview-subject", children: selected.subject || "(no subject)" }), _jsx("p", { className: "gmail-preview-from", children: selected.from }), _jsx("div", { className: "gmail-preview-actions", children: _jsx("button", { className: "btn-ghost btn-sm", onClick: () => void archive(selected.id), children: "Archive" }) })] }), _jsxs("div", { className: "gmail-preview-body", children: [_jsx("p", { className: "gmail-preview-snippet", children: selected.snippet }), _jsx("p", { className: "gmail-preview-note", children: "Full email body requires additional Gmail API scopes." })] })] })) : (_jsx("div", { className: "gmail-preview-empty", children: _jsx("p", { children: "Select an email to preview" }) })) })] }))] }));
};
