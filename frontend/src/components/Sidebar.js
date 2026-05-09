import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const NAV = [
    { id: "home", label: "Home", icon: "⌂" },
    { id: "tasks", label: "Tasks", icon: "✓" },
    { id: "ai", label: "AI", icon: "◈" },
    { id: "gmail", label: "Gmail", icon: "✉" },
    { id: "settings", label: "Settings", icon: "⚙" },
];
export const Sidebar = ({ active, onChange }) => (_jsxs("aside", { className: "sidebar", children: [_jsxs("div", { className: "sidebar-logo", children: [_jsx("div", { className: "sidebar-logo-mark", children: "C" }), _jsx("span", { className: "sidebar-logo-text", children: "Cortex" })] }), _jsx("nav", { className: "sidebar-nav", children: NAV.map((item) => (_jsxs("button", { className: `sidebar-nav-item ${active === item.id ? "active" : ""}`, onClick: () => onChange(item.id), children: [_jsx("span", { className: "sidebar-nav-icon", children: item.icon }), _jsx("span", { className: "sidebar-nav-label", children: item.label })] }, item.id))) }), _jsx("div", { className: "sidebar-footer", children: _jsxs("div", { className: "sidebar-status", children: [_jsx("span", { className: "sidebar-status-dot" }), _jsx("span", { className: "sidebar-status-text", children: "Online" })] }) })] }));
