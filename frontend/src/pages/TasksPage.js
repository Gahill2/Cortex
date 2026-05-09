import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api } from "../api/client";
const STATUS_COLS = [
    { key: "TODO", label: "To Do" },
    { key: "IN_PROGRESS", label: "In Progress" },
    { key: "DONE", label: "Done" },
];
const NEXT = {
    TODO: "IN_PROGRESS",
    IN_PROGRESS: "DONE",
    DONE: "TODO",
};
export const TasksPage = () => {
    const [projects, setProjects] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [filter, setFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [showProjectForm, setShowProjectForm] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newProjId, setNewProjId] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [enriching, setEnriching] = useState(false);
    const [saving, setSaving] = useState(false);
    const [newProjName, setNewProjName] = useState("");
    const [savingProj, setSavingProj] = useState(false);
    useEffect(() => { void load(); }, []);
    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const [pr, tr] = await Promise.all([api.get("/projects"), api.get("/tasks")]);
            const p = Array.isArray(pr.data) ? pr.data : (pr.data?.data ?? []);
            const t = Array.isArray(tr.data) ? tr.data : (tr.data?.data ?? []);
            setProjects(p);
            setTasks(t);
            if (p.length > 0 && !newProjId)
                setNewProjId(p[0].id);
        }
        catch {
            setError("Could not load tasks.");
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
            const r = await api.post("/ai/tasks/enrich", { title: newTitle });
            setNewDesc(r.data?.data?.description ?? r.data?.description ?? "");
        }
        catch { /* ignore */ }
        finally {
            setEnriching(false);
        }
    };
    const addTask = async (e) => {
        e.preventDefault();
        if (!newTitle.trim() || !newProjId)
            return;
        setSaving(true);
        try {
            await api.post("/tasks", { title: newTitle, projectId: newProjId, description: newDesc || undefined });
            setShowTaskForm(false);
            setNewTitle("");
            setNewDesc("");
            await load();
        }
        finally {
            setSaving(false);
        }
    };
    const addProject = async (e) => {
        e.preventDefault();
        if (!newProjName.trim())
            return;
        setSavingProj(true);
        try {
            await api.post("/projects", { name: newProjName });
            setShowProjectForm(false);
            setNewProjName("");
            await load();
        }
        finally {
            setSavingProj(false);
        }
    };
    const cycleStatus = async (task) => {
        const next = NEXT[task.status];
        setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: next } : t));
        try {
            await api.patch(`/tasks/${task.id}`, { status: next });
        }
        catch {
            await load();
        }
    };
    const deleteTask = async (id) => {
        setTasks((prev) => prev.filter((t) => t.id !== id));
        try {
            await api.delete(`/tasks/${id}`);
        }
        catch {
            await load();
        }
    };
    const visible = filter === "all" ? tasks : tasks.filter((t) => t.project.id === filter);
    return (_jsxs("div", { className: "page", children: [_jsxs("div", { className: "page-titlebar", children: [_jsx("div", { children: _jsx("h1", { className: "page-title", children: "Tasks" }) }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "btn-ghost", onClick: () => setShowProjectForm(true), children: "+ Project" }), _jsx("button", { className: "btn-primary", onClick: () => setShowTaskForm(true), children: "+ New Task" })] })] }), _jsxs("div", { className: "filter-bar", children: [_jsxs("button", { className: `filter-chip ${filter === "all" ? "active" : ""}`, onClick: () => setFilter("all"), children: ["All ", _jsx("span", { className: "filter-count", children: tasks.length })] }), projects.map((p) => {
                        const count = tasks.filter((t) => t.project.id === p.id).length;
                        return (_jsxs("button", { className: `filter-chip ${filter === p.id ? "active" : ""}`, onClick: () => setFilter(p.id), children: [p.name, " ", _jsx("span", { className: "filter-count", children: count })] }, p.id));
                    })] }), error && _jsx("p", { className: "page-error", children: error }), showTaskForm && (_jsx("div", { className: "inline-form-card", children: _jsxs("form", { onSubmit: addTask, children: [_jsxs("div", { className: "inline-form-row", children: [_jsx("input", { className: "form-input form-input--grow", value: newTitle, onChange: (e) => setNewTitle(e.target.value), placeholder: "Task title\u2026", autoFocus: true, required: true }), _jsx("select", { className: "form-select", value: newProjId, onChange: (e) => setNewProjId(e.target.value), required: true, children: projects.map((p) => _jsx("option", { value: p.id, children: p.name }, p.id)) }), _jsx("button", { type: "button", className: "btn-ghost btn-sm", onClick: () => void enrich(), disabled: enriching || !newTitle.trim(), children: enriching ? "…" : "✦ AI enrich" }), _jsx("button", { type: "submit", className: "btn-primary btn-sm", disabled: saving || !newTitle.trim(), children: saving ? "Saving…" : "Create" }), _jsx("button", { type: "button", className: "btn-ghost btn-sm", onClick: () => setShowTaskForm(false), children: "Cancel" })] }), newDesc && (_jsx("textarea", { className: "form-textarea", value: newDesc, onChange: (e) => setNewDesc(e.target.value), rows: 3, placeholder: "Description\u2026" }))] }) })), showProjectForm && (_jsx("div", { className: "inline-form-card", children: _jsx("form", { onSubmit: addProject, children: _jsxs("div", { className: "inline-form-row", children: [_jsx("input", { className: "form-input form-input--grow", value: newProjName, onChange: (e) => setNewProjName(e.target.value), placeholder: "Project name\u2026", autoFocus: true, required: true }), _jsx("button", { type: "submit", className: "btn-primary btn-sm", disabled: savingProj, children: savingProj ? "Saving…" : "Create Project" }), _jsx("button", { type: "button", className: "btn-ghost btn-sm", onClick: () => setShowProjectForm(false), children: "Cancel" })] }) }) })), !loading && (_jsx("div", { className: "kanban-board", children: STATUS_COLS.map(({ key, label }) => {
                    const col = visible.filter((t) => t.status === key);
                    return (_jsxs("div", { className: `kanban-col kanban-col--${key.toLowerCase().replace("_", "-")}`, children: [_jsxs("div", { className: "kanban-col-header", children: [_jsx("span", { className: "kanban-col-title", children: label }), _jsx("span", { className: "kanban-col-count", children: col.length })] }), _jsxs("div", { className: "kanban-col-body", children: [col.map((task) => (_jsxs("div", { className: "kanban-card", children: [_jsxs("div", { className: "kanban-card-top", children: [_jsx("p", { className: `kanban-card-title ${key === "DONE" ? "done" : ""}`, children: task.title }), _jsx("button", { className: "kanban-card-delete", onClick: () => void deleteTask(task.id), children: "\u00D7" })] }), _jsxs("div", { className: "kanban-card-footer", children: [_jsx("span", { className: "kanban-card-project", children: task.project.name }), _jsx("button", { className: "kanban-card-advance", onClick: () => void cycleStatus(task), children: key === "TODO" ? "Start →" : key === "IN_PROGRESS" ? "Done ✓" : "Reopen" })] })] }, task.id))), col.length === 0 && _jsx("p", { className: "kanban-col-empty", children: "Empty" })] })] }, key));
                }) })), loading && _jsx("p", { className: "page-loading", children: "Loading\u2026" })] }));
};
