import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";

interface Project {
  id: string;
  name: string;
  _count?: { tasks: number };
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  project: { id: string; name: string };
  createdAt: string;
}

const STATUS_LABELS: Record<Task["status"], string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done"
};

const STATUS_CYCLE: Task["status"][] = ["TODO", "IN_PROGRESS", "DONE"];

export const TasksPage = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeProject, setActiveProject] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const p: Project[] = Array.isArray(pRes.data) ? pRes.data : (pRes.data?.data ?? []);
      const t: Task[] = Array.isArray(tRes.data) ? tRes.data : (tRes.data?.data ?? []);
      setProjects(p);
      setTasks(t);
      if (p.length > 0 && !newProjectId) setNewProjectId(p[0].id);
    } catch {
      setError("Could not load tasks. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const enrich = async () => {
    if (!newTitle.trim()) return;
    setEnriching(true);
    try {
      const res = await api.post("/ai/tasks/enrich", { title: newTitle });
      setNewDesc(res.data?.data?.description ?? res.data?.description ?? "");
    } catch { /* ignore */ }
    finally { setEnriching(false); }
  };

  const addTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newProjectId) return;
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
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const addProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setSavingProject(true);
    try {
      await api.post("/projects", { name: newProjectName });
      setAddingProject(false);
      setNewProjectName("");
      await load();
    } catch { /* ignore */ }
    finally { setSavingProject(false); }
  };

  const cycleStatus = async (task: Task) => {
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(task.status) + 1) % STATUS_CYCLE.length];
    try {
      await api.patch(`/tasks/${task.id}`, { status: next });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    } catch { /* ignore */ }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await api.delete(`/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch { /* ignore */ }
  };

  const visible = activeProject === "all"
    ? tasks
    : tasks.filter((t) => t.project.id === activeProject);

  const grouped = {
    TODO: visible.filter((t) => t.status === "TODO"),
    IN_PROGRESS: visible.filter((t) => t.status === "IN_PROGRESS"),
    DONE: visible.filter((t) => t.status === "DONE")
  };

  return (
    <div className="page tasks-page">
      <header className="page-header">
        <h1 className="page-title">Tasks</h1>
        <button className="header-action-btn" onClick={() => setAdding(true)}>+ Add</button>
      </header>

      {/* Project filter tabs */}
      <div className="project-tabs">
        <button
          className={`project-tab ${activeProject === "all" ? "active" : ""}`}
          onClick={() => setActiveProject("all")}
        >
          All
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            className={`project-tab ${activeProject === p.id ? "active" : ""}`}
            onClick={() => setActiveProject(p.id)}
          >
            {p.name}
          </button>
        ))}
        <button className="project-tab project-tab--add" onClick={() => setAddingProject(true)}>+</button>
      </div>

      {error && <p className="page-error">{error}</p>}
      {loading && <p className="page-loading">Loading…</p>}

      {/* Add task form */}
      {adding && (
        <div className="task-form-card">
          <form onSubmit={addTask}>
            <input
              className="task-form-input"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title"
              autoFocus
              required
            />
            <div className="task-form-row">
              <select
                className="task-form-select"
                value={newProjectId}
                onChange={(e) => setNewProjectId(e.target.value)}
                required
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                type="button"
                className="task-form-enrich"
                onClick={() => void enrich()}
                disabled={enriching || !newTitle.trim()}
              >
                {enriching ? "…" : "✦ AI"}
              </button>
            </div>
            {newDesc && (
              <textarea
                className="task-form-textarea"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={4}
              />
            )}
            <div className="task-form-actions">
              <button type="button" className="task-form-cancel" onClick={() => setAdding(false)}>Cancel</button>
              <button type="submit" className="task-form-save" disabled={saving || !newTitle.trim()}>
                {saving ? "Saving…" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add project form */}
      {addingProject && (
        <div className="task-form-card">
          <form onSubmit={addProject}>
            <input
              className="task-form-input"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name"
              autoFocus
              required
            />
            <div className="task-form-actions">
              <button type="button" className="task-form-cancel" onClick={() => setAddingProject(false)}>Cancel</button>
              <button type="submit" className="task-form-save" disabled={savingProject}>
                {savingProject ? "Saving…" : "Create Project"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Task groups */}
      {!loading && (
        <div className="task-groups">
          {(["TODO", "IN_PROGRESS", "DONE"] as const).map((status) =>
            grouped[status].length === 0 ? null : (
              <div key={status} className="task-group">
                <p className="task-group-label">{STATUS_LABELS[status]} · {grouped[status].length}</p>
                {grouped[status].map((task) => (
                  <div key={task.id} className={`task-card task-card--${status.toLowerCase().replace("_", "-")}`}>
                    <div className="task-card-body">
                      <button
                        className="task-status-pill"
                        onClick={() => void cycleStatus(task)}
                        title="Cycle status"
                      >
                        {status === "TODO" ? "○" : status === "IN_PROGRESS" ? "◑" : "●"}
                      </button>
                      <div className="task-card-text">
                        <p className={`task-card-title ${status === "DONE" ? "done" : ""}`}>{task.title}</p>
                        <p className="task-card-project">{task.project.name}</p>
                      </div>
                    </div>
                    <button
                      className="task-delete-btn"
                      onClick={() => void deleteTask(task.id)}
                      aria-label="Delete task"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
          {visible.length === 0 && !loading && (
            <div className="task-empty">
              <p>No tasks yet</p>
              <button className="task-empty-btn" onClick={() => setAdding(true)}>Create your first task →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
