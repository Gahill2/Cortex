import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import cortexLogo from "../assets/cortex-logo.png";
const NAV = [
    { id: "home", label: "Home", icon: "⌂" },
    { id: "tasks", label: "Tasks", icon: "✓" },
    { id: "ai", label: "AI", icon: "◈" },
    { id: "memory", label: "Memory", icon: "◎" },
    { id: "mail", label: "Mail", icon: "✉" },
    { id: "settings", label: "Settings", icon: "⚙" },
];
export const Sidebar = ({ active, onChange, mobileOpen, onClose }) => (_jsxs("aside", { className: `sidebar ${mobileOpen ? "sidebar--open" : ""}`, children: [_jsxs("div", { className: "sidebar-logo", children: [_jsx("img", { src: cortexLogo, alt: "Cortex", className: "cortex-logo-img sidebar-logo-img" }), onClose && (_jsx("button", { type: "button", className: "sidebar-close-btn", onClick: onClose, "aria-label": "Close menu", children: "\u00D7" }))] }), _jsx("nav", { className: "sidebar-nav", children: NAV.map((item) => (_jsxs("button", { type: "button", className: `sidebar-nav-item ${active === item.id ? "active" : ""}`, onClick: () => onChange(item.id), children: [_jsx("span", { className: "sidebar-nav-icon", children: item.icon }), _jsx("span", { className: "sidebar-nav-label", children: item.label })] }, item.id))) }), _jsx("div", { className: "sidebar-footer", children: _jsxs("div", { className: "sidebar-status", children: [_jsx("span", { className: "sidebar-status-dot" }), _jsx("span", { className: "sidebar-status-text", children: "Online" })] }) })] }));
