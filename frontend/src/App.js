import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import { isAxiosError } from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { Virtuoso } from "react-virtuoso";
import { siGmail } from "simple-icons";
import { api, setAuthToken } from "./api/client";
import { BrandIcon } from "./components/BrandIcon";
import { CommandPalette } from "./components/shell/CommandPalette";
import { DashboardModules } from "./components/shell/DashboardModules";
import { ToastViewport } from "./components/shell/ToastViewport";
import { GlassPanel } from "./components/ui/GlassPanel";
import { StatusChip } from "./components/ui/StatusChip";
import { useDesktopShortcuts } from "./hooks/useDesktopShortcuts";
import { resolveBrandIcon } from "./lib/brandIcons";
import { usePersistentState } from "./hooks/usePersistentState";
import { useToastStore } from "./stores/toastStore";
import { reorderList } from "./utils/reorder";
import { TasksPage } from "./pages/TasksPage";
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const TOKEN_KEY = "cortex_token";
const SIDEBAR_COLLAPSED_KEY = "cortex_sidebar_collapsed_v2";
const MODULE_ORDER_KEY = "cortex_module_order";
const DEFAULT_MODULE_ORDER = ["apps", "files", "ai", "tasks"];
export default function App() {
    const [email, setEmail] = useState("grey@cortex.local");
    const [password, setPassword] = useState("ChangeMe123!");
    const [pin, setPin] = useState("");
    const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
    const [locked, setLocked] = useState(true);
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [info, setInfo] = useState("Use demo credentials to sign in.");
    const [busy, setBusy] = useState(null);
    const [apps, setApps] = useState([]);
    const [appsLoading, setAppsLoading] = useState(false);
    const [appsError, setAppsError] = useState(null);
    const [launchingAppId, setLaunchingAppId] = useState(null);
    const [desktopCount, setDesktopCount] = useState(null);
    const [downloadCount, setDownloadCount] = useState(null);
    const [recentFiles, setRecentFiles] = useState([]);
    const [filesLoading, setFilesLoading] = useState(false);
    const [filesError, setFilesError] = useState(null);
    const [fileSearchTerm, setFileSearchTerm] = useState("");
    const [fileSearchResults, setFileSearchResults] = useState([]);
    const [fileSearchBusy, setFileSearchBusy] = useState(false);
    const [aiMessages, setAiMessages] = useState([
        { role: "assistant", content: "AI module ready. Ask a quick question or run a command below." }
    ]);
    const [aiPrompt, setAiPrompt] = useState("");
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [commandInput, setCommandInput] = useState("");
    const [commandBusy, setCommandBusy] = useState(false);
    const [commandResult, setCommandResult] = useState(null);
    const [commandError, setCommandError] = useState(null);
    const [gmailConfigured, setGmailConfigured] = useState(false);
    const [gmailConnected, setGmailConnected] = useState(false);
    const [gmailInbox, setGmailInbox] = useState([]);
    const [gmailBusy, setGmailBusy] = useState(false);
    const [gmailError, setGmailError] = useState(null);
    const [activeModule, setActiveModuleState] = useState("apps");
    const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState(SIDEBAR_COLLAPSED_KEY, false);
    const [moduleOrder, setModuleOrder] = usePersistentState(MODULE_ORDER_KEY, DEFAULT_MODULE_ORDER);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [expandedModule, setExpandedModule] = useState(null);
    const [desktopDragging, setDesktopDragging] = useState(false);
    const [selectedFilePaths, setSelectedFilePaths] = useState(() => new Set());
    const fileAnchorIndexRef = useRef(null);
    const aiInputRef = useRef(null);
    const setActiveModule = useCallback((id) => {
        if (id !== "files") {
            setSelectedFilePaths(new Set());
            fileAnchorIndexRef.current = null;
        }
        setActiveModuleState(id);
    }, []);
    const pushToast = useToastStore((s) => s.push);
    const idleTimerRef = useRef(null);
    const hasSession = useMemo(() => Boolean(token), [token]);
    const isUnlocked = useMemo(() => Boolean(token && user && !locked), [locked, token, user]);
    const canInteract = busy === null;
    const unwrapData = (payload) => {
        if (payload && typeof payload === "object" && "data" in payload) {
            return payload.data;
        }
        return payload;
    };
    const apiErrorMessage = (error, fallback) => {
        if (isAxiosError(error)) {
            const payload = error.response?.data;
            if (payload && typeof payload === "object" && "error" in payload) {
                const nested = payload.error;
                if (nested?.message && typeof nested.message === "string")
                    return nested.message;
            }
            if (payload && typeof payload === "object" && "message" in payload) {
                const direct = payload.message;
                if (typeof direct === "string" && direct.trim())
                    return direct;
            }
            if (error.response?.status === 429)
                return "Too many attempts. Wait a minute and try again.";
        }
        return fallback;
    };
    const clearIdleTimer = () => {
        if (idleTimerRef.current !== null) {
            window.clearTimeout(idleTimerRef.current);
            idleTimerRef.current = null;
        }
    };
    const lockSession = async (lockReason) => {
        if (!token)
            return;
        setBusy("lock");
        setError(null);
        try {
            await api.post("/auth/lock", { lockReason }, { headers: { Authorization: `Bearer ${token}` } });
            setLocked(true);
            setPin("");
            setUser(null);
        }
        catch {
            setError("Unable to lock session. Please retry.");
        }
        finally {
            setBusy(null);
        }
    };
    const resetIdleTimer = () => {
        clearIdleTimer();
        if (!token || locked)
            return;
        idleTimerRef.current = window.setTimeout(() => {
            void lockSession("idle");
        }, IDLE_TIMEOUT_MS);
    };
    useEffect(() => {
        setAuthToken(token);
        if (token) {
            localStorage.setItem(TOKEN_KEY, token);
        }
        else {
            localStorage.removeItem(TOKEN_KEY);
        }
    }, [token]);
    useEffect(() => {
        if (!token || locked) {
            clearIdleTimer();
            return;
        }
        const onActivity = () => resetIdleTimer();
        const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
        events.forEach((eventName) => window.addEventListener(eventName, onActivity, { passive: true }));
        resetIdleTimer();
        return () => {
            clearIdleTimer();
            events.forEach((eventName) => window.removeEventListener(eventName, onActivity));
        };
    }, [token, locked]);
    const onLogin = async (event) => {
        event.preventDefault();
        if (!canInteract)
            return;
        setBusy("login");
        setError(null);
        setInfo(null);
        try {
            const response = await api.post("/auth/login", { email, password });
            const nextToken = response.data.token;
            setToken(nextToken);
            setAuthToken(nextToken);
            setLocked(true);
            setUser(null);
            setInfo("Login successful. Step 2: enter your PIN to unlock.");
        }
        catch {
            setError("Login failed. Check your email and password.");
        }
        finally {
            setBusy(null);
        }
    };
    const onUnlock = async (event) => {
        event.preventDefault();
        if (!token || !canInteract)
            return;
        const cleanPin = pin.replace(/\D/g, "").trim();
        if (cleanPin.length < 4 || cleanPin.length > 6) {
            setError("PIN must be 4-6 digits.");
            return;
        }
        setBusy("unlock");
        setError(null);
        setInfo(null);
        try {
            const response = await api.post("/auth/verify-pin", { pin: cleanPin }, { headers: { Authorization: `Bearer ${token}` } });
            setUser(response.data.user);
            setLocked(false);
            setPin("");
            resetIdleTimer();
            setInfo("Unlocked.");
        }
        catch (error) {
            const message = apiErrorMessage(error, "PIN verification failed. Try again.");
            if (message.toLowerCase().includes("expired session token") || message.toLowerCase().includes("invalid or expired")) {
                setToken(null);
                setAuthToken(null);
                setLocked(true);
                setUser(null);
                setPin("");
                setInfo("Session expired. Sign in again.");
                setError(null);
                return;
            }
            setError(message);
        }
        finally {
            setBusy(null);
        }
    };
    const lockShell = async () => lockSession("manual");
    const loadLauncher = async () => {
        setAppsLoading(true);
        setAppsError(null);
        try {
            const response = await api.get("/apps/list");
            const data = unwrapData(response.data);
            const payload = (data.apps ?? []);
            setApps(payload.slice(0, 8).map((item, idx) => ({
                id: item.id ?? `${item.name ?? "app"}-${idx}`,
                name: item.name ?? "Unknown App"
            })));
        }
        catch {
            setApps([
                { id: "chrome", name: "Chrome", status: "mock" },
                { id: "discord", name: "Discord", status: "mock" },
                { id: "spotify", name: "Spotify", status: "mock" },
                { id: "youtube", name: "YouTube", status: "mock" },
                { id: "netflix", name: "Netflix", status: "mock" },
                { id: "instagram", name: "Instagram", status: "mock" },
                { id: "x", name: "X", status: "mock" },
                { id: "slack", name: "Slack", status: "mock" },
                { id: "telegram", name: "Telegram", status: "mock" },
                { id: "github", name: "GitHub", status: "mock" },
                { id: "figma", name: "Figma", status: "mock" },
                { id: "notion", name: "Notion", status: "mock" },
                { id: "obsidian", name: "Obsidian", status: "mock" },
                { id: "steam", name: "Steam", status: "mock" },
                { id: "epic-games", name: "Epic Games", status: "mock" },
                { id: "playstation", name: "PlayStation", status: "mock" },
                { id: "gmail", name: "Gmail", status: "mock" },
                { id: "drive", name: "Google Drive", status: "mock" },
                { id: "cursor", name: "Cursor", status: "mock" }
            ]);
            setAppsError("Live launcher endpoint unavailable. Showing mock apps.");
        }
        finally {
            setAppsLoading(false);
        }
    };
    const loadFiles = async () => {
        setFilesLoading(true);
        setFilesError(null);
        try {
            const [desktopResponse, recentResponse] = await Promise.all([api.get("/files/desktop"), api.get("/files/recent")]);
            const desktopData = unwrapData(desktopResponse.data);
            const recentData = unwrapData(recentResponse.data);
            const desktopFiles = (desktopData.files ?? []);
            const recent = (recentData.files ?? []);
            setDesktopCount(desktopFiles.length);
            setDownloadCount(Math.max(0, Math.round(desktopFiles.length * 0.35)));
            setRecentFiles(recent.slice(0, 4).map((file, idx) => ({
                name: file.name ?? `Recent file ${idx + 1}`,
                path: file.path ?? "unknown"
            })));
        }
        catch {
            setDesktopCount(18);
            setDownloadCount(42);
            setRecentFiles([
                { name: "Sprint Notes.md", path: "C:/Users/greyh/Desktop/Sprint Notes.md" },
                { name: "MIS430-Week9.pdf", path: "C:/Users/greyh/Downloads/MIS430-Week9.pdf" },
                { name: "cortex-roadmap.docx", path: "C:/Users/greyh/Documents/cortex-roadmap.docx" }
            ]);
            setFilesError("Live files endpoints unavailable. Showing cached preview.");
        }
        finally {
            setFilesLoading(false);
        }
    };
    const onLaunchApp = async (appId) => {
        if (!canInteract)
            return;
        setLaunchingAppId(appId);
        setAppsError(null);
        try {
            await api.post("/apps/launch", { appId });
            setApps((current) => current.map((app) => (app.id === appId ? { ...app, status: "launched" } : app)));
        }
        catch {
            setAppsError("Launch endpoint unavailable. Action queued locally.");
            setApps((current) => current.map((app) => (app.id === appId ? { ...app, status: "queued" } : app)));
        }
        finally {
            setLaunchingAppId(null);
        }
    };
    const onSearchFiles = async (event) => {
        event.preventDefault();
        if (!fileSearchTerm.trim()) {
            setFileSearchResults([]);
            return;
        }
        setFileSearchBusy(true);
        setFilesError(null);
        try {
            const response = await api.get("/files/search", { params: { q: fileSearchTerm.trim() } });
            const data = unwrapData(response.data);
            const results = (data.results ?? []);
            setFileSearchResults(results.slice(0, 5).map((file, idx) => ({
                name: file.name ?? `Match ${idx + 1}`,
                path: file.path ?? "unknown"
            })));
        }
        catch {
            setFileSearchResults([
                { name: `${fileSearchTerm}.md`, path: "C:/mock/search/result-1.md" },
                { name: `${fileSearchTerm}.txt`, path: "C:/mock/search/result-2.txt" }
            ]);
            setFilesError("Search endpoint unavailable. Showing local mock matches.");
        }
        finally {
            setFileSearchBusy(false);
        }
    };
    const onSendAiPrompt = async (event) => {
        event.preventDefault();
        const trimmedPrompt = aiPrompt.trim();
        if (!trimmedPrompt)
            return;
        setAiLoading(true);
        setAiError(null);
        setAiMessages((current) => [...current, { role: "user", content: trimmedPrompt }]);
        setAiPrompt("");
        try {
            const response = await api.post("/ai/chat", { message: trimmedPrompt });
            const data = unwrapData(response.data);
            const reply = (data.reply ?? data.message ?? "AI responded.");
            setAiMessages((current) => [...current, { role: "assistant", content: reply }]);
        }
        catch {
            setAiMessages((current) => [
                ...current,
                { role: "assistant", content: `Mock reply: I can help with "${trimmedPrompt}".` }
            ]);
            setAiError("Live AI chat endpoint unavailable. Using mock reply.");
        }
        finally {
            setAiLoading(false);
        }
    };
    const loadGmailBundle = async () => {
        setGmailBusy(true);
        setGmailError(null);
        try {
            const statusRes = await api.get("/gmail/status");
            const statusData = unwrapData(statusRes.data);
            setGmailConfigured(Boolean(statusData.configured));
            setGmailConnected(Boolean(statusData.connected));
            if (statusData.connected) {
                const inboxRes = await api.get("/gmail/inbox", { params: { maxResults: 14, q: "in:inbox" } });
                const inboxData = unwrapData(inboxRes.data);
                const raw = (inboxData.messages ?? []);
                setGmailInbox(raw.map((m) => ({
                    id: m.id,
                    subject: m.subject ?? "(no subject)",
                    from: m.from ?? "",
                    snippet: m.snippet ?? "",
                    unread: Boolean(m.unread ?? m.labelIds?.includes("UNREAD"))
                })));
            }
            else {
                setGmailInbox([]);
            }
        }
        catch {
            setGmailError("Could not reach Gmail endpoints. Is the API running?");
            setGmailInbox([]);
        }
        finally {
            setGmailBusy(false);
        }
    };
    const startGmailOAuth = async () => {
        setGmailError(null);
        try {
            const response = await api.get("/gmail/oauth/url");
            const data = unwrapData(response.data);
            if (data.url) {
                window.location.assign(data.url);
                return;
            }
            setGmailError("OAuth URL missing from server response.");
        }
        catch {
            setGmailError("Google OAuth is not configured or the request failed.");
        }
    };
    const archiveGmailMessage = async (messageId) => {
        try {
            await api.post("/gmail/messages/archive", { messageId });
            await loadGmailBundle();
        }
        catch {
            setGmailError("Could not archive message.");
        }
    };
    const markGmailRead = async (messageId) => {
        try {
            await api.post("/gmail/messages/mark-read", { messageId });
            await loadGmailBundle();
        }
        catch {
            setGmailError("Could not mark message read.");
        }
    };
    const onRunCommand = async (event) => {
        event.preventDefault();
        const trimmedCommand = commandInput.trim();
        if (!trimmedCommand)
            return;
        setCommandBusy(true);
        setCommandError(null);
        try {
            const response = await api.post("/ai/command", { command: trimmedCommand });
            const data = unwrapData(response.data);
            const result = (data.result ?? data.message ?? data.status ?? "Command accepted.");
            setCommandResult(result);
        }
        catch {
            setCommandResult(`Mock execute: ${trimmedCommand}`);
            setCommandError("Live command endpoint unavailable. Executed in mock mode.");
        }
        finally {
            setCommandBusy(false);
        }
    };
    useEffect(() => {
        if (!isUnlocked)
            return;
        const params = new URLSearchParams(window.location.search);
        if (params.has("gmail_connected")) {
            window.history.replaceState({}, document.title, window.location.pathname);
            queueMicrotask(() => setInfo("Gmail connected to this session."));
        }
        const errCode = params.get("gmail_error");
        if (errCode) {
            window.history.replaceState({}, document.title, window.location.pathname);
            queueMicrotask(() => setGmailError(`Gmail OAuth: ${decodeURIComponent(errCode)}`));
        }
        queueMicrotask(() => {
            void loadLauncher();
            void loadFiles();
            void loadGmailBundle();
        });
    }, [isUnlocked]);
    const logout = async () => {
        if (!canInteract)
            return;
        setBusy("logout");
        clearIdleTimer();
        if (token) {
            try {
                await api.post("/auth/logout", {}, { headers: { Authorization: `Bearer ${token}` } });
            }
            catch {
                setError("Logout request failed. Clearing local session.");
            }
        }
        setToken(null);
        setAuthToken(null);
        setUser(null);
        setLocked(true);
        setPin("");
        setBusy(null);
    };
    const moduleMeta = useMemo(() => [
        { id: "apps", label: "Apps", detail: `${apps.length || 0} available`, subtitle: "Launch and monitor tools" },
        { id: "files", label: "Files", detail: `${recentFiles.length || 0} recent`, subtitle: "Browse and search workspace" },
        { id: "ai", label: "AI", detail: `${aiMessages.length} msgs`, subtitle: "Prompt and run commands" },
        { id: "tasks", label: "Tasks", detail: "", subtitle: "Create and manage tasks" }
    ], [apps.length, recentFiles.length, aiMessages.length]);
    const sanitizedModuleOrder = useMemo(() => {
        const valid = moduleOrder.filter((item) => DEFAULT_MODULE_ORDER.includes(item));
        const missing = DEFAULT_MODULE_ORDER.filter((item) => !valid.includes(item));
        return [...valid, ...missing];
    }, [moduleOrder]);
    useEffect(() => {
        if (sanitizedModuleOrder.join("|") !== moduleOrder.join("|")) {
            setModuleOrder(sanitizedModuleOrder);
        }
    }, [moduleOrder, sanitizedModuleOrder, setModuleOrder]);
    const onModuleKeyMove = (moduleId, direction) => {
        const fromIndex = sanitizedModuleOrder.indexOf(moduleId);
        const toIndex = fromIndex + direction;
        if (fromIndex < 0 || toIndex < 0 || toIndex >= sanitizedModuleOrder.length)
            return;
        setModuleOrder(reorderList(sanitizedModuleOrder, fromIndex, toIndex));
    };
    const metaById = useMemo(() => {
        const appsMeta = moduleMeta.find((m) => m.id === "apps");
        const filesMeta = moduleMeta.find((m) => m.id === "files");
        const aiMeta = moduleMeta.find((m) => m.id === "ai");
        const tasksMeta = moduleMeta.find((m) => m.id === "tasks");
        return {
            apps: { label: "Apps", subtitle: appsMeta?.subtitle ?? "", headerTitle: "App Launcher" },
            files: { label: "Files", subtitle: filesMeta?.subtitle ?? "", headerTitle: "Files" },
            ai: { label: "AI", subtitle: aiMeta?.subtitle ?? "", headerTitle: "AI Quick Prompt" },
            tasks: { label: "Tasks", subtitle: tasksMeta?.subtitle ?? "", headerTitle: "Tasks" }
        };
    }, [moduleMeta]);
    const refreshWorkspaceModules = (id) => {
        pushToast({ title: "Refreshing module", message: metaById[id].label, tone: "neutral" });
        if (id === "apps")
            void loadLauncher();
        else if (id === "files")
            void loadFiles();
        else if (id === "ai")
            setAiMessages((prev) => [...prev]);
        else if (id === "tasks")
            setActiveModule("tasks");
    };
    const paletteActions = useMemo(() => [
        { id: "nav-apps", group: "Navigate", label: "Apps module", shortcut: "⌃1", keywords: "launcher", onSelect: () => setActiveModule("apps") },
        { id: "nav-files", group: "Navigate", label: "Files module", shortcut: "⌃2", keywords: "explorer", onSelect: () => setActiveModule("files") },
        { id: "nav-ai", group: "Navigate", label: "AI module", shortcut: "⌃3", keywords: "chat", onSelect: () => setActiveModule("ai") },
        { id: "nav-tasks", group: "Navigate", label: "Tasks module", shortcut: "⌃4", keywords: "todo planner", onSelect: () => setActiveModule("tasks") },
        {
            id: "expand-apps",
            group: "Modules",
            label: "Expand Apps fullscreen",
            onSelect: () => setExpandedModule("apps")
        },
        {
            id: "expand-files",
            group: "Modules",
            label: "Expand Files fullscreen",
            onSelect: () => setExpandedModule("files")
        },
        {
            id: "expand-ai",
            group: "Modules",
            label: "Expand AI fullscreen",
            onSelect: () => setExpandedModule("ai")
        },
        {
            id: "expand-tasks",
            group: "Modules",
            label: "Expand Tasks fullscreen",
            onSelect: () => setExpandedModule("tasks")
        },
        {
            id: "collapse-module",
            group: "Modules",
            label: "Exit fullscreen module",
            shortcut: "Esc",
            onSelect: () => setExpandedModule(null)
        },
        {
            id: "refresh-all",
            group: "Workspace",
            label: "Refresh launcher, files, Gmail",
            shortcut: "F5",
            onSelect: () => {
                void loadLauncher();
                void loadFiles();
                void loadGmailBundle();
                pushToast({ title: "Workspace refresh started", tone: "neutral" });
            }
        },
        {
            id: "lock-session",
            group: "Session",
            label: "Lock Cortex",
            shortcut: "⌃L",
            onSelect: () => void lockShell()
        }
    ], 
    // Palette entries intentionally close over latest loaders / handlers without widening rerenders.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable UX actions
    [pushToast, setActiveModule]);
    useDesktopShortcuts({
        enabled: isUnlocked,
        paletteOpen,
        expandedModuleOpen: Boolean(expandedModule),
        activeModule,
        onOpenPalette: () => setPaletteOpen(true),
        onClosePalette: () => setPaletteOpen(false),
        onCloseExpanded: () => setExpandedModule(null),
        onLock: () => void lockShell(),
        onFocusAiChat: () => aiInputRef.current?.focus(),
        onRefreshFocused: () => {
            if (activeModule === "apps")
                void loadLauncher();
            else if (activeModule === "files")
                void loadFiles();
            else if (activeModule === "ai")
                void loadGmailBundle();
            pushToast({ title: "Module refreshed", message: metaById[activeModule].label });
        },
        navigateModule: (index) => {
            const order = ["apps", "files", "ai", "tasks"];
            const target = order[index - 1];
            if (target)
                setActiveModule(target);
        },
        cycleModule: (dir) => {
            const idx = sanitizedModuleOrder.indexOf(activeModule);
            const len = sanitizedModuleOrder.length;
            if (len === 0)
                return;
            const next = (idx + dir + len) % len;
            setActiveModule(sanitizedModuleOrder[next]);
        },
        onSelectAllFiles: () => {
            setSelectedFilePaths(new Set(recentFiles.map((f) => f.path)));
            pushToast({ title: "Files selected", message: `${recentFiles.length} recent items`, tone: "neutral" });
        }
    });
    useEffect(() => {
        if (!isUnlocked || activeModule !== "files")
            return;
        const clearUnlessRow = (event) => {
            const target = event.target;
            if (target?.closest("[data-file-row]"))
                return;
            setSelectedFilePaths(new Set());
            fileAnchorIndexRef.current = null;
        };
        document.addEventListener("mousedown", clearUnlessRow);
        return () => document.removeEventListener("mousedown", clearUnlessRow);
    }, [isUnlocked, activeModule]);
    const handleFileRowMouseDown = useCallback((file, index, event) => {
        event.preventDefault();
        const orderedPaths = recentFiles.map((f) => f.path);
        if (event.shiftKey && fileAnchorIndexRef.current !== null) {
            const start = Math.min(fileAnchorIndexRef.current, index);
            const end = Math.max(fileAnchorIndexRef.current, index);
            setSelectedFilePaths(new Set(orderedPaths.slice(start, end + 1)));
            return;
        }
        if (event.ctrlKey || event.metaKey) {
            setSelectedFilePaths((prev) => {
                const next = new Set(prev);
                if (next.has(file.path))
                    next.delete(file.path);
                else
                    next.add(file.path);
                return next;
            });
            fileAnchorIndexRef.current = index;
            return;
        }
        setSelectedFilePaths(new Set([file.path]));
        fileAnchorIndexRef.current = index;
    }, [recentFiles]);
    const renderModule = (id, ctx) => {
        if (ctx.ghostInGrid) {
            return _jsx("p", { className: "subtle module-fs-placeholder", children: "Fullscreen below \u2014 Esc or Back to grid." });
        }
        if (id === "apps") {
            return (_jsxs(_Fragment, { children: [_jsx("div", { className: "module-inline-actions", children: _jsx("button", { onClick: () => void loadLauncher(), disabled: appsLoading || !canInteract, children: appsLoading ? "Loading..." : "Refresh" }) }), appsError ? _jsx("p", { className: "module-error", children: appsError }) : null, _jsxs("div", { className: "stack", children: [appsLoading ? _jsx("p", { className: "subtle", children: "Loading apps..." }) : null, !appsLoading &&
                                apps.map((app) => {
                                    const icon = resolveBrandIcon(app.id, app.name);
                                    return (_jsxs(ContextMenu.Root, { children: [_jsx(ContextMenu.Trigger, { asChild: true, children: _jsxs("div", { className: "row-item row-with-brand", children: [_jsxs("div", { className: "row-brand", children: [_jsx("span", { className: "app-brand-tile", children: icon ? _jsx(BrandIcon, { icon: icon, className: "app-brand-icon" }) : _jsx("span", { className: "app-brand-fallback" }) }), _jsxs("div", { className: "row-brand-text", children: [_jsx("span", { children: app.name }), app.status ? _jsx("small", { children: app.status }) : null] })] }), _jsx("button", { type: "button", onClick: () => void onLaunchApp(app.id), disabled: launchingAppId === app.id || !canInteract, children: launchingAppId === app.id ? "Launching..." : "Launch" })] }) }), _jsx(ContextMenu.Portal, { children: _jsxs(ContextMenu.Content, { className: "shell-context-content", children: [_jsxs(ContextMenu.Item, { className: "shell-context-item", onSelect: () => void onLaunchApp(app.id), children: ["Launch ", app.name] }), _jsx(ContextMenu.Item, { className: "shell-context-item", onSelect: () => {
                                                                void navigator.clipboard?.writeText(app.id);
                                                                pushToast({ title: "Copied app id", message: app.id });
                                                            }, children: "Copy app id" })] }) })] }, app.id));
                                })] })] }));
        }
        if (id === "files") {
            const renderRecentRow = (file, index) => {
                const selected = selectedFilePaths.has(file.path);
                return (_jsxs(ContextMenu.Root, { children: [_jsx(ContextMenu.Trigger, { asChild: true, children: _jsxs("div", { role: "button", tabIndex: 0, "data-file-row": "true", className: `row-item file-row-selectable ${selected ? "selected-file" : ""}`, onMouseDown: (event) => handleFileRowMouseDown(file, index, event), onKeyDown: (event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        setSelectedFilePaths(new Set([file.path]));
                                    }
                                }, children: [_jsx("span", { children: file.name }), _jsx("span", { className: "subtle file-row-path", children: file.path })] }) }), _jsx(ContextMenu.Portal, { children: _jsxs(ContextMenu.Content, { className: "shell-context-content", children: [_jsx(ContextMenu.Item, { className: "shell-context-item", onSelect: () => {
                                            void navigator.clipboard?.writeText(file.path);
                                            pushToast({ title: "Copied path", tone: "success" });
                                        }, children: "Copy path" }), _jsx(ContextMenu.Item, { className: "shell-context-item", onSelect: () => pushToast({ title: file.name, message: file.path }), children: "Properties (preview)" })] }) })] }, file.path));
            };
            return (_jsxs(_Fragment, { children: [_jsx("div", { className: "module-inline-actions", children: _jsx("button", { onClick: () => void loadFiles(), disabled: filesLoading || !canInteract, children: filesLoading ? "Loading..." : "Refresh" }) }), filesError ? _jsx("p", { className: "module-error", children: filesError }) : null, _jsxs("p", { className: "subtle", children: ["Desktop: ", desktopCount ?? "--", " | Downloads: ", downloadCount ?? "--"] }), _jsxs("p", { className: "subtle meta-label", children: ["Recent ", selectedFilePaths.size > 0 ? `(selected ${selectedFilePaths.size})` : ""] }), recentFiles.length > 48 ? (_jsx(Virtuoso, { className: "files-virtuoso", style: { height: 260 }, data: recentFiles, itemContent: (index, file) => renderRecentRow(file, index) })) : (_jsx("div", { className: "stack", children: recentFiles.map((file, index) => renderRecentRow(file, index)) })), _jsxs("form", { onSubmit: onSearchFiles, className: "inline-form", children: [_jsx("input", { value: fileSearchTerm, onChange: (event) => setFileSearchTerm(event.target.value), placeholder: "Search files...", "aria-label": "Search files" }), _jsx("button", { type: "submit", disabled: fileSearchBusy || !canInteract, children: fileSearchBusy ? "Searching..." : "Search" })] }), fileSearchResults.length > 0 ? (_jsx("div", { className: "stack search-results", children: fileSearchResults.map((file) => (_jsx("p", { className: "row-item", children: file.name }, `${file.path}-${file.name}`))) })) : null] }));
        }
        if (id === "tasks") {
            return _jsx(TasksPage, {});
        }
        return (_jsxs(_Fragment, { children: [aiError ? _jsx("p", { className: "module-error", children: aiError }) : null, _jsx("div", { className: "chat-list", children: aiMessages.slice(-8).map((message, idx) => (_jsxs("p", { className: message.role === "assistant" ? "chat-assistant" : "chat-user", children: [_jsxs("strong", { children: [message.role === "assistant" ? "AI" : "You", ":"] }), " ", message.content] }, `${message.role}-${idx}`))) }), _jsxs("form", { onSubmit: onSendAiPrompt, className: "inline-form", children: [_jsx("input", { ref: aiInputRef, value: aiPrompt, onChange: (event) => setAiPrompt(event.target.value), placeholder: "Ask AI...", "aria-label": "Ask AI" }), _jsx("button", { type: "submit", disabled: aiLoading || !canInteract, children: aiLoading ? "Sending..." : "Send" })] })] }));
    };
    return (_jsx("div", { className: ["shell-root", desktopDragging ? "module-dragging" : ""].filter(Boolean).join(" "), children: !hasSession || !isUnlocked ? (_jsxs(GlassPanel, { className: "auth-shell", as: "section", children: [_jsx("p", { className: "eyebrow", children: "Cortex security" }), _jsx("h1", { children: "CORTEX" }), _jsx("p", { className: "shell-subtitle", children: "Secure command shell" }), _jsx("p", { className: "subtle", children: "Demo login: grey@cortex.local / ChangeMe123! | PIN: 1234" }), !hasSession ? (_jsxs("form", { onSubmit: onLogin, className: "form", children: [_jsx("label", { htmlFor: "email", children: "Email" }), _jsx("input", { id: "email", value: email, onChange: (event) => setEmail(event.target.value), type: "email", autoComplete: "username", required: true }), _jsx("label", { htmlFor: "password", children: "Password" }), _jsx("input", { id: "password", value: password, onChange: (event) => setPassword(event.target.value), type: "password", autoComplete: "current-password", required: true }), _jsx("button", { type: "submit", disabled: !canInteract, children: busy === "login" ? "Signing in..." : "Sign in" })] })) : (_jsxs("form", { onSubmit: onUnlock, className: "form", children: [_jsxs("p", { className: "lock-copy", children: ["Session locked for ", email] }), _jsx("label", { htmlFor: "pin", children: "PIN" }), _jsx("input", { id: "pin", value: pin, onChange: (event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6)), type: "password", inputMode: "numeric", pattern: "[0-9]{4,6}", autoComplete: "one-time-code", required: true }), _jsx("button", { type: "submit", disabled: !canInteract, children: busy === "unlock" ? "Unlocking..." : "Unlock session" })] })), _jsxs("div", { className: "auth-status", children: [error ? _jsx("p", { className: "error", children: error }) : null, info ? _jsx("p", { className: "subtle", children: info }) : null] })] })) : (_jsxs(Tooltip.Provider, { delayDuration: 260, children: [_jsx(ToastViewport, {}), _jsx(CommandPalette, { open: paletteOpen, onOpenChange: setPaletteOpen, actions: paletteActions }), _jsx("div", { className: `desktop-shell ${sidebarCollapsed ? "sidebar-compact" : ""}`, children: _jsxs(Group, { orientation: "horizontal", id: "cortex-shell-layout", className: "shell-panel-group", children: [_jsx(Panel, { id: "shell-sidebar", defaultSize: sidebarCollapsed ? 18 : 26, minSize: 16, maxSize: 34, className: "shell-sidebar-panel", children: _jsxs("aside", { className: `shell-sidebar ${sidebarCollapsed ? "collapsed" : ""}`, "aria-label": "Shell navigation", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "Cortex shell" }), _jsxs("div", { className: "sidebar-heading", children: [_jsx("h2", { children: "Control" }), _jsx("button", { type: "button", className: "sidebar-toggle", onClick: () => setSidebarCollapsed((prev) => !prev), "aria-label": sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar", "aria-pressed": sidebarCollapsed, children: sidebarCollapsed ? "Expand" : "Compact" })] })] }), _jsxs("div", { className: "sidebar-meta", children: [_jsx(StatusChip, { tone: "success", children: "Online" }), _jsx(StatusChip, { tone: "neutral", children: "Auto-lock 5m" })] }), _jsx("nav", { className: "module-nav", children: moduleMeta.map((module) => (_jsxs("button", { type: "button", className: `module-nav-item ${activeModule === module.id ? "active" : ""}`, onClick: () => setActiveModule(module.id), title: sidebarCollapsed ? module.label : undefined, children: [_jsx("span", { children: module.label }), _jsx("small", { children: module.detail })] }, module.id))) }), _jsxs("div", { className: "sidebar-footer", children: [_jsxs("p", { className: "subtle", children: ["Signed in as ", user?.email] }), _jsxs("div", { className: "actions", children: [_jsx("button", { onClick: () => void lockShell(), disabled: !canInteract, children: busy === "lock" ? "Locking..." : "Lock" }), _jsx("button", { onClick: () => void logout(), disabled: !canInteract, children: busy === "logout" ? "Logging out..." : "Logout" })] })] })] }) }), _jsx(Separator, { className: "shell-resize-handle" }), _jsx(Panel, { id: "shell-main", defaultSize: 74, minSize: 58, className: "shell-main-panel", children: _jsxs("main", { className: "shell-canvas", children: [_jsxs("header", { className: "shell-header", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "Workspace" }), _jsx("h1", { children: "Welcome back" })] }), _jsx("p", { className: "subtle", children: "Session active with secure idle lock." })] }), _jsxs("section", { className: "email-rail", "aria-label": "Gmail", children: [_jsxs("div", { className: "email-rail-heading", children: [_jsx(BrandIcon, { icon: siGmail, className: "email-rail-icon" }), _jsxs("div", { children: [_jsx("p", { className: "meta-label", children: "Inbox strip" }), _jsx("strong", { children: gmailBusy ? "Syncing Gmail…" : gmailConnected ? "Live inbox" : "Not connected" })] })] }), _jsx("div", { className: "email-rail-actions", children: !gmailConfigured ? (_jsx("span", { className: "subtle", children: "API missing Google OAuth env" })) : gmailConnected ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: () => void loadGmailBundle(), disabled: gmailBusy || !canInteract, children: "Refresh" }), _jsx("button", { type: "button", className: "ghost-btn", onClick: () => api
                                                                    .post("/gmail/disconnect")
                                                                    .then(() => loadGmailBundle())
                                                                    .catch(() => setGmailError("Disconnect failed")), disabled: !canInteract, children: "Disconnect" })] })) : (_jsx("button", { type: "button", className: "primary-btn", onClick: () => void startGmailOAuth(), disabled: !canInteract, children: "Connect Gmail" })) }), _jsx("div", { className: "email-rail-scroll", children: !gmailConnected || gmailInbox.length === 0 ? (_jsx("p", { className: "subtle email-rail-empty", children: gmailConnected ? "Inbox empty or still loading." : "Connect Gmail to show messages here." })) : (gmailInbox.map((mail) => (_jsxs("article", { className: `email-chip ${mail.unread ? "unread" : ""}`, children: [_jsxs("header", { children: [_jsx("span", { className: "email-chip-subject", title: mail.subject, children: mail.subject }), _jsx("span", { className: "email-chip-from", title: mail.from, children: mail.from })] }), _jsx("p", { className: "email-chip-snippet", children: mail.snippet }), _jsxs("div", { className: "email-chip-actions", children: [_jsx("button", { type: "button", onClick: () => void markGmailRead(mail.id), children: "Read" }), _jsx("button", { type: "button", onClick: () => void archiveGmailMessage(mail.id), children: "Archive" })] })] }, mail.id)))) }), gmailError ? _jsx("p", { className: "module-error email-rail-error", children: gmailError }) : null] }), _jsx(DashboardModules, { moduleIds: sanitizedModuleOrder, onReorder: setModuleOrder, activeModule: activeModule, onActiveModule: setActiveModule, expandedModule: expandedModule, onExpandedChange: setExpandedModule, onDragActiveChange: setDesktopDragging, metaById: metaById, onMoveStep: onModuleKeyMove, onRefreshModule: refreshWorkspaceModules, renderModule: renderModule }), _jsxs("form", { onSubmit: onRunCommand, className: `command-dock ${commandBusy ? "is-busy" : ""} ${commandResult ? "has-result" : ""} ${commandError ? "has-error" : ""}`, children: [_jsx("p", { className: "dock-label", children: "Command dock" }), _jsxs("div", { className: "command-bar", children: [_jsx("input", { value: commandInput, onChange: (event) => setCommandInput(event.target.value), placeholder: "Search workspace or run command...", "aria-label": "Search or run command" }), _jsx("button", { type: "submit", disabled: commandBusy || !canInteract, children: commandBusy ? "Running..." : "Execute" })] }), commandError ? _jsx("p", { className: "module-error", children: commandError }) : null, commandResult ? _jsxs("p", { className: "subtle", children: ["Result: ", commandResult] }) : null] }), error ? _jsx("p", { className: "error", children: error }) : null, info ? _jsx("p", { className: "subtle", children: info }) : null] }) })] }) })] })) }));
}
