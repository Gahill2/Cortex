import { useEffect, useLayoutEffect, useRef, useState, lazy, Suspense } from "react";
import { LoginPage } from "./pages/LoginPage";
import { SessionPinGate } from "./components/SessionPinGate";
import { Sidebar } from "./components/Sidebar";
import { MobileAppBar } from "./components/MobileAppBar";
import { MobileNavDrawer } from "./components/MobileNavDrawer";
import { PageLoading } from "./components/PageLoading";
import { api, setAuthToken } from "./api/client";
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
const McpLinkPage = lazy(() =>
  import("./pages/McpLinkPage").then((m) => ({ default: m.McpLinkPage }))
);

export type Tab = "home" | "tasks" | "ai" | "notes" | "settings" | "spotify" | "mail" | "calendar" | "link";
const TOKEN_KEY = "cortex_token";

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

export default function App() {
  const [isElectronEnv] = useState(() =>
    typeof window !== "undefined" && !!(window as ElectronWindow).electron?.isElectron
  );
  const [token, setToken] = useState<string | null>(() =>
    isElectronEnv ? null : localStorage.getItem(TOKEN_KEY)
  );
  const [sessionUnlocked, setSessionUnlocked] = useState(false);
  const [pinGateReason, setPinGateReason] = useState<"sign-in" | "idle" | "manual">("sign-in");
  const prevTokenRef = useRef<string | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const isMobileLayout = useMediaQuery("(max-width: 768px)");
  // In Electron we always fetch a fresh token before rendering — prevents stale
  // localStorage tokens causing 401s before the new token arrives.
  const [tokenReady, setTokenReady] = useState(() => !isElectronEnv);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (token) root.classList.add("cortex-notion");
    else root.classList.remove("cortex-notion");
    return () => {
      root.classList.remove("cortex-notion");
    };
  }, [token]);

  useWallpaper(!!token); // applies saved wallpaper on mount (skipped when logged-in Notion shell)

  useEffect(() => {
    setAuthToken(token);
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);

  useEffect(() => {
    if (token && prevTokenRef.current !== token) {
      prevTokenRef.current = token;
      setPinGateReason("sign-in");
      setSessionUnlocked(false);
    }
    if (!token) {
      prevTokenRef.current = null;
      setSessionUnlocked(false);
    }
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

  // Auto-login when running inside Electron (always refresh on startup)
  useEffect(() => {
    if (!isElectronEnv) return;
    api.get<{ token: string }>("/auth/desktop-token")
      .then((r) => { setAuthToken(r.data.token); setToken(r.data.token); })
      .catch(() => { /* fall through to login page */ })
      .finally(() => setTokenReady(true));
  }, []);

  // Wire up deep-link OAuth handler (called by Electron main process)
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
          // Server-side exchange already done (Gmail/mail flow) — just notify UI
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
    return () => { delete (window as OAuthWindow).__handleOAuth; };
  }, [token]);

  useEffect(() => {
    if (!isMobileLayout) setNavDrawerOpen(false);
  }, [isMobileLayout]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("mail_connected")) {
      window.history.replaceState({}, "", window.location.pathname);
      setTab("mail");
    } else if (params.has("spotify_connected") || params.has("gmail_connected")) {
      window.history.replaceState({}, "", window.location.pathname);
      setTab("settings");
    } else if (params.has("notion_connected")) {
      window.history.replaceState({}, "", window.location.pathname);
      setTab("notes");
    }
  }, []);

  if (!tokenReady) {
    return <div style={{ background: "#0e0e10", height: "100vh" }} />;
  }

  if (!token) {
    return <LoginPage onLogin={setToken} />;
  }

  if (!sessionUnlocked) {
    return <SessionPinGate reason={pinGateReason} onUnlocked={() => setSessionUnlocked(true)} />;
  }

  return (
    <div
      className={`desktop-shell flex-grow-1 min-vh-0${isMobileLayout ? " desktop-shell--mobile" : ""}${
        import.meta.env.DEV ? " desktop-shell--dev" : ""
      }`}
      title={import.meta.env.DEV ? "Vite dev server (hot reload)" : undefined}
    >
      {!isMobileLayout && <Sidebar active={tab} onChange={setTab} />}
      {isMobileLayout && (
        <MobileAppBar
          title={TAB_SCREEN_TITLES[tab]}
          onOpenMenu={() => setNavDrawerOpen(true)}
        />
      )}
      {isMobileLayout && (
        <MobileNavDrawer
          open={navDrawerOpen}
          onClose={() => setNavDrawerOpen(false)}
          active={tab}
          onSelect={(t) => {
            setTab(t);
            setNavDrawerOpen(false);
          }}
        />
      )}
      <main className="desktop-main d-flex flex-column flex-grow-1 min-vh-0">
        <div
          className={
            isMobileLayout
              ? "d-flex flex-column flex-grow-1 min-vh-0"
              : "container-fluid flex-grow-1 d-flex flex-column min-vh-0 px-3 px-sm-4 px-lg-4 px-xxl-5 pt-3 pt-lg-4 pb-4 pb-xxl-5 cortex-route-bootstrap"
          }
        >
          <Suspense fallback={<PageLoading />}>
            {tab === "home"     && <HomePage onNavigate={setTab} />}
            {tab === "tasks"    && <TasksPage />}
            {tab === "ai"       && <AIPage />}
            {tab === "notes"    && <NotesPage />}
            {tab === "settings" && (
              <SettingsPage
                onLogout={() => {
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
            {tab === "mail"     && <MailPage />}
            {tab === "spotify"  && <SpotifyPage />}
            {tab === "calendar" && <CalendarPage />}
            {tab === "link"     && <McpLinkPage />}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
