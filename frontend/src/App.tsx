import { useEffect, useState } from "react";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { TasksPage } from "./pages/TasksPage";
import { AIPage } from "./pages/AIPage";
import { SettingsPage } from "./pages/SettingsPage";
import { GmailPage } from "./pages/GmailPage";
import { Sidebar } from "./components/Sidebar";
import { api, setAuthToken } from "./api/client";

export type Tab = "home" | "tasks" | "ai" | "settings" | "gmail";
const TOKEN_KEY = "cortex_token";

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
  const [tab, setTab] = useState<Tab>("home");
  // In Electron we always fetch a fresh token before rendering — prevents stale
  // localStorage tokens causing 401s before the new token arrives.
  const [tokenReady, setTokenReady] = useState(() => !isElectronEnv);

  useEffect(() => {
    setAuthToken(token);
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);

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
          // Server-side exchange already done (Gmail flow) — just notify UI
        } else if (!params.code || !params.state) {
          console.error("[oauth] missing code/state", params);
          return;
        } else if (provider === "spotify") {
          await api.post("/spotify/oauth/exchange", { code: params.code, state: params.state });
        } else if (provider === "google") {
          await api.post("/gmail/oauth/exchange", { code: params.code, state: params.state });
        }
        window.dispatchEvent(new CustomEvent("oauth-connected", { detail: { provider } }));
        setTab("settings");
      } catch (e) {
        console.error("[oauth] exchange failed:", e);
      }
    };
    return () => { delete (window as OAuthWindow).__handleOAuth; };
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("spotify_connected") || params.has("gmail_connected")) {
      window.history.replaceState({}, "", window.location.pathname);
      setTab("settings");
    }
  }, []);

  if (!tokenReady) {
    return <div style={{ background: "#0e0e10", height: "100vh" }} />;
  }

  if (!token) {
    return <LoginPage onLogin={setToken} />;
  }

  return (
    <div className="desktop-shell">
      <Sidebar active={tab} onChange={setTab} />
      <main className="desktop-main">
        {tab === "home"     && <HomePage onNavigate={setTab} />}
        {tab === "tasks"    && <TasksPage />}
        {tab === "ai"       && <AIPage />}
        {tab === "settings" && <SettingsPage onLogout={() => { setToken(null); setTab("home"); }} />}
        {tab === "gmail"    && <GmailPage />}
      </main>
    </div>
  );
}
