import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { TasksPage } from "./pages/TasksPage";
import { AIPage } from "./pages/AIPage";
import { SettingsPage } from "./pages/SettingsPage";
import { BottomNav } from "./components/BottomNav";
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
    return (_jsxs("div", { className: "app-shell", children: [_jsxs("main", { className: "app-main", children: [tab === "home" && _jsx(HomePage, {}), tab === "tasks" && _jsx(TasksPage, {}), tab === "ai" && _jsx(AIPage, {}), tab === "settings" && _jsx(SettingsPage, { onLogout: () => { setToken(null); setTab("home"); } })] }), _jsx(BottomNav, { active: tab, onChange: setTab })] }));
}
