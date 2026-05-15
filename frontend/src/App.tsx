import { useEffect, useState } from "react";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { TasksPage } from "./pages/TasksPage";
import { AIPage } from "./pages/AIPage";
import { SettingsPage } from "./pages/SettingsPage";
import { MailPage } from "./pages/MailPage";
import { MemoryPage } from "./pages/MemoryPage";
import { Sidebar } from "./components/Sidebar";
import { MobileTopBar } from "./components/MobileTopBar";
import { OAuthBootstrap } from "./components/OAuthBootstrap";
import { api, setAuthToken, AUTH_STORAGE_KEY, AUTH_LOGOUT_EVENT } from "./api/client";
import cortexLogo from "./assets/cortex-logo.png";

export type Tab = "home" | "tasks" | "ai" | "memory" | "settings" | "mail";

type CortexElectron = {
  isElectron?: boolean;
  requestDesktopAuth?: () => Promise<string>;
};

function getElectron(): CortexElectron | undefined {
  return (window as { electron?: CortexElectron }).electron;
}

function isElectronApp(): boolean {
  return !!getElectron()?.isElectron;
}

async function obtainDesktopToken(): Promise<string> {
  const desktopAuth = getElectron()?.requestDesktopAuth;
  if (desktopAuth) return desktopAuth();
  const r = await api.get<{ token: string }>("/auth/desktop-token");
  return r.data.token;
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [tab, setTab] = useState<Tab>("home");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const onLogout = () => setToken(null);
    window.addEventListener(AUTH_LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onLogout);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);

        if (stored) {
          setAuthToken(stored);
          if (cancelled) return;
          setToken(stored);
          try {
            await api.get("/auth/session");
            return;
          } catch {
            setAuthToken(null);
            setToken(null);
          }
        }

        if (isElectronApp()) {
          const t = await obtainDesktopToken();
          if (cancelled) return;
          setAuthToken(t);
          setToken(t);
        }
      } catch {
        if (!cancelled) {
          setAuthToken(null);
          setToken(null);
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const onLogin = (t: string) => {
    setAuthToken(t);
    setToken(t);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("spotify_connected")) {
      sessionStorage.removeItem("cortex_oauth_auto_spotify");
      window.history.replaceState({}, "", window.location.pathname);
      setTab("settings");
    }
    if (params.has("mail_connected") || params.has("gmail_connected")) {
      sessionStorage.removeItem("cortex_oauth_auto_gmail");
      window.history.replaceState({}, "", window.location.pathname);
      setTab("mail");
    }
  }, []);

  if (bootstrapping) {
    return (
      <div className="auth-bootstrap">
        <img src={cortexLogo} alt="Cortex" className="cortex-logo-img auth-bootstrap-logo" />
        <p>Starting Cortex…</p>
      </div>
    );
  }

  if (!token) {
    return <LoginPage onLogin={onLogin} />;
  }

  const goTab = (next: Tab) => {
    setTab(next);
    setMobileNavOpen(false);
  };

  return (
    <>
      <OAuthBootstrap enabled />
      <div className="desktop-shell">
      {mobileNavOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <Sidebar
        active={tab}
        onChange={goTab}
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
      <div className="desktop-content">
        <MobileTopBar active={tab} onMenuOpen={() => setMobileNavOpen(true)} />
        <main className="desktop-main">
          {tab === "home"     && <HomePage onNavigate={goTab} />}
          {tab === "tasks"    && <TasksPage />}
          {tab === "ai"       && <AIPage />}
          {tab === "settings" && (
            <SettingsPage
              onLogout={() => {
                setAuthToken(null);
                setToken(null);
                setTab("home");
              }}
            />
          )}
          {tab === "memory"   && <MemoryPage />}
          {tab === "mail"     && <MailPage />}
        </main>
      </div>
    </div>
    </>
  );
}
