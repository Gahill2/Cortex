import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import type { AxiosError } from "axios";
import { LoginPage } from "./pages/LoginPage";
import { SessionPinGate } from "./components/SessionPinGate";
import { Sidebar } from "./components/Sidebar";
import { OAuthBootstrap } from "./components/OAuthBootstrap";
import { PageLoading } from "./components/PageLoading";
import { AppearanceProvider } from "./AppearanceProvider";
import { PreferencesProvider } from "./context/PreferencesContext";
import { useUiCustomization } from "./hooks/useUiCustomization";
import {
  api,
  setAuthToken,
  AUTH_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
  AUTH_LOGOUT_EVENT,
  AUTH_CHANGED_EVENT,
} from "./api/client";
import type { User } from "./types";
import { clearPreferencesCache } from "./context/PreferencesContext";
import { useWallpaper } from "./hooks/useWallpaper";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { TAB_SCREEN_TITLES } from "./navigation";
import type { Tab } from "./tab";
import { CommandPalette, type PaletteAction } from "./components/shell/CommandPalette";
import { AppTopNav } from "./components/shell/AppTopNav";
import { QuickCaptureDialog } from "./components/shell/QuickCaptureDialog";
import { ToastViewport } from "./components/shell/ToastViewport";
import { useDesktopShortcuts } from "./hooks/useDesktopShortcuts";
import { getIdleLockMs, isIdleLockEnabled } from "./lib/idleLock";

export type { Tab } from "./tab";

const HomePage = lazy(() =>
  import("./pages/HomePage").then((m) => ({ default: m.HomePage }))
);
const AIPage = lazy(() => import("./pages/AIPage").then((m) => ({ default: m.AIPage })));
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);
const MailPage = lazy(() =>
  import("./pages/MailPage").then((m) => ({ default: m.MailPage }))
);
const SpotifyPage = lazy(() =>
  import("./pages/SpotifyPage").then((m) => ({ default: m.SpotifyPage }))
);
const NotesPage = lazy(() =>
  import("./pages/NotesPage").then((m) => ({ default: m.NotesPage }))
);
const GoalsPage = lazy(() =>
  import("./pages/GoalsPage").then((m) => ({ default: m.GoalsPage }))
);
const CalendarPage = lazy(() =>
  import("./pages/CalendarPage").then((m) => ({ default: m.CalendarPage }))
);
const TasksPage = lazy(() =>
  import("./pages/TasksPage").then((m) => ({ default: m.TasksPage }))
);
const HomelabPage = lazy(() =>
  import("./pages/HomelabPage").then((m) => ({ default: m.HomelabPage }))
);
const CloudPage = lazy(() =>
  import("./pages/CloudPage").then((m) => ({ default: m.CloudPage }))
);
/** Renderer idle lock — configure with VITE_IDLE_LOCK_MINUTES (0 = off). */

type ElectronWindow = Window & {
  electron?: {
    isElectron?: boolean;
    getVersion?: () => Promise<string>;
    openExternal?: (url: string) => Promise<void>;
  };
};

type OAuthWindow = Window & {
  __handleOAuth?: (
    provider: string,
    params: { code?: string; state?: string; error?: string; connected?: string }
  ) => Promise<void>;
};

function WallpaperSync() {
  useWallpaper(true);
  return null;
}

/** Applies home font, density, accent, and surface tokens from server settings. */
function UiCustomizationSync() {
  useUiCustomization();
  return null;
}

