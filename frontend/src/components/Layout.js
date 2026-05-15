import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
export const Layout = () => {
    const { user, logout } = useAuth();
    return (_jsxs("div", { className: "container", children: [_jsxs("header", { className: "header", children: [_jsx(Link, { to: "/", className: "brand", children: "Launchpad" }), _jsxs("nav", { children: [_jsx(NavLink, { to: "/", children: "Dashboard" }), _jsx(NavLink, { to: "/projects", children: "Projects" }), _jsx(NavLink, { to: "/tasks", children: "Tasks" })] }), _jsxs("div", { className: "user-meta", children: [_jsx("span", { children: user?.fullName }), _jsx("button", { onClick: logout, children: "Log out" })] })] }), _jsx("main", { children: _jsx(Outlet, {}) })] }));
};
