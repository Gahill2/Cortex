import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as Dialog from "@radix-ui/react-dialog";
import axios from "axios";
import { useEffect, useState } from "react";
import { api, enrichTask } from "../api/client";
export const TasksPage = () => {
    const [tasks, setTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [loadError, setLoadError] = useState(null);
    // modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [projectId, setProjectId] = useState("");
    const [description, setDescription] = useState("");
    const [enriching, setEnriching] = useState(false);
    const [enrichError, setEnrichError] = useState(null);
    const [saving, setSaving] = useState(false);
    const toArray = (payload) => {
        if (Array.isArray(payload))
            return payload;
        if (payload && typeof payload === "object" && "data" in payload) {
            const nested = payload.data;
            if (Array.isArray(nested))
                return nested;
        }
        return [];
    };
    const load = async () => {
        try {
            setLoadError(null);
            const [tasksRes, projectsRes] = await Promise.all([api.get("/tasks"), api.get("/projects")]);
            const nextTasks = toArray(tasksRes.data);
            const nextProjects = toArray(projectsRes.data);
            setTasks(nextTasks);
            setProjects(nextProjects);
            if (!projectId && nextProjects.length > 0) {
                setProjectId(nextProjects[0].id);
            }
        }
        catch (e) {
            setTasks([]);
            setProjects([]);
            setLoadError(axios.isAxiosError(e) ? (e.response?.data?.error ?? "Could not load tasks/projects") : "Could not load tasks/projects");
        }
    };
    useEffect(() => {
        void load();
    }, []);
    const openModal = () => {
        setTitle("");
        setDescription("");
        setEnrichError(null);
        setModalOpen(true);
    };
    const onEnrich = async () => {
        if (!title.trim())
            return;
        setEnriching(true);
        setEnrichError(null);
        try {
            const result = await enrichTask(title);
            setDescription(result);
        }
        catch (e) {
            setEnrichError(axios.isAxiosError(e) ? (e.response?.data?.error ?? "Enrichment failed") : "Enrichment failed");
        }
        finally {
            setEnriching(false);
        }
    };
    const onCreate = async (event) => {
        event.preventDefault();
        if (!projectId)
            return;
        setSaving(true);
        try {
            await api.post("/tasks", { title, projectId, description: description || undefined });
            setModalOpen(false);
            await load();
        }
        finally {
            setSaving(false);
        }
    };
    const onStatusChange = async (taskId, status) => {
        await api.patch(`/tasks/${taskId}`, { status });
        await load();
    };
    const visibleTasks = statusFilter === "ALL" ? tasks : tasks.filter((t) => t.status === statusFilter);
    return (_jsxs("section", { children: [_jsx("h1", { children: "Tasks" }), loadError ? _jsx("p", { className: "module-error", children: loadError }) : null, _jsxs(Dialog.Root, { open: modalOpen, onOpenChange: setModalOpen, children: [_jsx(Dialog.Trigger, { asChild: true, children: _jsx("button", { type: "button", onClick: openModal, children: "Add Task" }) }), _jsxs(Dialog.Portal, { children: [_jsx(Dialog.Overlay, { className: "dialog-overlay" }), _jsxs(Dialog.Content, { className: "dialog-content", "aria-describedby": "task-modal-desc", children: [_jsx(Dialog.Title, { children: "New Task" }), _jsx("p", { id: "task-modal-desc", className: "sr-only", children: "Create a task with an optional AI-generated description." }), _jsxs("form", { onSubmit: onCreate, children: [_jsx("label", { htmlFor: "task-title", children: "Title" }), _jsx("input", { id: "task-title", value: title, onChange: (e) => setTitle(e.target.value), placeholder: "Task title", required: true, autoFocus: true }), _jsx("label", { htmlFor: "task-project", children: "Project" }), _jsx("select", { id: "task-project", value: projectId, onChange: (e) => setProjectId(e.target.value), required: true, children: projects.map((p) => (_jsx("option", { value: p.id, children: p.name }, p.id))) }), _jsxs("div", { className: "task-modal-enrich-row", children: [_jsx("button", { type: "button", onClick: onEnrich, disabled: enriching || !title.trim(), children: enriching ? "Enriching…" : "Enrich with AI" }), enrichError ? _jsx("span", { className: "task-modal-enrich-error", children: enrichError }) : null] }), _jsx("label", { htmlFor: "task-description", children: "Description" }), _jsx("textarea", { id: "task-description", value: description, onChange: (e) => setDescription(e.target.value), placeholder: "AI will fill this in, or type your own", rows: 10 }), _jsxs("div", { className: "dialog-actions", children: [_jsx(Dialog.Close, { asChild: true, children: _jsx("button", { type: "button", children: "Cancel" }) }), _jsx("button", { type: "submit", disabled: saving || !title.trim(), children: saving ? "Creating…" : "Create Task" })] })] })] })] })] }), _jsx("div", { className: "filters", children: ["ALL", "TODO", "IN_PROGRESS", "DONE"].map((s) => (_jsx("button", { type: "button", onClick: () => setStatusFilter(s), children: s }, s))) }), _jsx("ul", { className: "list", children: visibleTasks.map((task) => (_jsxs("li", { children: [_jsx("strong", { children: task.title }), _jsxs("select", { value: task.status, onChange: (e) => onStatusChange(task.id, e.target.value), children: [_jsx("option", { value: "TODO", children: "TODO" }), _jsx("option", { value: "IN_PROGRESS", children: "IN_PROGRESS" }), _jsx("option", { value: "DONE", children: "DONE" })] })] }, task.id))) })] }));
};