export default function App() {
  const [isElectronEnv] = useState(() =>
    typeof window !== "undefined" && !!(window as ElectronWindow).electron?.isElectron
  );
  const [token, setToken] = useState<string | null>(() =>
    isElectronEnv ? null : localStorage.getItem(AUTH_STORAGE_KEY)
  );
  const [sessionUnlocked, setSessionUnlocked] = useState(false);
  const [sessionProbeDone, setSessionProbeDone] = useState(false);
  const [pinUnlockRequired, setPinUnlockRequired] = useState(true);
  const [pinGateReason, setPinGateReason] = useState<"sign-in" | "idle" | "manual">("sign-in");
  const prevTokenRef = useRef<string | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [navDrawerClosing, setNavDrawerClosing] = useState(false);
  const navDrawerCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobileLayout = useMediaQuery("(max-width: 768px)");
  const [tokenReady, setTokenReady] = useState(() => !isElectronEnv);

  const lockSession = useCallback(async () => {
    try {
      await api.post("/auth/lock", { lockReason: "manual" });
    } catch {
      /* still show gate */
    }
    setPinGateReason("manual");
    setSessionUnlocked(false);
  }, []);

  const paletteActions = useMemo<PaletteAction[]>(
    () => [
      { id: "nav-home", label: "Go to Home", group: "Navigate", keywords: "dashboard home canvas", shortcut: "G H", onSelect: () => setTab("home") },
      { id: "nav-calendar", label: "Go to Calendar", group: "Navigate", keywords: "calendar schedule events", shortcut: "G C", onSelect: () => setTab("calendar") },
      { id: "nav-tasks", label: "Go to Tasks", group: "Navigate", keywords: "tasks todo inbox today", shortcut: "G T", onSelect: () => setTab("tasks") },
      { id: "nav-goals", label: "Go to Tasks & goals", group: "Navigate", keywords: "progress targets", onSelect: () => setTab("tasks") },
      { id: "nav-ai", label: "Go to AI", group: "Navigate", keywords: "chat assistant kimi claude", shortcut: "G A", onSelect: () => setTab("ai") },
      { id: "nav-notes", label: "Go to Notes", group: "Navigate", keywords: "brain obsidian notion vault", onSelect: () => setTab("notes") },
      { id: "nav-mail", label: "Go to Mail", group: "Navigate", keywords: "email gmail outlook inbox", shortcut: "G M", onSelect: () => setTab("mail") },
      { id: "nav-cloud", label: "Go to Cloud", group: "Navigate", keywords: "nextcloud files storage upload", onSelect: () => setTab("cloud") },
      { id: "nav-homelab", label: "Go to Homelab", group: "Navigate", keywords: "server docker grafana monitoring deploy", onSelect: () => setTab("homelab") },
      { id: "nav-spotify", label: "Go to Spotify", group: "Navigate", keywords: "music ai dj playlist", onSelect: () => setTab("spotify") },
      { id: "nav-settings", label: "Go to Settings", group: "Navigate", keywords: "preferences integrations security", shortcut: "G S", onSelect: () => setTab("settings") },
      { id: "brain-capture", label: "Quick capture", group: "Actions", keywords: "obsidian note inbox daily capture", shortcut: "⌃⇧N", onSelect: () => setCaptureOpen(true) },
      { id: "palette-self", label: "Command palette", group: "Actions", keywords: "search commands", shortcut: "⌃K", onSelect: () => setPaletteOpen(true) },
      { id: "session-lock", label: "Lock session", group: "Session", keywords: "pin security logout", shortcut: "⌃L", onSelect: () => { void lockSession(); } },
    ],
    [lockSession]
  );

  useDesktopShortcuts({
    enabled: Boolean(token && sessionUnlocked && sessionProbeDone),
    paletteOpen,
    expandedModuleOpen: false,
    onOpenPalette: () => setPaletteOpen(true),
    onClosePalette: () => setPaletteOpen(false),
    onCloseExpanded: () => {},
    onLock: lockSession,
    onQuickCapture: () => setCaptureOpen(true),
  });

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (token) root.classList.add("cortex-notion");
    else root.classList.remove("cortex-notion");
    return () => {
      root.classList.remove("cortex-notion");
    };
  }, [token]);

  useEffect(() => {
    const onLogout = () => setToken(null);
    window.addEventListener(AUTH_LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onLogout);
  }, []);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  useEffect(() => {
    if (!token) {
      prevTokenRef.current = null;
      setSessionUnlocked(false);
      setPinUnlockRequired(true);
      setSessionProbeDone(true);
      return;
    }

    const isNewToken = prevTokenRef.current !== token;
    prevTokenRef.current = token;
    if (isNewToken) {
      setPinGateReason("sign-in");
    }

    setSessionProbeDone(false);
    let cancelled = false;
    void (async () => {
      try {
        const session = await api.get<{ user?: User; pinUnlock?: boolean }>("/auth/session");
        const needsPin = session.data.pinUnlock === true;
        if (!cancelled) setPinUnlockRequired(needsPin);
        if (session.data.user) {
          try {
            localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(session.data.user));
          } catch {
            /* ignore */
          }
        }
        if (!cancelled) setSessionUnlocked(true);
      } catch (err) {
        if (cancelled) return;
        const ax = err as AxiosError<{ error?: { message?: string } }>;
        const status = ax.response?.status;
        if (status === 423) {
          setPinUnlockRequired(true);
          setSessionUnlocked(false);
          return;
        }
        if (status === 401) {
          setAuthToken(null);
          setToken(null);
          try {
            localStorage.removeItem(AUTH_STORAGE_KEY);
          } catch {
            /* ignore */
          }
        }
      } finally {
        if (!cancelled) setSessionProbeDone(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !sessionUnlocked || !pinUnlockRequired || !isIdleLockEnabled()) return;
    const idleMs = getIdleLockMs();
    let timeoutId: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        void api
          .post("/auth/lock", { lockReason: "idle" })
          .catch(() => {})
          .finally(() => {
            setPinGateReason("idle");
            setSessionUnlocked(false);
          });
      }, idleMs);
    };
    schedule();
    const onActivity = () => {
      schedule();
    };
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("pointerdown", onActivity, opts);
    window.addEventListener("pointermove", onActivity, opts);
    window.addEventListener("keydown", onActivity, opts);
    window.addEventListener("touchstart", onActivity, opts);
    window.addEventListener("wheel", onActivity, opts);
    window.addEventListener("scroll", onActivity, opts);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("pointermove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("wheel", onActivity);
      window.removeEventListener("scroll", onActivity);
    };
  }, [token, sessionUnlocked, pinUnlockRequired]);

  useEffect(() => {
    if (!isElectronEnv) return;
    api
      .get<{ token: string }>("/auth/desktop-token")
      .then((r) => {
        setAuthToken(r.data.token);
        setToken(r.data.token);
      })
      .catch(() => {
        /* fall through to login page */
      })
      .finally(() => setTokenReady(true));
  }, [isElectronEnv]);

  useEffect(() => {
    if (!isElectronEnv) return;
    (window as OAuthWindow).__handleOAuth = async (
      provider: string,
      params: { code?: string; state?: string; error?: string; connected?: string }
    ) => {
      if (params.error) {
        console.error("[oauth] provider error:", params.error);
        return;
      }
      try {
        if (params.connected) {
          /* Server-side exchange already done */
        } else if (!params.code || !params.state) {
          console.error("[oauth] missing code/state", params);
          return;
        } else if (provider === "spotify") {
          await api.post("/spotify/oauth/exchange", { code: params.code, state: params.state });
        } else if (provider === "notion") {
          await api.post("/notion/oauth/exchange", { code: params.code, state: params.state });
        } else if (provider === "google") {
          await api.post("/gmail/oauth/exchange", { code: params.code, state: params.state });
        }
        window.dispatchEvent(new CustomEvent("oauth-connected", { detail: { provider } }));
        if (provider === "mail" || provider === "microsoft") {
          setTab("mail");
        } else if (provider === "notion") {
          setTab("notes");
        } else {
          setTab("settings");
        }
      } catch (e) {
        console.error("[oauth] exchange failed:", e);
      }
    };
    return () => {
      delete (window as OAuthWindow).__handleOAuth;
    };
  }, [isElectronEnv, token]);

  useEffect(() => {
    if (!isMobileLayout) setNavDrawerOpen(false);
  }, [isMobileLayout]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("mail_connected") || params.has("microsoft_connected")) {
      window.history.replaceState({}, "", window.location.pathname);
      const providerParam = params.get("provider");
      const provider =
        providerParam === "microsoft" || params.has("microsoft_connected")
          ? "microsoft"
          : "mail";
      window.dispatchEvent(new CustomEvent("oauth-connected", { detail: { provider } }));
      setTab("mail");
    } else if (params.has("spotify_connected") || params.has("gmail_connected")) {
      sessionStorage.removeItem("cortex_oauth_auto_spotify");
      sessionStorage.removeItem("cortex_oauth_auto_gmail");
      window.history.replaceState({}, "", window.location.pathname);
      if (params.has("gmail_connected")) {
        window.dispatchEvent(new CustomEvent("oauth-connected", { detail: { provider: "gmail" } }));
        setTab("mail");
      } else {
        window.dispatchEvent(new CustomEvent("oauth-connected", { detail: { provider: "spotify" } }));
        sessionStorage.setItem("cortex_settings_section", "integrations");
        setTab("settings");
      }
    } else if (params.has("notion_connected")) {
      window.history.replaceState({}, "", window.location.pathname);
      window.dispatchEvent(new CustomEvent("oauth-connected", { detail: { provider: "notion" } }));
      setTab("notes");
    } else if (
      params.has("spotify_error") ||
      params.has("gmail_error") ||
      params.has("mail_error") ||
      params.has("microsoft_error")
    ) {
      const errKey = params.has("spotify_error")
        ? "spotify_error"
        : params.has("gmail_error")
          ? "gmail_error"
          : params.has("microsoft_error")
            ? "microsoft_error"
            : "mail_error";
      const errMsg = params.get(errKey) ?? "oauth_failed";
      window.history.replaceState({}, "", window.location.pathname);
      const mailOAuthErr = errKey === "mail_error" || errKey === "microsoft_error";
      if (mailOAuthErr) {
        sessionStorage.setItem("cortex_oauth_error", decodeURIComponent(errMsg));
        setTab("mail");
      } else {
        sessionStorage.setItem("cortex_settings_section", "integrations");
        sessionStorage.setItem("cortex_oauth_error", decodeURIComponent(errMsg));
        setTab("settings");
      }
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    const refreshIntegrations = () => {
      if (document.visibilityState !== "visible") return;
      window.dispatchEvent(new CustomEvent("oauth-connected", { detail: { provider: "refresh" } }));
    };
    window.addEventListener("focus", refreshIntegrations);
    document.addEventListener("visibilitychange", refreshIntegrations);
    return () => {
      window.removeEventListener("focus", refreshIntegrations);
      document.removeEventListener("visibilitychange", refreshIntegrations);
    };
  }, [token]);

  useEffect(() => {
    return () => {
      if (navDrawerCloseTimerRef.current) clearTimeout(navDrawerCloseTimerRef.current);
    };
  }, []);

  if (!tokenReady) {
    return <div style={{ background: "#0e0e10", height: "100vh" }} />;
  }

  if (!token) {
    return (
      <LoginPage
        onLogin={(next, user) => {
          clearPreferencesCache();
          setAuthToken(next);
          setToken(next);
          if (user) {
            try {
              localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
            } catch {
              /* ignore */
            }
          }
          window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
        }}
      />
    );
  }

  if (token && !sessionProbeDone) {
    return <div style={{ background: "#0e0e10", height: "100vh" }} aria-busy="true" />;
  }

  if (!sessionUnlocked && pinUnlockRequired) {
    return (
      <SessionPinGate
        reason={pinGateReason}
        onUnlocked={() => setSessionUnlocked(true)}
        onSessionExpired={() => {
          setAuthToken(null);
          setToken(null);
        }}
      />
    );
  }

  if (!sessionUnlocked) {
    return <div style={{ background: "#0e0e10", height: "100vh" }} aria-busy="true" />;
  }

  const closeNavDrawer = () => {
    if (!navDrawerOpen || navDrawerClosing) return;
    setNavDrawerClosing(true);
    if (navDrawerCloseTimerRef.current) clearTimeout(navDrawerCloseTimerRef.current);
    navDrawerCloseTimerRef.current = setTimeout(() => {
      setNavDrawerOpen(false);
      setNavDrawerClosing(false);
      navDrawerCloseTimerRef.current = null;
    }, 320);
  };

  const openNavDrawer = () => {
    if (navDrawerCloseTimerRef.current) {
      clearTimeout(navDrawerCloseTimerRef.current);
      navDrawerCloseTimerRef.current = null;
    }
    setNavDrawerClosing(false);
    setNavDrawerOpen(true);
  };

  const goTab = (next: Tab) => {
    setTab(next);
    closeNavDrawer();
  };

  return (
    <PreferencesProvider>
      <AppearanceProvider>
      <WallpaperSync />
      <UiCustomizationSync />
      <OAuthBootstrap enabled />
      <div
        className={`desktop-shell flex-grow-1 min-vh-0${
          isMobileLayout ? " desktop-shell--burger desktop-shell--mobile" : " desktop-shell--topnav"
        }${import.meta.env.DEV ? " desktop-shell--dev" : ""}`}
        title={import.meta.env.DEV ? "Vite dev server (hot reload)" : undefined}
      >
        {!isMobileLayout ? (
          <AppTopNav active={tab} onChange={goTab} onOpenPalette={() => setPaletteOpen(true)} />
        ) : (
          <header className="burger-appbar">
            <button
              type="button"
              className="burger-appbar__btn"
              onClick={openNavDrawer}
              aria-label="Open menu"
            >
              <span className="burger-appbar__icon" aria-hidden>
                <span className="burger-appbar__line" />
                <span className="burger-appbar__line" />
                <span className="burger-appbar__line" />
              </span>
            </button>
            <span className="burger-appbar__title">{TAB_SCREEN_TITLES[tab]}</span>
          </header>
        )}

        {(navDrawerOpen || navDrawerClosing) &&
          createPortal(
            <div
              className={`burger-drawer-root${navDrawerClosing ? " burger-drawer-root--closing" : ""}`}
              role="presentation"
            >
              <button
                type="button"
                className="burger-drawer-backdrop"
                onClick={closeNavDrawer}
                aria-label="Close menu"
              />
              <Sidebar active={tab} onChange={goTab} mobileOpen onClose={closeNavDrawer} />
            </div>,
            document.body,
          )}

        <main className="desktop-main d-flex flex-column flex-grow-1 min-vh-0">
          <div
            className={`container-fluid flex-grow-1 d-flex flex-column min-vh-0 cortex-route-bootstrap cortex-animate-in${
              tab === "home"
                ? " cortex-route-bootstrap--home-full"
                : tab === "calendar" || tab === "tasks"
                  ? " cortex-route-bootstrap--planner-full"
                  : tab === "goals"
                    ? " cortex-route-bootstrap--goals-full"
                    : " cortex-route-bootstrap--padded"
            }`}
          >
            {tab === "calendar" || tab === "tasks" ? (
              <Suspense fallback={<PageLoading />}>
                {tab === "calendar" && <CalendarPage onNavigate={goTab} />}
                {tab === "tasks" && <TasksPage onNavigate={goTab} />}
              </Suspense>
            ) : (
              <Suspense fallback={<PageLoading />}>
                {tab === "home" && (
                  <HomePage onNavigate={goTab} onCommand={() => setPaletteOpen(true)} />
                )}
                {tab === "goals" && <TasksPage onNavigate={goTab} />}
                {tab === "ai" && <AIPage onNavigate={setTab} activeTab={tab} />}
                {tab === "notes" && <NotesPage />}
                {tab === "settings" && (
                  <SettingsPage
                    onLogout={() => {
                      setAuthToken(null);
                      setToken(null);
                      setTab("home");
                    }}
                    onLockSession={lockSession}
                  />
                )}
                {tab === "mail" && <MailPage />}
                {tab === "cloud" && <CloudPage />}
                {tab === "homelab" && <HomelabPage />}
                {tab === "spotify" && <SpotifyPage />}
              </Suspense>
            )}
          </div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} actions={paletteActions} />
      <QuickCaptureDialog open={captureOpen} onOpenChange={setCaptureOpen} />
      <ToastViewport />
      </AppearanceProvider>
    </PreferencesProvider>
  );
}
