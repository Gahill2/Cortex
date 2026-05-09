import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const TABS = [
    { id: "home", label: "Home", icon: "⌂" },
    { id: "tasks", label: "Tasks", icon: "✓" },
    { id: "ai", label: "AI", icon: "◈" },
    { id: "settings", label: "Settings", icon: "⚙" }
];
export const BottomNav = ({ active, onChange }) => (_jsx("nav", { className: "bottom-nav", "aria-label": "Main navigation", children: TABS.map((tab) => (_jsxs("button", { className: `bottom-nav-item ${active === tab.id ? "active" : ""}`, onClick: () => onChange(tab.id), "aria-current": active === tab.id ? "page" : undefined, children: [_jsx("span", { className: "bottom-nav-icon", children: tab.icon }), _jsx("span", { className: "bottom-nav-label", children: tab.label })] }, tab.id))) }));
