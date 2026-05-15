import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
export const MemoryPage = () => {
    const [status, setStatus] = useState(null);
    const [query, setQuery] = useState("");
    const [agentHits, setAgentHits] = useState([]);
    const [obsidianHits, setObsidianHits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [reindexing, setReindexing] = useState(false);
    const [vaultEntryCount, setVaultEntryCount] = useState(0);
    const [error, setError] = useState(null);
    const loadStatus = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get("/memory/status");
            const data = res.data?.data ?? null;
            setStatus(data);
            setVaultEntryCount(data?.vaultIndex?.entryCount ?? 0);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Could not load memory status");
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void loadStatus();
    }, [loadStatus]);
    const runSearch = async (e) => {
        e?.preventDefault();
        const q = query.trim();
        if (q.length < 2)
            return;
        setSearching(true);
        setError(null);
        try {
            const res = await api.post("/memory/search", { q, limit: 16 });
            setAgentHits(res.data?.data?.agentmemory ?? []);
            setObsidianHits(res.data?.data?.obsidian ?? []);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Search failed");
        }
        finally {
            setSearching(false);
        }
    };
    const mcpJson = status
        ? JSON.stringify({
            mcpServers: {
                agentmemory: {
                    command: status.mcpConfig.command,
                    args: status.mcpConfig.args,
                    env: status.mcpConfig.env
                }
            }
        }, null, 2)
        : "";
    const handleReindex = async () => {
        setReindexing(true);
        setError(null);
        try {
            const res = await api.get("/memory/vaults/reindex");
            setVaultEntryCount(res.data?.data?.entryCount ?? 0);
            if (query.trim().length >= 2)
                await runSearch();
        }
        catch {
            setError("Reindex failed.");
        }
        finally {
            setReindexing(false);
        }
    };
    return (_jsxs("div", { className: "page memory-page", children: [_jsxs("div", { className: "page-titlebar", children: [_jsxs("div", { children: [_jsx("h1", { className: "page-title", children: "Memory" }), _jsxs("p", { className: "page-subtitle", children: ["Unified search across", " ", _jsx("a", { href: "https://github.com/rohitg00/agentmemory", target: "_blank", rel: "noreferrer", children: "agentmemory" }), " ", "and Obsidian \u2014 use the same project name on every machine."] })] }), _jsx("div", { className: "page-actions", children: _jsx("button", { type: "button", className: "btn-ghost btn-sm", disabled: reindexing, onClick: () => void handleReindex(), children: reindexing ? "Reindexing…" : "Reindex vaults" }) })] }), loading && _jsx("p", { className: "muted", children: "Loading memory services\u2026" }), error && _jsx("p", { className: "error-text", children: error }), status && (_jsxs("div", { className: "memory-status-grid", children: [_jsxs("div", { className: "card", children: [_jsx("h3", { children: "Agentmemory" }), _jsxs("p", { children: [_jsx("span", { className: status.agentmemory.ok ? "status-ok" : "status-warn", children: status.agentmemory.ok ? "Running" : "Offline" }), " · ", _jsx("code", { children: status.agentmemoryUrl })] }), !status.agentmemory.ok && status.agentmemory.detail && (_jsx("p", { className: "muted", children: status.agentmemory.detail })), _jsxs("p", { className: "muted", children: ["Start: ", _jsx("code", { children: "npm run dev:memory" }), " (API :3111, viewer :3113)"] }), status.viewerUrl && (_jsx("p", { children: _jsx("a", { href: status.viewerUrl, target: "_blank", rel: "noreferrer", children: "Open memory viewer" }) }))] }), _jsxs("div", { className: "card", children: [_jsx("h3", { children: "Obsidian vaults" }), status.obsidianVaults.length === 0 ? (_jsxs("p", { className: "muted", children: ["Set ", _jsx("code", { children: "OBSIDIAN_VAULT_PATHS" }), " in backend ", _jsx("code", { children: ".env" }), "."] })) : (_jsx("ul", { className: "memory-vault-list", children: status.obsidianVaults.map((v) => (_jsxs("li", { children: [_jsx("strong", { children: v.name }), _jsx("br", {}), _jsx("code", { className: "muted", children: v.path })] }, v.path))) })), _jsxs("p", { className: "muted", children: ["Project: ", _jsx("code", { children: status.project }), vaultEntryCount > 0 && _jsxs(_Fragment, { children: [" \u00B7 ", vaultEntryCount, " notes indexed"] })] })] })] })), _jsxs("form", { onSubmit: (e) => void runSearch(e), className: "memory-search-form", children: [_jsx("input", { type: "search", placeholder: "Search agent memory and vault notes\u2026", value: query, onChange: (e) => setQuery(e.target.value), className: "input" }), _jsx("button", { type: "submit", className: "btn-primary btn-sm", disabled: searching || query.trim().length < 2, children: searching ? "Searching…" : "Search" })] }), (agentHits.length > 0 || obsidianHits.length > 0) && (_jsxs("div", { className: "memory-results", children: [agentHits.length > 0 && (_jsxs("section", { children: [_jsx("h2", { className: "section-title", children: "Agent memory" }), _jsx("ul", { className: "memory-hit-list", children: agentHits.map((h) => (_jsxs("li", { className: "card memory-hit", children: [_jsx("strong", { children: h.title }), _jsx("p", { className: "muted", children: h.snippet })] }, h.id))) })] })), obsidianHits.length > 0 && (_jsxs("section", { children: [_jsx("h2", { className: "section-title", children: "Obsidian" }), _jsx("ul", { className: "memory-hit-list", children: obsidianHits.map((h) => (_jsxs("li", { className: "card memory-hit", children: [_jsx("strong", { children: h.title }), h.vault && _jsx("span", { className: "badge", children: h.vault }), _jsx("p", { className: "muted", children: h.snippet }), h.path && _jsx("code", { className: "memory-path", children: h.path }), "obsidianUri" in h && typeof h.obsidianUri === "string" && (_jsx("a", { className: "btn-ghost btn-sm", href: h.obsidianUri, children: "Open in Obsidian" }))] }, h.id))) })] }))] })), status && (_jsxs("section", { className: "card memory-mcp-card", children: [_jsx("h3", { children: "Cursor / Claude MCP" }), _jsx("p", { className: "muted", children: "Paste into MCP config so agents share this memory store." }), _jsx("pre", { className: "code-block", children: mcpJson })] }))] }));
};
