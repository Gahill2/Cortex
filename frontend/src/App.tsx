import { useEffect, useLayoutEffect, useRef, useState, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import type { AxiosError } from "axios";
import { LoginPage } from "./pages/LoginPage";
import { SessionPinGate } from "./components/SessionPinGate";
import { Sidebar } from "./components/Sidebar";
import { MobileAppBar } from "./components/MobileAppBar";
import { MobileNavDrawer } from "./components/MobileNavDrawer";
import { MobileTabBar } from "./components/MobileTabBar";
import { OAuthBootstrap } from "./components/OAuthBootstrap";
import { PageLoading } from "./components/PageLoading";
import { AppearanceProvider } from "./AppearanceProvider";
import { PreferencesProvider } from "./context/PreferencesContext";
import { api, setAuthToken, AUTH_STORAGE_KEY, AUTH_LOGOUT_EVENT } from "./api/client";
import { useWallpaper } from "./hooks/useWallpaper";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { TAB_SCREEN_TITLES } from "./navigation";

const HomePage = lazy(() =>
  import("./pages/HomePage").then((m) => ({ default: m.HomePage }))
);
const TasksPage = lazy(() =>
  import("./pages/TasksPage").then((m) => ({ default: m.TasksPage }))
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
const CalendarPage = lazy(() =>
  import("./pages/CalendarPage").then((m) => ({ default: m.CalendarPage }))
);
const NotesPage = lazy(() =>
  import("./pages/NotesPage").then((m) => ({ default: m.NotesPage }))
);
export type Tab =
  | "home"
  | "tasks"
  | "ai"
  | "notes"
  | "settings"
  | "spotify"
  | "mail"
  | "calendar";

/** Renderer idle lock — must match server expectations for `/auth/lock` */
const IDLE_LOCK_MS = 15 * 60 * 1000;

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

export default function App() {
  const [isElectronEnv] = useState(() =>
    typeof window !== "undefined" && !!(window as ElectronWindow).electron?.isElectron
  );
  const [token, setToken] = useState<string | null>(() =>
    isElectronEnv ? null : localStorage.getItem(AUTH_STORAGE_KEY)
  );
  const [sessionUnlocked, setSessionUnlocked] = useState(false);
  const [sessionProbeDone, setSessionProbeDone] = useState(false);
  const [pinGateReason, setPinGateReason] = useState<"sign-in" | "idle" | "manual">("sign-in");
  const prevTokenRef = useRef<string | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [navDrawerClosing, setNavDrawerClosing] = useState(false);
  const navDrawerCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobileLayout = useMediaQuery("(max-width: 768px)");
  const [tokenReady, setTokenReady] = useState(() => !isElectronEnv);

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
        await api.get("/auth/session");
        if (!cancelled) setSessionUnlocked(true);
      } catch (err) {
        if (cancelled) return;
        const ax = err as AxiosError<{ error?: { message?: string } }>;
        const status = ax.response?.status;
        if (status === 423) {
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
    if (!token || !sessionUnlocked) return;
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
      }, IDLE_LOCK_MS);
    };
    schedule();
    const onActivity = () => {
      schedule();
    };
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("pointerdown", onActivity, opts);
    window.addEventListener("keydown", onActivity, opts);
    window.addEventListener("touchstart", onActivity, opts);
    window.addEventListener("wheel", onActivity, opts);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("wheel", onActivity);
    };
  }, [token, sessionUnlocked]);

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
        onLogin={(next) => {
          setAuthToken(next);
          setToken(next);
        }}
      />
    );
  }

  if (token && !sessionProbeDone) {
    return <div style={{ background: "#0e0e10", height: "100vh" }} aria-busy="true" />;
  }

  if (!sessionUnlocked) {
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
      <OAuthBootstrap enabled />
      <div
        className={`desktop-shell desktop-shell--burger flex-grow-1 min-vh-0${isMobileLayout ? " desktop-shell--mobile" : ""}${
          import.meta.env.DEV ? " desktop-shell--dev" : ""
        }`}
        title={import.meta.env.DEV ? "Vite dev server (hot reload)" : undefined}
      >
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
          <div className="container-fluid flex-grow-1 d-flex flex-column min-vh-0 px-3 px-sm-4 px-lg-4 px-xxl-5 pt-3 pt-lg-4 pb-4 pb-xxl-5 cortex-route-bootstrap cortex-animate-in">
            <Suspense fallback={<PageLoading />}>
              {tab === "home" && <HomePage onNavigate={goTab} />}
              {tab === "tasks" && <TasksPage />}
              {tab === "ai" && <AIPage />}
              {tab === "notes" && <NotesPage />}
              {tab === "settings" && (
                <SettingsPage
                  onLogout={() => {
                    setAuthToken(null);
                    setToken(null);
                    setTab("home");
                  }}
                  onLockSession={async () => {
                    try {
                      await api.post("/auth/lock", { lockReason: "manual" });
                    } catch {
                      /* still show gate */
                    }
                    setPinGateReason("manual");
                    setSessionUnlocked(false);
                  }}
                />
              )}
              {tab === "mail" && <MailPage />}
              {tab === "spotify" && <SpotifyPage />}
              {tab === "calendar" && <CalendarPage />}
            </Suspense>
          </div>
        </main>
        {isMobileLayout && <MobileTabBar active={tab} onChange={goTab} />}
      </div>
      </AppearanceProvider>
    </PreferencesProvider>
  );
}
