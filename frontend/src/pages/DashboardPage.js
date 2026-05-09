import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api } from "../api/client";
export const DashboardPage = () => {
    const [stats, setStats] = useState(null);
    useEffect(() => {
        api.get("/dashboard").then((response) => setStats(response.data));
    }, []);
    if (!stats)
        return _jsx("p", { children: "Loading dashboard..." });
    return (_jsxs("section", { children: [_jsx("h1", { children: "Dashboard" }), _jsxs("div", { className: "stats-grid", children: [_jsxs("article", { children: [_jsx("h3", { children: "Projects" }), _jsx("p", { children: stats.projectsCount })] }), _jsxs("article", { children: [_jsx("h3", { children: "Tasks" }), _jsx("p", { children: stats.tasksCount })] }), _jsxs("article", { children: [_jsx("h3", { children: "Todo" }), _jsx("p", { children: stats.taskStatus.todoCount })] }), _jsxs("article", { children: [_jsx("h3", { children: "In Progress" }), _jsx("p", { children: stats.taskStatus.inProgressCount })] }), _jsxs("article", { children: [_jsx("h3", { children: "Done" }), _jsx("p", { children: stats.taskStatus.doneCount })] })] })] }));
};
