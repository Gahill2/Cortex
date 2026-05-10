import { useEffect, useState } from "react";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { TasksPage } from "./pages/TasksPage";
import { AIPage } from "./pages/AIPage";
import { SettingsPage } from "./pages/SettingsPage";
import { GmailPage } from "./pages/GmailPage";
import { Sidebar } from "./components/Sidebar";
import { setAuthToken } from "./api/client";

export type Tab = "home" | "tasks" | "ai" | "settings" | "gmail";
const TOKEN_KEY = "cortex_token";

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [tab, setTab] = useState<Tab>("home");

  useEffect(() => {
    setAuthToken(token);
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("spotify_connected")) {
      window.history.replaceState({}, "", window.location.pathname);
      setTab("settings");
    }
  }, []);

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
