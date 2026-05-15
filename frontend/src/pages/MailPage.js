import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { getServerIntegrationConfig } from "../api/server-config";
import { ConnectOAuthButton } from "../components/ConnectOAuthButton";
export const MailPage = () => {
    const [accounts, setAccounts] = useState([]);
    const [activeAccountId, setActiveAccountId] = useState(null);
    const [configured, setConfigured] = useState(false);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [organizing, setOrganizing] = useState(false);
    const [organizeMsg, setOrganizeMsg] = useState(null);
    const [selected, setSelected] = useState(null);
    const [actionBusy, setActionBusy] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const load = async (preferredAccountId) => {
        setLoading(true);
        setLoadError(null);
        const server = await getServerIntegrationConfig();
        setConfigured(server.gmail);
        try {
            const accRes = await api.get("/mail/accounts");
            const accs = accRes.data?.data?.accounts ?? [];
            setAccounts(accs);
            const accountId = preferredAccountId && accs.some((a) => a.id === preferredAccountId)
                ? preferredAccountId
                : accs.find((a) => a.isPrimary)?.id ?? accs[0]?.id ?? null;
            setActiveAccountId(accountId);
            if (accountId) {
                const inbox = await api.get("/mail/inbox", {
                    params: { accountId, maxResults: 40 }
                });
                setMessages(inbox.data?.data?.messages ?? []);
            }
            else {
                setMessages([]);
            }
        }
        catch (err) {
            setMessages([]);
            setAccounts([]);
            const status = err?.response?.status;
            if (server.gmail) {
                setLoadError(status === 404
                    ? "API is out of date — restart the backend (npm run dev:web), then refresh."
                    : status === 401
                        ? "Session expired — sign out and sign in again."
                        : "Could not load mail accounts — is the API running on port 4000?");
            }
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.has("mail_connected") || params.has("gmail_connected")) {
            window.history.replaceState({}, "", window.location.pathname);
        }
        void load();
    }, []);
    const organize = async () => {
        if (!activeAccountId)
            return;
        setOrganizing(true);
        setOrganizeMsg(null);
        try {
            const r = await api.post("/mail/organize", { accountId: activeAccountId });
            const d = r.data?.data;
            setOrganizeMsg(`Organized ${d?.scanned ?? 0} unread — archived ${d?.archived ?? 0}, marked read ${d?.markedRead ?? 0}.`);
            await load(activeAccountId);
        }
        catch {
            setOrganizeMsg("Organize failed — check API logs.");
        }
        finally {
            setOrganizing(false);
        }
    };
    const archive = async (id) => {
        if (!activeAccountId)
            return;
        setActionBusy(id);
        try {
            await api.post("/mail/messages/archive", { messageId: id, accountId: activeAccountId });
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
        if (!activeAccountId)
            return;
        setActionBusy(id);
        try {
            await api.post("/mail/messages/mark-read", { messageId: id, accountId: activeAccountId });
            setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, unread: false } : m)));
        }
        catch { /* ignore */ }
        finally {
            setActionBusy(null);
        }
    };
    const disconnect = async (accountId) => {
        await api.post(`/mail/accounts/${accountId}/disconnect`);
        await load();
    };
    const unreadCount = messages.filter((m) => m.unread).length;
    const connected = accounts.length > 0;
    return (_jsxs("div", { className: "page gmail-page mail-page", children: [_jsxs("div", { className: "page-titlebar", children: [_jsxs("div", { children: [_jsxs("h1", { className: "page-title", children: ["Mail", unreadCount > 0 && _jsx("span", { className: "gmail-unread-badge", children: unreadCount })] }), _jsx("p", { className: "page-subtitle", children: "Multiple inboxes \u00B7 auto-organize with AI or rules" })] }), _jsx("div", { className: "page-actions", children: connected && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "btn-primary btn-sm", disabled: organizing || !activeAccountId, onClick: () => void organize(), children: organizing ? "Organizing…" : "Auto-organize" }), _jsx("button", { type: "button", className: "btn-ghost btn-sm", onClick: () => void load(), children: "\u21BB Refresh" })] })) })] }), organizeMsg && _jsx("p", { className: "mail-organize-banner", children: organizeMsg }), loadError && _jsx("p", { className: "mail-organize-banner mail-organize-banner--error", children: loadError }), loading && _jsx("p", { className: "page-loading", children: "Loading\u2026" }), !loading && !configured && (_jsxs("div", { className: "gmail-setup-card", children: [_jsx("div", { className: "gmail-setup-icon", children: "\u2709" }), _jsx("h2", { children: "Mail not configured" }), _jsxs("p", { children: ["Add ", _jsx("code", { children: "GOOGLE_CLIENT_ID" }), ", ", _jsx("code", { children: "GOOGLE_CLIENT_SECRET" }), ", and", " ", _jsx("code", { children: "GOOGLE_REDIRECT_URI" }), " to ", _jsx("code", { children: "backend/.env" }), ", then restart the API."] })] })), !loading && configured && !connected && (_jsxs("div", { className: "gmail-setup-card", children: [_jsx("div", { className: "gmail-setup-icon", children: "\u2709" }), _jsx("h2", { children: "Connect your first inbox" }), _jsx("p", { children: "Link a Gmail account. You can add more accounts after connecting." }), _jsx("div", { style: { marginTop: 12 }, children: _jsx(ConnectOAuthButton, { service: "mail", label: "Connect Gmail", className: "btn-primary" }) })] })), !loading && connected && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "mail-accounts-bar", children: [accounts.map((acc) => (_jsx("button", { type: "button", className: `mail-account-chip ${activeAccountId === acc.id ? "active" : ""}`, onClick: () => void load(acc.id), children: acc.label ?? acc.email }, acc.id))), _jsx(ConnectOAuthButton, { service: "mail", label: "+ Add Gmail", className: "btn-ghost btn-sm" })] }), _jsxs("div", { className: "gmail-layout", children: [_jsxs("div", { className: "gmail-list", children: [messages.length === 0 && _jsx("p", { className: "gmail-empty", children: "Inbox is empty" }), messages.map((msg) => (_jsxs("div", { className: `gmail-row ${msg.unread ? "unread" : ""} ${selected?.id === msg.id ? "selected" : ""}`, onClick: () => {
                                            setSelected(msg);
                                            if (msg.unread)
                                                void markRead(msg.id);
                                        }, children: [_jsx("div", { className: "gmail-row-dot", children: msg.unread ? "●" : "○" }), _jsxs("div", { className: "gmail-row-body", children: [_jsxs("div", { className: "gmail-row-top", children: [_jsx("span", { className: "gmail-row-from", children: msg.from.split("<")[0].trim() || msg.from }), msg.date && _jsx("span", { className: "gmail-row-date", children: msg.date })] }), _jsx("p", { className: "gmail-row-subject", children: msg.subject || "(no subject)" }), _jsx("p", { className: "gmail-row-snippet", children: msg.snippet })] }), _jsx("div", { className: "gmail-row-actions", onClick: (e) => e.stopPropagation(), children: _jsx("button", { type: "button", className: "gmail-action-btn gmail-action-btn--archive", onClick: () => void archive(msg.id), disabled: actionBusy === msg.id, title: "Archive", children: "\u2192" }) })] }, msg.id)))] }), _jsx("div", { className: "gmail-preview", children: selected ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "gmail-preview-header", children: [_jsx("p", { className: "gmail-preview-subject", children: selected.subject || "(no subject)" }), _jsx("p", { className: "gmail-preview-from", children: selected.from }), _jsxs("div", { className: "gmail-preview-actions", children: [_jsx("button", { type: "button", className: "btn-ghost btn-sm", onClick: () => void archive(selected.id), children: "Archive" }), activeAccountId && (_jsx("button", { type: "button", className: "btn-ghost btn-sm", onClick: () => void disconnect(activeAccountId), children: "Disconnect account" }))] })] }), _jsx("div", { className: "gmail-preview-body", children: _jsx("p", { className: "gmail-preview-snippet", children: selected.snippet }) })] })) : (_jsx("div", { className: "gmail-preview-empty", children: _jsx("p", { children: "Select an email to preview" }) })) })] })] }))] }));
};
