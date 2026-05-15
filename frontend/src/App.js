import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
function getElectron() {
    return window.electron;
}
function isElectronApp() {
    return !!getElectron()?.isElectron;
}
async function obtainDesktopToken() {
    const desktopAuth = getElectron()?.requestDesktopAuth;
    if (desktopAuth)
        return desktopAuth();
    const r = await api.get("/auth/desktop-token");
    return r.data.token;
}
export default function App() {
    const [token, setToken] = useState(null);
    const [bootstrapping, setBootstrapping] = useState(true);
    const [tab, setTab] = useState("home");
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
                    if (cancelled)
                        return;
                    setToken(stored);
                    try {
                        await api.get("/auth/session");
                        return;
                    }
                    catch {
                        setAuthToken(null);
                        setToken(null);
                    }
                }
                if (isElectronApp()) {
                    const t = await obtainDesktopToken();
                    if (cancelled)
                        return;
                    setAuthToken(t);
                    setToken(t);
                }
            }
            catch {
                if (!cancelled) {
                    setAuthToken(null);
                    setToken(null);
                }
            }
            finally {
                if (!cancelled)
                    setBootstrapping(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);
    useEffect(() => {
        setAuthToken(token);
    }, [token]);
    const onLogin = (t) => {
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
        return (_jsxs("div", { className: "auth-bootstrap", children: [_jsx("img", { src: cortexLogo, alt: "Cortex", className: "cortex-logo-img auth-bootstrap-logo" }), _jsx("p", { children: "Starting Cortex\u2026" })] }));
    }
    if (!token) {
        return _jsx(LoginPage, { onLogin: onLogin });
    }
    const goTab = (next) => {
        setTab(next);
        setMobileNavOpen(false);
    };
    return (_jsxs(_Fragment, { children: [_jsx(OAuthBootstrap, { enabled: true }), _jsxs("div", { className: "desktop-shell", children: [mobileNavOpen && (_jsx("button", { type: "button", className: "sidebar-backdrop", "aria-label": "Close menu", onClick: () => setMobileNavOpen(false) })), _jsx(Sidebar, { active: tab, onChange: goTab, mobileOpen: mobileNavOpen, onClose: () => setMobileNavOpen(false) }), _jsxs("div", { className: "desktop-content", children: [_jsx(MobileTopBar, { active: tab, onMenuOpen: () => setMobileNavOpen(true) }), _jsxs("main", { className: "desktop-main", children: [tab === "home" && _jsx(HomePage, { onNavigate: goTab }), tab === "tasks" && _jsx(TasksPage, {}), tab === "ai" && _jsx(AIPage, {}), tab === "settings" && (_jsx(SettingsPage, { onLogout: () => {
                                            setAuthToken(null);
                                            setToken(null);
                                            setTab("home");
                                        } })), tab === "memory" && _jsx(MemoryPage, {}), tab === "mail" && _jsx(MailPage, {})] })] })] })] }));
}
