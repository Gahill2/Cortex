import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";

interface Project { id: string; name: string }
interface Task {
  id: string;
  title: string;
  description?: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  project: { id: string; name: string };
  createdAt: string;
}

const STATUS_COLS: Array<{ key: Task["status"]; label: string }> = [
  { key: "TODO",        label: "To Do"       },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "DONE",        label: "Done"        },
];

const NEXT: Record<Task["status"], Task["status"]> = {
  TODO: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  DONE: "TODO",
};

export const TasksPage = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks,    setTasks]    = useState<Task[]>([]);
  const [filter,   setFilter]   = useState("all");
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const [showTaskForm,    setShowTaskForm]    = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [newTitle,   setNewTitle]   = useState("");
  const [newProjId,  setNewProjId]  = useState("");
  const [newDesc,    setNewDesc]    = useState("");
  const [enriching,  setEnriching]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [savingProj,  setSavingProj]  = useState(false);

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pr, tr] = await Promise.all([api.get("/projects"), api.get("/tasks")]);
      const p: Project[] = Array.isArray(pr.data) ? pr.data : (pr.data?.data ?? []);
      const t: Task[]    = Array.isArray(tr.data) ? tr.data : (tr.data?.data ?? []);
      setProjects(p);
      setTasks(t);
      if (p.length > 0 && !newProjId) setNewProjId(p[0].id);
    } catch {
      setError("Could not load tasks.");
    } finally {
      setLoading(false);
    }
  };

  const enrich = async () => {
    if (!newTitle.trim()) return;
    setEnriching(true);
    try {
      const r = await api.post("/ai/tasks/enrich", { title: newTitle });
      setNewDesc(r.data?.data?.description ?? r.data?.description ?? "");
    } catch { /* ignore */ }
    finally { setEnriching(false); }
  };

  const addTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newProjId) return;
    setSaving(true);
    try {
      await api.post("/tasks", { title: newTitle, projectId: newProjId, description: newDesc || undefined });
      setShowTaskForm(false); setNewTitle(""); setNewDesc("");
      await load();
    } finally { setSaving(false); }
  };

  const addProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;
    setSavingProj(true);
    try {
      await api.post("/projects", { name: newProjName });
      setShowProjectForm(false); setNewProjName("");
      await load();
    } finally { setSavingProj(false); }
  };

  const cycleStatus = async (task: Task) => {
    const next = NEXT[task.status];
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: next } : t));
    try { await api.patch(`/tasks/${task.id}`, { status: next }); }
    catch { await load(); }
  };

  const deleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try { await api.delete(`/tasks/${id}`); }
    catch { await load(); }
  };

  const visible = filter === "all" ? tasks : tasks.filter((t) => t.project.id === filter);

  return (
    <div className="page">
      <div className="page-titlebar">
        <div>
          <h1 className="page-title">Tasks</h1>
        </div>
        <div className="page-actions">
          <button className="btn-ghost" onClick={() => setShowProjectForm(true)}>+ Project</button>
          <button className="btn-primary" onClick={() => setShowTaskForm(true)}>+ New Task</button>
        </div>
      </div>

      {/* Project filter */}
      <div className="filter-bar">
        <button className={`filter-chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
          All <span className="filter-count">{tasks.length}</span>
        </button>
        {projects.map((p) => {
          const count = tasks.filter((t) => t.project.id === p.id).length;
          return (
            <button key={p.id} className={`filter-chip ${filter === p.id ? "active" : ""}`} onClick={() => setFilter(p.id)}>
              {p.name} <span className="filter-count">{count}</span>
            </button>
          );
        })}
      </div>

      {error && <p className="page-error">{error}</p>}

      {/* Inline forms */}
      {showTaskForm && (
        <div className="inline-form-card">
          <form onSubmit={addTask}>
            <div className="inline-form-row">
              <input className="form-input form-input--grow" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Task title…" autoFocus required />
              <select className="form-select" value={newProjId} onChange={(e) => setNewProjId(e.target.value)} required>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button type="button" className="btn-ghost btn-sm" onClick={() => void enrich()} disabled={enriching || !newTitle.trim()}>
                {enriching ? "…" : "✦ AI enrich"}
              </button>
              <button type="submit" className="btn-primary btn-sm" disabled={saving || !newTitle.trim()}>
                {saving ? "Saving…" : "Create"}
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setShowTaskForm(false)}>Cancel</button>
            </div>
            {newDesc && (
              <textarea className="form-textarea" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} placeholder="Description…" />
            )}
          </form>
        </div>
      )}

      {showProjectForm && (
        <div className="inline-form-card">
          <form onSubmit={addProject}>
            <div className="inline-form-row">
              <input className="form-input form-input--grow" value={newProjName} onChange={(e) => setNewProjName(e.target.value)} placeholder="Project name…" autoFocus required />
              <button type="submit" className="btn-primary btn-sm" disabled={savingProj}>{savingProj ? "Saving…" : "Create Project"}</button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setShowProjectForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Kanban board */}
      {!loading && (
        <div className="kanban-board">
          {STATUS_COLS.map(({ key, label }) => {
            const col = visible.filter((t) => t.status === key);
            return (
              <div key={key} className={`kanban-col kanban-col--${key.toLowerCase().replace("_", "-")}`}>
                <div className="kanban-col-header">
                  <span className="kanban-col-title">{label}</span>
                  <span className="kanban-col-count">{col.length}</span>
                </div>
                <div className="kanban-col-body">
                  {col.map((task) => (
                    <div key={task.id} className="kanban-card">
                      <div className="kanban-card-top">
                        <p className={`kanban-card-title ${key === "DONE" ? "done" : ""}`}>{task.title}</p>
                        <button className="kanban-card-delete" onClick={() => void deleteTask(task.id)}>×</button>
                      </div>
                      <div className="kanban-card-footer">
                        <span className="kanban-card-project">{task.project.name}</span>
                        <button className="kanban-card-advance" onClick={() => void cycleStatus(task)}>
                          {key === "TODO" ? "Start →" : key === "IN_PROGRESS" ? "Done ✓" : "Reopen"}
                        </button>
                      </div>
                    </div>
                  ))}
                  {col.length === 0 && <p className="kanban-col-empty">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {loading && <p className="page-loading">Loading…</p>}
    </div>
  );
};
