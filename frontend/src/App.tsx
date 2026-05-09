import * as ContextMenu from "@radix-ui/react-context-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import { isAxiosError } from "axios";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { Virtuoso } from "react-virtuoso";
import { siGmail } from "simple-icons";
import { api, setAuthToken } from "./api/client";
import { BrandIcon } from "./components/BrandIcon";
import { CommandPalette, type PaletteAction } from "./components/shell/CommandPalette";
import { DashboardModules } from "./components/shell/DashboardModules";
import type { ModuleChromeMeta, ModuleRenderContext } from "./components/shell/DashboardModules";
import { ToastViewport } from "./components/shell/ToastViewport";
import { GlassPanel } from "./components/ui/GlassPanel";
import { StatusChip } from "./components/ui/StatusChip";
import { useDesktopShortcuts } from "./hooks/useDesktopShortcuts";
import { resolveBrandIcon } from "./lib/brandIcons";
import { usePersistentState } from "./hooks/usePersistentState";
import { useToastStore } from "./stores/toastStore";
import type { CortexModuleKey } from "./types/moduleKey";
import { reorderList } from "./utils/reorder";
import { TasksPage } from "./pages/TasksPage";

type SessionUser = { userId: string; email: string };
type LauncherApp = { id: string; name: string; status?: string };
type GmailPreview = { id: string; subject: string; from: string; snippet: string; unread: boolean };
type FileEntry = { name: string; path: string };
type AIMessage = { role: "user" | "assistant"; content: string };
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const TOKEN_KEY = "cortex_token";
const SIDEBAR_COLLAPSED_KEY = "cortex_sidebar_collapsed_v2";
const MODULE_ORDER_KEY = "cortex_module_order";
const DEFAULT_MODULE_ORDER: CortexModuleKey[] = ["apps", "files", "ai", "tasks"];

