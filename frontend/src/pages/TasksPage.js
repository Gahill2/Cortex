import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api } from "../api/client";
const STATUS_LABELS = {
    TODO: "To do",
    IN_PROGRESS: "In progress",
    DONE: "Done"
};
const STATUS_CYCLE = ["TODO", "IN_PROGRESS", "DONE"];
export const TasksPage = () => {
    const [projects, setProjects] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [activeProject, setActiveProject] = useState("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // add task form
    const [adding, setAdding] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newProjectId, setNewProjectId] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [enriching, setEnriching] = useState(false);
    const [saving, setSaving] = useState(false);
    // add project form
    const [addingProject, setAddingProject] = useState(false);
    const [newProjectName, setNewProjectName] = useState("");
    const [savingProject, setSavingProject] = useState(false);
    useEffect(() => { void load(); }, []);
    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const [pRes, tRes] = await Promise.all([api.get("/projects"), api.get("/tasks")]);
            const p = Array.isArray(pRes.data) ? pRes.data : (pRes.data?.data ?? []);
            const t = Array.isArray(tRes.data) ? tRes.data : (tRes.data?.data ?? []);
            setProjects(p);
            setTasks(t);
            if (p.length > 0 && !newProjectId)
                setNewProjectId(p[0].id);
        }
        catch {
            setError("Could not load tasks. Check your connection.");
        }
        finally {
            setLoading(false);
        }
    };
    const enrich = async () => {
        if (!newTitle.trim())
            return;
        setEnriching(true);
        try {
            const res = await api.post("/ai/tasks/enrich", { title: newTitle });
            setNewDesc(res.data?.data?.description ?? res.data?.description ?? "");
        }
        catch { /* ignore */ }
        finally {
            setEnriching(false);
        }
    };
    const addTask = async (e) => {
        e.preventDefault();
        if (!newTitle.trim() || !newProjectId)
            return;
        setSaving(true);
        try {
            await api.post("/tasks", {
                title: newTitle,
                projectId: newProjectId,
                description: newDesc || undefined
            });
            setAdding(false);
            setNewTitle("");
            setNewDesc("");
            await load();
        }
        catch { /* ignore */ }
        finally {
            setSaving(false);
        }
    };
    const addProject = async (e) => {
        e.preventDefault();
        if (!newProjectName.trim())
            return;
        setSavingProject(true);
        try {
            await api.post("/projects", { name: newProjectName });
            setAddingProject(false);
            setNewProjectName("");
            await load();
        }
        catch { /* ignore */ }
        finally {
            setSavingProject(false);
        }
    };
    const cycleStatus = async (task) => {
        const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(task.status) + 1) % STATUS_CYCLE.length];
        try {
            await api.patch(`/tasks/${task.id}`, { status: next });
            setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
        }
        catch { /* ignore */ }
    };
    const deleteTask = async (taskId) => {
        try {
            await api.delete(`/tasks/${taskId}`);
            setTasks((prev) => prev.filter((t) => t.id !== taskId));
        }
        catch { /* ignore */ }
    };
    const visible = activeProject === "all"
        ? tasks
        : tasks.filter((t) => t.project.id === activeProject);
    const grouped = {
        TODO: visible.filter((t) => t.status === "TODO"),
        IN_PROGRESS: visible.filter((t) => t.status === "IN_PROGRESS"),
        DONE: visible.filter((t) => t.status === "DONE")
    };
    return (_jsxs("div", { className: "page tasks-page", children: [_jsxs("header", { className: "page-header", children: [_jsx("h1", { className: "page-title", children: "Tasks" }), _jsx("button", { className: "header-action-btn", onClick: () => setAdding(true), children: "+ Add" })] }), _jsxs("div", { className: "project-tabs", children: [_jsx("button", { className: `project-tab ${activeProject === "all" ? "active" : ""}`, onClick: () => setActiveProject("all"), children: "All" }), projects.map((p) => (_jsx("button", { className: `project-tab ${activeProject === p.id ? "active" : ""}`, onClick: () => setActiveProject(p.id), children: p.name }, p.id))), _jsx("button", { className: "project-tab project-tab--add", onClick: () => setAddingProject(true), children: "+" })] }), error && _jsx("p", { className: "page-error", children: error }), loading && _jsx("p", { className: "page-loading", children: "Loading\u2026" }), adding && (_jsx("div", { className: "task-form-card", children: _jsxs("form", { onSubmit: addTask, children: [_jsx("input", { className: "task-form-input", value: newTitle, onChange: (e) => setNewTitle(e.target.value), placeholder: "Task title", autoFocus: true, required: true }), _jsxs("div", { className: "task-form-row", children: [_jsx("select", { className: "task-form-select", value: newProjectId, onChange: (e) => setNewProjectId(e.target.value), required: true, children: projects.map((p) => (_jsx("option", { value: p.id, children: p.name }, p.id))) }), _jsx("button", { type: "button", className: "task-form-enrich", onClick: () => void enrich(), disabled: enriching || !newTitle.trim(), children: enriching ? "…" : "✦ AI" })] }), newDesc && (_jsx("textarea", { className: "task-form-textarea", value: newDesc, onChange: (e) => setNewDesc(e.target.value), rows: 4 })), _jsxs("div", { className: "task-form-actions", children: [_jsx("button", { type: "button", className: "task-form-cancel", onClick: () => setAdding(false), children: "Cancel" }), _jsx("button", { type: "submit", className: "task-form-save", disabled: saving || !newTitle.trim(), children: saving ? "Saving…" : "Create" })] })] }) })), addingProject && (_jsx("div", { className: "task-form-card", children: _jsxs("form", { onSubmit: addProject, children: [_jsx("input", { className: "task-form-input", value: newProjectName, onChange: (e) => setNewProjectName(e.target.value), placeholder: "Project name", autoFocus: true, required: true }), _jsxs("div", { className: "task-form-actions", children: [_jsx("button", { type: "button", className: "task-form-cancel", onClick: () => setAddingProject(false), children: "Cancel" }), _jsx("button", { type: "submit", className: "task-form-save", disabled: savingProject, children: savingProject ? "Saving…" : "Create Project" })] })] }) })), !loading && (_jsxs("div", { className: "task-groups", children: [["TODO", "IN_PROGRESS", "DONE"].map((status) => grouped[status].length === 0 ? null : (_jsxs("div", { className: "task-group", children: [_jsxs("p", { className: "task-group-label", children: [STATUS_LABELS[status], " \u00B7 ", grouped[status].length] }), grouped[status].map((task) => (_jsxs("div", { className: `task-card task-card--${status.toLowerCase().replace("_", "-")}`, children: [_jsxs("div", { className: "task-card-body", children: [_jsx("button", { className: "task-status-pill", onClick: () => void cycleStatus(task), title: "Cycle status", children: status === "TODO" ? "○" : status === "IN_PROGRESS" ? "◑" : "●" }), _jsxs("div", { className: "task-card-text", children: [_jsx("p", { className: `task-card-title ${status === "DONE" ? "done" : ""}`, children: task.title }), _jsx("p", { className: "task-card-project", children: task.project.name })] })] }), _jsx("button", { className: "task-delete-btn", onClick: () => void deleteTask(task.id), "aria-label": "Delete task", children: "\u00D7" })] }, task.id)))] }, status))), visible.length === 0 && !loading && (_jsxs("div", { className: "task-empty", children: [_jsx("p", { children: "No tasks yet" }), _jsx("button", { className: "task-empty-btn", onClick: () => setAdding(true), children: "Create your first task \u2192" })] }))] }))] }));
};
