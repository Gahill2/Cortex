import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { TasksPage } from "./pages/TasksPage";
import { AIPage } from "./pages/AIPage";
import { SettingsPage } from "./pages/SettingsPage";
import { GmailPage } from "./pages/GmailPage";
import { Sidebar } from "./components/Sidebar";
import { setAuthToken } from "./api/client";
const TOKEN_KEY = "cortex_token";
export default function App() {
    const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
    const [tab, setTab] = useState("home");
    useEffect(() => {
        setAuthToken(token);
        if (token) {
            localStorage.setItem(TOKEN_KEY, token);
        }
        else {
            localStorage.removeItem(TOKEN_KEY);
        }
    }, [token]);
    if (!token) {
        return _jsx(LoginPage, { onLogin: setToken });
    }
    return (_jsxs("div", { className: "desktop-shell", children: [_jsx(Sidebar, { active: tab, onChange: setTab }), _jsxs("main", { className: "desktop-main", children: [tab === "home" && _jsx(HomePage, { onNavigate: setTab }), tab === "tasks" && _jsx(TasksPage, {}), tab === "ai" && _jsx(AIPage, {}), tab === "settings" && _jsx(SettingsPage, { onLogout: () => { setToken(null); setTab("home"); } }), tab === "gmail" && _jsx(GmailPage, {})] })] }));
}