export default function App() {
  const [email, setEmail] = useState("grey@cortex.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [pin, setPin] = useState("");
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [locked, setLocked] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>("Use demo credentials to sign in.");
  const [busy, setBusy] = useState<"login" | "unlock" | "lock" | "logout" | null>(null);
  const [apps, setApps] = useState<LauncherApp[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [launchingAppId, setLaunchingAppId] = useState<string | null>(null);

  const [desktopCount, setDesktopCount] = useState<number | null>(null);
  const [downloadCount, setDownloadCount] = useState<number | null>(null);
  const [recentFiles, setRecentFiles] = useState<FileEntry[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [fileSearchTerm, setFileSearchTerm] = useState("");
  const [fileSearchResults, setFileSearchResults] = useState<FileEntry[]>([]);
  const [fileSearchBusy, setFileSearchBusy] = useState(false);

  const [aiMessages, setAiMessages] = useState<AIMessage[]>([
    { role: "assistant", content: "AI module ready. Ask a quick question or run a command below." }
  ]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [commandInput, setCommandInput] = useState("");
  const [commandBusy, setCommandBusy] = useState(false);
  const [commandResult, setCommandResult] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);

  const [gmailConfigured, setGmailConfigured] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailInbox, setGmailInbox] = useState<GmailPreview[]>([]);
  const [gmailBusy, setGmailBusy] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [activeModule, setActiveModuleState] = useState<CortexModuleKey>("apps");
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState<boolean>(SIDEBAR_COLLAPSED_KEY, false);
  const [moduleOrder, setModuleOrder] = usePersistentState<CortexModuleKey[]>(MODULE_ORDER_KEY, DEFAULT_MODULE_ORDER);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [expandedModule, setExpandedModule] = useState<CortexModuleKey | null>(null);
  const [desktopDragging, setDesktopDragging] = useState(false);
  const [selectedFilePaths, setSelectedFilePaths] = useState<Set<string>>(() => new Set());
  const fileAnchorIndexRef = useRef<number | null>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);

  const setActiveModule = useCallback((id: CortexModuleKey) => {
    if (id !== "files") {
      setSelectedFilePaths(new Set());
      fileAnchorIndexRef.current = null;
    }
    setActiveModuleState(id);
  }, []);

  const pushToast = useToastStore((s) => s.push);
  const idleTimerRef = useRef<number | null>(null);
  const hasSession = useMemo(() => Boolean(token), [token]);
  const isUnlocked = useMemo(() => Boolean(token && user && !locked), [locked, token, user]);
  const canInteract = busy === null;
  const unwrapData = <T,>(payload: unknown): T => {
    if (payload && typeof payload === "object" && "data" in payload) {
      return (payload as { data: T }).data;
    }
    return payload as T;
  };

  const apiErrorMessage = (error: unknown, fallback: string) => {
    if (isAxiosError(error)) {
      const payload = error.response?.data;
      if (payload && typeof payload === "object" && "error" in payload) {
        const nested = (payload as { error?: { message?: unknown } }).error;
        if (nested?.message && typeof nested.message === "string") return nested.message;
      }
      if (payload && typeof payload === "object" && "message" in payload) {
        const direct = (payload as { message?: unknown }).message;
        if (typeof direct === "string" && direct.trim()) return direct;
      }
      if (error.response?.status === 429) return "Too many attempts. Wait a minute and try again.";
    }
    return fallback;
  };

  const clearIdleTimer = () => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  };

  const lockSession = async (lockReason: "manual" | "idle") => {
    if (!token) return;
    setBusy("lock");
    setError(null);
    try {
      await api.post("/auth/lock", { lockReason }, { headers: { Authorization: `Bearer ${token}` } });
      setLocked(true);
      setPin("");
      setUser(null);
    } catch {
      setError("Unable to lock session. Please retry.");
    } finally {
      setBusy(null);
    }
  };

  const resetIdleTimer = () => {
    clearIdleTimer();
    if (!token || locked) return;
    idleTimerRef.current = window.setTimeout(() => {
      void lockSession("idle");
    }, IDLE_TIMEOUT_MS);
  };

  useEffect(() => {
    setAuthToken(token);
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);

  useEffect(() => {
    if (!token || locked) {
      clearIdleTimer();
      return;
    }
    const onActivity = () => resetIdleTimer();
    const events: Array<keyof WindowEventMap> = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((eventName) => window.addEventListener(eventName, onActivity, { passive: true }));
    resetIdleTimer();
    return () => {
      clearIdleTimer();
      events.forEach((eventName) => window.removeEventListener(eventName, onActivity));
    };
  }, [token, locked]);

  const onLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!canInteract) return;
    setBusy("login");
    setError(null);
    setInfo(null);
    try {
      const response = await api.post("/auth/login", { email, password });
      const nextToken = response.data.token as string;
      setToken(nextToken);
      setAuthToken(nextToken);
      setLocked(true);
      setUser(null);
      setInfo("Login successful. Step 2: enter your PIN to unlock.");
    } catch {
      setError("Login failed. Check your email and password.");
    } finally {
      setBusy(null);
    }
  };

  const onUnlock = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !canInteract) return;
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
      setUser(response.data.user as SessionUser);
      setLocked(false);
      setPin("");
      resetIdleTimer();
      setInfo("Unlocked.");
    } catch (error) {
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
    } finally {
      setBusy(null);
    }
  };

  const lockShell = async () => lockSession("manual");

  const loadLauncher = async () => {
    setAppsLoading(true);
    setAppsError(null);
    try {
      const response = await api.get("/apps/list");
      const data = unwrapData<{ apps?: Array<{ id?: string; name?: string }> }>(response.data);
      const payload = (data.apps ?? []) as Array<{ id?: string; name?: string }>;
      setApps(
        payload.slice(0, 8).map((item, idx) => ({
          id: item.id ?? `${item.name ?? "app"}-${idx}`,
          name: item.name ?? "Unknown App"
        }))
      );
    } catch {
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
    } finally {
      setAppsLoading(false);
    }
  };

  const loadFiles = async () => {
    setFilesLoading(true);
    setFilesError(null);
    try {
      const [desktopResponse, recentResponse] = await Promise.all([api.get("/files/desktop"), api.get("/files/recent")]);
      const desktopData = unwrapData<{ files?: Array<{ name?: string; path?: string }> }>(desktopResponse.data);
      const recentData = unwrapData<{ files?: Array<{ name?: string; path?: string }> }>(recentResponse.data);
      const desktopFiles = (desktopData.files ?? []) as Array<{ name?: string; path?: string }>;
      const recent = (recentData.files ?? []) as Array<{ name?: string; path?: string }>;
      setDesktopCount(desktopFiles.length);
      setDownloadCount(Math.max(0, Math.round(desktopFiles.length * 0.35)));
      setRecentFiles(
        recent.slice(0, 4).map((file, idx) => ({
          name: file.name ?? `Recent file ${idx + 1}`,
          path: file.path ?? "unknown"
        }))
      );
    } catch {
      setDesktopCount(18);
      setDownloadCount(42);
      setRecentFiles([
        { name: "Sprint Notes.md", path: "C:/Users/greyh/Desktop/Sprint Notes.md" },
        { name: "MIS430-Week9.pdf", path: "C:/Users/greyh/Downloads/MIS430-Week9.pdf" },
        { name: "cortex-roadmap.docx", path: "C:/Users/greyh/Documents/cortex-roadmap.docx" }
      ]);
      setFilesError("Live files endpoints unavailable. Showing cached preview.");
    } finally {
      setFilesLoading(false);
    }
  };

  const onLaunchApp = async (appId: string) => {
    if (!canInteract) return;
    setLaunchingAppId(appId);
    setAppsError(null);
    try {
      await api.post("/apps/launch", { appId });
      setApps((current) => current.map((app) => (app.id === appId ? { ...app, status: "launched" } : app)));
    } catch {
      setAppsError("Launch endpoint unavailable. Action queued locally.");
      setApps((current) => current.map((app) => (app.id === appId ? { ...app, status: "queued" } : app)));
    } finally {
      setLaunchingAppId(null);
    }
  };

  const onSearchFiles = async (event: FormEvent) => {
    event.preventDefault();
    if (!fileSearchTerm.trim()) {
      setFileSearchResults([]);
      return;
    }
    setFileSearchBusy(true);
    setFilesError(null);
    try {
      const response = await api.get("/files/search", { params: { q: fileSearchTerm.trim() } });
      const data = unwrapData<{ results?: Array<{ name?: string; path?: string }> }>(response.data);
      const results = (data.results ?? []) as Array<{ name?: string; path?: string }>;
      setFileSearchResults(
        results.slice(0, 5).map((file, idx) => ({
          name: file.name ?? `Match ${idx + 1}`,
          path: file.path ?? "unknown"
        }))
      );
    } catch {
      setFileSearchResults([
        { name: `${fileSearchTerm}.md`, path: "C:/mock/search/result-1.md" },
        { name: `${fileSearchTerm}.txt`, path: "C:/mock/search/result-2.txt" }
      ]);
      setFilesError("Search endpoint unavailable. Showing local mock matches.");
    } finally {
      setFileSearchBusy(false);
    }
  };

  const onSendAiPrompt = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedPrompt = aiPrompt.trim();
    if (!trimmedPrompt) return;

    setAiLoading(true);
    setAiError(null);
    setAiMessages((current) => [...current, { role: "user", content: trimmedPrompt }]);
    setAiPrompt("");
    try {
      const response = await api.post("/ai/chat", { message: trimmedPrompt });
      const data = unwrapData<{ reply?: string; message?: string }>(response.data);
      const reply = (data.reply ?? data.message ?? "AI responded.") as string;
      setAiMessages((current) => [...current, { role: "assistant", content: reply }]);
    } catch {
      setAiMessages((current) => [
        ...current,
        { role: "assistant", content: `Mock reply: I can help with "${trimmedPrompt}".` }
      ]);
      setAiError("Live AI chat endpoint unavailable. Using mock reply.");
    } finally {
      setAiLoading(false);
    }
  };

  const loadGmailBundle = async () => {
    setGmailBusy(true);
    setGmailError(null);
    try {
      const statusRes = await api.get("/gmail/status");
      const statusData = unwrapData<{ configured?: boolean; connected?: boolean }>(statusRes.data);
      setGmailConfigured(Boolean(statusData.configured));
      setGmailConnected(Boolean(statusData.connected));
      if (statusData.connected) {
        const inboxRes = await api.get("/gmail/inbox", { params: { maxResults: 14, q: "in:inbox" } });
        const inboxData = unwrapData<{ messages?: GmailPreview[] }>(inboxRes.data);
        const raw = (inboxData.messages ?? []) as Array<GmailPreview & { labelIds?: string[] }>;
        setGmailInbox(
          raw.map((m) => ({
            id: m.id,
            subject: m.subject ?? "(no subject)",
            from: m.from ?? "",
            snippet: m.snippet ?? "",
            unread: Boolean(m.unread ?? m.labelIds?.includes("UNREAD"))
          }))
        );
      } else {
        setGmailInbox([]);
      }
    } catch {
      setGmailError("Could not reach Gmail endpoints. Is the API running?");
      setGmailInbox([]);
    } finally {
      setGmailBusy(false);
    }
  };

  const startGmailOAuth = async () => {
    setGmailError(null);
    try {
      const response = await api.get("/gmail/oauth/url");
      const data = unwrapData<{ url?: string }>(response.data);
      if (data.url) {
        window.location.assign(data.url);
        return;
      }
      setGmailError("OAuth URL missing from server response.");
    } catch {
      setGmailError("Google OAuth is not configured or the request failed.");
    }
  };

  const archiveGmailMessage = async (messageId: string) => {
    try {
      await api.post("/gmail/messages/archive", { messageId });
      await loadGmailBundle();
    } catch {
      setGmailError("Could not archive message.");
    }
  };

  const markGmailRead = async (messageId: string) => {
    try {
      await api.post("/gmail/messages/mark-read", { messageId });
      await loadGmailBundle();
    } catch {
      setGmailError("Could not mark message read.");
    }
  };

  const onRunCommand = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedCommand = commandInput.trim();
    if (!trimmedCommand) return;
    setCommandBusy(true);
    setCommandError(null);
    try {
      const response = await api.post("/ai/command", { command: trimmedCommand });
      const data = unwrapData<{ result?: string; message?: string; status?: string }>(response.data);
      const result = (data.result ?? data.message ?? data.status ?? "Command accepted.") as string;
      setCommandResult(result);
    } catch {
      setCommandResult(`Mock execute: ${trimmedCommand}`);
      setCommandError("Live command endpoint unavailable. Executed in mock mode.");
    } finally {
      setCommandBusy(false);
    }
  };

  useEffect(() => {
    if (!isUnlocked) return;
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
    if (!canInteract) return;
    setBusy("logout");
    clearIdleTimer();
    if (token) {
      try {
        await api.post("/auth/logout", {}, { headers: { Authorization: `Bearer ${token}` } });
      } catch {
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

  const moduleMeta = useMemo(
    (): Array<{ id: CortexModuleKey; label: string; detail: string; subtitle: string }> => [
      { id: "apps", label: "Apps", detail: `${apps.length || 0} available`, subtitle: "Launch and monitor tools" },
      { id: "files", label: "Files", detail: `${recentFiles.length || 0} recent`, subtitle: "Browse and search workspace" },
      { id: "ai", label: "AI", detail: `${aiMessages.length} msgs`, subtitle: "Prompt and run commands" },
      { id: "tasks", label: "Tasks", detail: "", subtitle: "Create and manage tasks" }
    ],
    [apps.length, recentFiles.length, aiMessages.length]
  );
  const sanitizedModuleOrder = useMemo(() => {
    const valid = moduleOrder.filter((item): item is CortexModuleKey => DEFAULT_MODULE_ORDER.includes(item));
    const missing = DEFAULT_MODULE_ORDER.filter((item) => !valid.includes(item));
    return [...valid, ...missing];
  }, [moduleOrder]);
  useEffect(() => {
    if (sanitizedModuleOrder.join("|") !== moduleOrder.join("|")) {
      setModuleOrder(sanitizedModuleOrder);
    }
  }, [moduleOrder, sanitizedModuleOrder, setModuleOrder]);

  const onModuleKeyMove = (moduleId: CortexModuleKey, direction: -1 | 1) => {
    const fromIndex = sanitizedModuleOrder.indexOf(moduleId);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= sanitizedModuleOrder.length) return;
    setModuleOrder(reorderList(sanitizedModuleOrder, fromIndex, toIndex));
  };

  const metaById = useMemo((): Record<CortexModuleKey, ModuleChromeMeta> => {
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

  const refreshWorkspaceModules = (id: CortexModuleKey) => {
    pushToast({ title: "Refreshing module", message: metaById[id].label, tone: "neutral" });
    if (id === "apps") void loadLauncher();
    else if (id === "files") void loadFiles();
    else if (id === "ai") setAiMessages((prev) => [...prev]);
    else if (id === "tasks") setActiveModule("tasks");
  };

  const paletteActions: PaletteAction[] = useMemo(
    () => [
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
    [pushToast, setActiveModule]
  );

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
      if (activeModule === "apps") void loadLauncher();
      else if (activeModule === "files") void loadFiles();
      else if (activeModule === "ai") void loadGmailBundle();
      pushToast({ title: "Module refreshed", message: metaById[activeModule].label });
    },
    navigateModule: (index) => {
      const order: CortexModuleKey[] = ["apps", "files", "ai", "tasks"];
      const target = order[index - 1];
      if (target) setActiveModule(target);
    },
    cycleModule: (dir) => {
      const idx = sanitizedModuleOrder.indexOf(activeModule);
      const len = sanitizedModuleOrder.length;
      if (len === 0) return;
      const next = (idx + dir + len) % len;
      setActiveModule(sanitizedModuleOrder[next]);
    },
    onSelectAllFiles: () => {
      setSelectedFilePaths(new Set(recentFiles.map((f) => f.path)));
      pushToast({ title: "Files selected", message: `${recentFiles.length} recent items`, tone: "neutral" });
    }
  });

  useEffect(() => {
    if (!isUnlocked || activeModule !== "files") return;
    const clearUnlessRow = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-file-row]")) return;
      setSelectedFilePaths(new Set());
      fileAnchorIndexRef.current = null;
    };
    document.addEventListener("mousedown", clearUnlessRow);
    return () => document.removeEventListener("mousedown", clearUnlessRow);
  }, [isUnlocked, activeModule]);

  const handleFileRowMouseDown = useCallback((file: FileEntry, index: number, event: ReactMouseEvent) => {
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
        if (next.has(file.path)) next.delete(file.path);
        else next.add(file.path);
        return next;
      });
      fileAnchorIndexRef.current = index;
      return;
    }
    setSelectedFilePaths(new Set([file.path]));
    fileAnchorIndexRef.current = index;
  }, [recentFiles]);

  const renderModule = (id: CortexModuleKey, ctx: ModuleRenderContext) => {
      if (ctx.ghostInGrid) {
        return <p className="subtle module-fs-placeholder">Fullscreen below — Esc or Back to grid.</p>;
      }

      if (id === "apps") {
        return (
          <>
            <div className="module-inline-actions">
              <button onClick={() => void loadLauncher()} disabled={appsLoading || !canInteract}>
                {appsLoading ? "Loading..." : "Refresh"}
              </button>
            </div>
            {appsError ? <p className="module-error">{appsError}</p> : null}
            <div className="stack">
              {appsLoading ? <p className="subtle">Loading apps...</p> : null}
              {!appsLoading &&
                apps.map((app) => {
                  const icon = resolveBrandIcon(app.id, app.name);
                  return (
                    <ContextMenu.Root key={app.id}>
                      <ContextMenu.Trigger asChild>
                        <div className="row-item row-with-brand">
                          <div className="row-brand">
                            <span className="app-brand-tile">
                              {icon ? <BrandIcon icon={icon} className="app-brand-icon" /> : <span className="app-brand-fallback" />}
                            </span>
                            <div className="row-brand-text">
                              <span>{app.name}</span>
                              {app.status ? <small>{app.status}</small> : null}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void onLaunchApp(app.id)}
                            disabled={launchingAppId === app.id || !canInteract}
                          >
                            {launchingAppId === app.id ? "Launching..." : "Launch"}
                          </button>
                        </div>
                      </ContextMenu.Trigger>
                      <ContextMenu.Portal>
                        <ContextMenu.Content className="shell-context-content">
                          <ContextMenu.Item className="shell-context-item" onSelect={() => void onLaunchApp(app.id)}>
                            Launch {app.name}
                          </ContextMenu.Item>
                          <ContextMenu.Item
                            className="shell-context-item"
                            onSelect={() => {
                              void navigator.clipboard?.writeText(app.id);
                              pushToast({ title: "Copied app id", message: app.id });
                            }}
                          >
                            Copy app id
                          </ContextMenu.Item>
                        </ContextMenu.Content>
                      </ContextMenu.Portal>
                    </ContextMenu.Root>
                  );
                })}
            </div>
          </>
        );
      }

      if (id === "files") {
        const renderRecentRow = (file: FileEntry, index: number) => {
          const selected = selectedFilePaths.has(file.path);
          return (
            <ContextMenu.Root key={file.path}>
              <ContextMenu.Trigger asChild>
                <div
                  role="button"
                  tabIndex={0}
                  data-file-row="true"
                  className={`row-item file-row-selectable ${selected ? "selected-file" : ""}`}
                  onMouseDown={(event: ReactMouseEvent) => handleFileRowMouseDown(file, index, event)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedFilePaths(new Set([file.path]));
                    }
                  }}
                >
                  <span>{file.name}</span>
                  <span className="subtle file-row-path">{file.path}</span>
                </div>
              </ContextMenu.Trigger>
              <ContextMenu.Portal>
                <ContextMenu.Content className="shell-context-content">
                  <ContextMenu.Item
                    className="shell-context-item"
                    onSelect={() => {
                      void navigator.clipboard?.writeText(file.path);
                      pushToast({ title: "Copied path", tone: "success" });
                    }}
                  >
                    Copy path
                  </ContextMenu.Item>
                  <ContextMenu.Item className="shell-context-item" onSelect={() => pushToast({ title: file.name, message: file.path })}>
                    Properties (preview)
                  </ContextMenu.Item>
                </ContextMenu.Content>
              </ContextMenu.Portal>
            </ContextMenu.Root>
          );
        };

        return (
          <>
            <div className="module-inline-actions">
              <button onClick={() => void loadFiles()} disabled={filesLoading || !canInteract}>
                {filesLoading ? "Loading..." : "Refresh"}
              </button>
            </div>
            {filesError ? <p className="module-error">{filesError}</p> : null}
            <p className="subtle">Desktop: {desktopCount ?? "--"} | Downloads: {downloadCount ?? "--"}</p>
            <p className="subtle meta-label">Recent {selectedFilePaths.size > 0 ? `(selected ${selectedFilePaths.size})` : ""}</p>
            {recentFiles.length > 48 ? (
              <Virtuoso
                className="files-virtuoso"
                style={{ height: 260 }}
                data={recentFiles}
                itemContent={(index, file) => renderRecentRow(file, index)}
              />
            ) : (
              <div className="stack">{recentFiles.map((file, index) => renderRecentRow(file, index))}</div>
            )}
            <form onSubmit={onSearchFiles} className="inline-form">
              <input
                value={fileSearchTerm}
                onChange={(event) => setFileSearchTerm(event.target.value)}
                placeholder="Search files..."
                aria-label="Search files"
              />
              <button type="submit" disabled={fileSearchBusy || !canInteract}>
                {fileSearchBusy ? "Searching..." : "Search"}
              </button>
            </form>
            {fileSearchResults.length > 0 ? (
              <div className="stack search-results">
                {fileSearchResults.map((file) => (
                  <p key={`${file.path}-${file.name}`} className="row-item">
                    {file.name}
                  </p>
                ))}
              </div>
            ) : null}
          </>
        );
      }

      if (id === "tasks") {
        return <TasksPage />;
      }

      return (
        <>
          {aiError ? <p className="module-error">{aiError}</p> : null}
          <div className="chat-list">
            {aiMessages.slice(-8).map((message, idx) => (
              <p key={`${message.role}-${idx}`} className={message.role === "assistant" ? "chat-assistant" : "chat-user"}>
                <strong>{message.role === "assistant" ? "AI" : "You"}:</strong> {message.content}
              </p>
            ))}
          </div>
          <form onSubmit={onSendAiPrompt} className="inline-form">
            <input
              ref={aiInputRef}
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="Ask AI..."
              aria-label="Ask AI"
            />
            <button type="submit" disabled={aiLoading || !canInteract}>
              {aiLoading ? "Sending..." : "Send"}
            </button>
          </form>
        </>
      );
  };

  return (
    <div className={["shell-root", desktopDragging ? "module-dragging" : ""].filter(Boolean).join(" ")}>
      {!hasSession || !isUnlocked ? (
        <GlassPanel className="auth-shell" as="section">
          <p className="eyebrow">Cortex security</p>
          <h1>CORTEX</h1>
          <p className="shell-subtitle">Secure command shell</p>
          <p className="subtle">Demo login: grey@cortex.local / ChangeMe123! | PIN: 1234</p>
          {!hasSession ? (
            <form onSubmit={onLogin} className="form">
              <label htmlFor="email">Email</label>
              <input id="email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" required />
              <label htmlFor="password">Password</label>
              <input
                id="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                required
              />
              <button type="submit" disabled={!canInteract}>
                {busy === "login" ? "Signing in..." : "Sign in"}
              </button>
            </form>
          ) : (
            <form onSubmit={onUnlock} className="form">
              <p className="lock-copy">Session locked for {email}</p>
              <label htmlFor="pin">PIN</label>
              <input
                id="pin"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4,6}"
                autoComplete="one-time-code"
                required
              />
              <button type="submit" disabled={!canInteract}>
                {busy === "unlock" ? "Unlocking..." : "Unlock session"}
              </button>
            </form>
          )}
          <div className="auth-status">
            {error ? <p className="error">{error}</p> : null}
            {info ? <p className="subtle">{info}</p> : null}
          </div>
        </GlassPanel>
      ) : (
        <Tooltip.Provider delayDuration={260}>
          <ToastViewport />
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} actions={paletteActions} />
          <div className={`desktop-shell ${sidebarCollapsed ? "sidebar-compact" : ""}`}>
            <Group orientation="horizontal" id="cortex-shell-layout" className="shell-panel-group">
              <Panel
                id="shell-sidebar"
                defaultSize={sidebarCollapsed ? 18 : 26}
                minSize={16}
                maxSize={34}
                className="shell-sidebar-panel"
              >
                <aside className={`shell-sidebar ${sidebarCollapsed ? "collapsed" : ""}`} aria-label="Shell navigation">
            <div>
              <p className="eyebrow">Cortex shell</p>
              <div className="sidebar-heading">
                <h2>Control</h2>
                <button
                  type="button"
                  className="sidebar-toggle"
                  onClick={() => setSidebarCollapsed((prev) => !prev)}
                  aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  aria-pressed={sidebarCollapsed}
                >
                  {sidebarCollapsed ? "Expand" : "Compact"}
                </button>
              </div>
            </div>
            <div className="sidebar-meta">
              <StatusChip tone="success">Online</StatusChip>
              <StatusChip tone="neutral">Auto-lock 5m</StatusChip>
            </div>
            <nav className="module-nav">
              {moduleMeta.map((module) => (
                <button
                  key={module.id}
                  type="button"
                  className={`module-nav-item ${activeModule === module.id ? "active" : ""}`}
                  onClick={() => setActiveModule(module.id)}
                  title={sidebarCollapsed ? module.label : undefined}
                >
                  <span>{module.label}</span>
                  <small>{module.detail}</small>
                </button>
              ))}
            </nav>
            <div className="sidebar-footer">
              <p className="subtle">Signed in as {user?.email}</p>
              <div className="actions">
                <button onClick={() => void lockShell()} disabled={!canInteract}>
                  {busy === "lock" ? "Locking..." : "Lock"}
                </button>
                <button onClick={() => void logout()} disabled={!canInteract}>
                  {busy === "logout" ? "Logging out..." : "Logout"}
                </button>
              </div>
            </div>
                </aside>
              </Panel>
              <Separator className="shell-resize-handle" />
              <Panel id="shell-main" defaultSize={74} minSize={58} className="shell-main-panel">
                <main className="shell-canvas">
            <header className="shell-header">
              <div>
                <p className="eyebrow">Workspace</p>
                <h1>Welcome back</h1>
              </div>
              <p className="subtle">Session active with secure idle lock.</p>
            </header>

            <section className="email-rail" aria-label="Gmail">
              <div className="email-rail-heading">
                <BrandIcon icon={siGmail} className="email-rail-icon" />
                <div>
                  <p className="meta-label">Inbox strip</p>
                  <strong>{gmailBusy ? "Syncing Gmail…" : gmailConnected ? "Live inbox" : "Not connected"}</strong>
                </div>
              </div>
              <div className="email-rail-actions">
                {!gmailConfigured ? (
                  <span className="subtle">API missing Google OAuth env</span>
                ) : gmailConnected ? (
                  <>
                    <button type="button" onClick={() => void loadGmailBundle()} disabled={gmailBusy || !canInteract}>
                      Refresh
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() =>
                        api
                          .post("/gmail/disconnect")
                          .then(() => loadGmailBundle())
                          .catch(() => setGmailError("Disconnect failed"))
                      }
                      disabled={!canInteract}
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button type="button" className="primary-btn" onClick={() => void startGmailOAuth()} disabled={!canInteract}>
                    Connect Gmail
                  </button>
                )}
              </div>
              <div className="email-rail-scroll">
                {!gmailConnected || gmailInbox.length === 0 ? (
                  <p className="subtle email-rail-empty">
                    {gmailConnected ? "Inbox empty or still loading." : "Connect Gmail to show messages here."}
                  </p>
                ) : (
                  gmailInbox.map((mail) => (
                    <article key={mail.id} className={`email-chip ${mail.unread ? "unread" : ""}`}>
                      <header>
                        <span className="email-chip-subject" title={mail.subject}>
                          {mail.subject}
                        </span>
                        <span className="email-chip-from" title={mail.from}>
                          {mail.from}
                        </span>
                      </header>
                      <p className="email-chip-snippet">{mail.snippet}</p>
                      <div className="email-chip-actions">
                        <button type="button" onClick={() => void markGmailRead(mail.id)}>
                          Read
                        </button>
                        <button type="button" onClick={() => void archiveGmailMessage(mail.id)}>
                          Archive
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
              {gmailError ? <p className="module-error email-rail-error">{gmailError}</p> : null}
            </section>

            <DashboardModules
              moduleIds={sanitizedModuleOrder}
              onReorder={setModuleOrder}
              activeModule={activeModule}
              onActiveModule={setActiveModule}
              expandedModule={expandedModule}
              onExpandedChange={setExpandedModule}
              onDragActiveChange={setDesktopDragging}
              metaById={metaById}
              onMoveStep={onModuleKeyMove}
              onRefreshModule={refreshWorkspaceModules}
              renderModule={renderModule}
            />

            <form
              onSubmit={onRunCommand}
              className={`command-dock ${commandBusy ? "is-busy" : ""} ${commandResult ? "has-result" : ""} ${
                commandError ? "has-error" : ""
              }`}
            >
              <p className="dock-label">Command dock</p>
              <div className="command-bar">
                <input
                  value={commandInput}
                  onChange={(event) => setCommandInput(event.target.value)}
                  placeholder="Search workspace or run command..."
                  aria-label="Search or run command"
                />
                <button type="submit" disabled={commandBusy || !canInteract}>
                  {commandBusy ? "Running..." : "Execute"}
                </button>
              </div>
              {commandError ? <p className="module-error">{commandError}</p> : null}
              {commandResult ? <p className="subtle">Result: {commandResult}</p> : null}
            </form>
            {error ? <p className="error">{error}</p> : null}
            {info ? <p className="subtle">{info}</p> : null}
                </main>
              </Panel>
            </Group>
          </div>
        </Tooltip.Provider>
      )}
    </div>
  );
}
