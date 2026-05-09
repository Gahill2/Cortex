import { useEffect, useState } from "react";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { TasksPage } from "./pages/TasksPage";
import { AIPage } from "./pages/AIPage";
import { SettingsPage } from "./pages/SettingsPage";
import { BottomNav } from "./components/BottomNav";
import { setAuthToken } from "./api/client";

export type Tab = "home" | "tasks" | "ai" | "settings";
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

  if (!token) {
    return <LoginPage onLogin={setToken} />;
  }

  return (
    <div className="app-shell">
      <main className="app-main">
        {tab === "home" && <HomePage />}
        {tab === "tasks" && <TasksPage />}
        {tab === "ai" && <AIPage />}
        {tab === "settings" && <SettingsPage onLogout={() => { setToken(null); setTab("home"); }} />}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
