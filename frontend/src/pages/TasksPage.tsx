import { FormEvent, useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { api } from "../api/client";

interface Project { id: string; name: string }
interface Task {
  id: string;
  title: string;
  description?: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate?: string | null;
  project: { id: string; name: string };
  assignee?: { name: string } | null;
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

const PRIORITY_COLORS: Record<Task["priority"], string> = {
  HIGH:   "#ef4444",
  MEDIUM: "#f59e0b",
  LOW:    "#6b7280",
};

const PRIORITY_LABELS: Record<Task["priority"], string> = {
  HIGH: "High", MEDIUM: "Medium", LOW: "Low",
};

function isOverdue(task: Task) {
  if (!task.dueDate || task.status === "DONE") return false;
  return new Date(task.dueDate) < new Date();
}

function isDueToday(task: Task) {
  if (!task.dueDate || task.status === "DONE") return false;
  const d = new Date(task.dueDate);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function fmtDue(iso: string) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff < 7) return `${diff}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── Draggable task card ────────────────────────────────────────────────────
function TaskCard({
  task,
  onCycle,
  onDelete,
}: {
  task: Task;
  onCycle: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const overdue = isOverdue(task);
  const today   = isDueToday(task);

  const dueBadgeClass = overdue ? "kanban-due-badge--overdue" : today ? "kanban-due-badge--today" : "";
  const statusLabel = task.status === "TODO" ? "Start →" : task.status === "IN_PROGRESS" ? "Done ✓" : "Reopen";

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`kanban-card kanban-card--priority-${task.priority} ${overdue ? "kanban-card--overdue" : ""} ${isDragging ? "kanban-card--dragging" : ""}`}
      style={{ cursor: isDragging ? "grabbing" : "grab", opacity: isDragging ? 0.4 : 1, transform: isDragging ? "scale(0.97)" : undefined }}
    >
      {/* Project tag */}
      <span className="kanban-project-tag">{task.project.name}</span>

      {/* Title row */}
      <div className="kanban-card-top">
        <p className={`kanban-card-title ${task.status === "DONE" ? "done" : ""}`}>{task.title}</p>
        <button
          className="kanban-card-delete"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
        >
          ×
        </button>
      </div>

      {/* Bottom row: priority label + due badge + assignee + cycle button */}
      <div className="kanban-card-bottom">
        <span
          className="kanban-priority-label"
          style={{ color: PRIORITY_COLORS[task.priority] }}
        >
          {PRIORITY_LABELS[task.priority]}
        </span>

        {task.dueDate && (
          <span className={`kanban-due-badge ${dueBadgeClass}`}>
            {fmtDue(task.dueDate)}
          </span>
        )}

        <button
          className="kanban-card-advance"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onCycle(task); }}
          style={{ marginLeft: "auto" }}
        >
          {statusLabel}
        </button>

        {task.assignee?.name && (
          <span className="kanban-assignee-avatar" title={task.assignee.name}>
            {initials(task.assignee.name)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Drag overlay (smooth ghost that follows cursor at 60fps) ────────────────
function TaskCardOverlay({ task }: { task: Task }) {
  const overdue = isOverdue(task);
  const today = isDueToday(task);
  const dueBadgeClass = overdue ? "kanban-due-badge--overdue" : today ? "kanban-due-badge--today" : "";

  return (
    <div className={`kanban-card kanban-card--priority-${task.priority} kanban-card--overlay ${overdue ? "kanban-card--overdue" : ""}`}>
      <span className="kanban-project-tag">{task.project.name}</span>
      <div className="kanban-card-top">
        <p className={`kanban-card-title ${task.status === "DONE" ? "done" : ""}`}>{task.title}</p>
      </div>
      <div className="kanban-card-bottom">
        <span className="kanban-priority-label" style={{ color: PRIORITY_COLORS[task.priority] }}>
          {PRIORITY_LABELS[task.priority]}
        </span>
        {task.dueDate && (
          <span className={`kanban-due-badge ${dueBadgeClass}`}>{fmtDue(task.dueDate)}</span>
        )}
        {task.assignee?.name && (
          <span className="kanban-assignee-avatar" title={task.assignee.name}>{initials(task.assignee.name)}</span>
        )}
      </div>
    </div>
  );
}

// ── Droppable column ───────────────────────────────────────────────────────
function KanbanColumn({
  col,
  tasks,
  onCycle,
  onDelete,
  onQuickAdd,
}: {
  col: typeof STATUS_COLS[number];
  tasks: Task[];
  onCycle: (t: Task) => void;
  onDelete: (id: string) => void;
  onQuickAdd: (status: Task["status"], title: string) => Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  const [adding, setAdding] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const submitQuick = async (e: FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    setSaving(true);
    await onQuickAdd(col.key, quickTitle.trim());
    setQuickTitle("");
    setAdding(false);
    setSaving(false);
  };

  return (
    <div
      className={`kanban-col kanban-col--${col.key} ${isOver ? "kanban-col--drop-over" : ""}`}
    >
      <div className="kanban-col-header">
        <span className="kanban-col-title">{col.label}</span>
        <span className="kanban-col-count-badge">{tasks.length}</span>
        <button
          className="kanban-col-add-btn"
          title={`Add task to ${col.label}`}
          onClick={() => { setAdding(true); }}
        >
          +
        </button>
      </div>

      {adding && (
        <form className="kanban-quick-add" onSubmit={submitQuick}>
          <input
            className="kanban-quick-input"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Task title…"
            autoFocus
          />
          <button type="submit" className="btn-primary btn-sm" disabled={saving || !quickTitle.trim()}>
            {saving ? "…" : "Add"}
          </button>
          <button
            type="button"
            className="kanban-quick-cancel"
            onClick={() => { setAdding(false); setQuickTitle(""); }}
          >
            ×
          </button>
        </form>
      )}

      <div className="kanban-col-body" ref={setNodeRef}>
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onCycle={onCycle} onDelete={onDelete} />
        ))}
        {tasks.length === 0 && (
          <div className="kanban-empty-col">
            {isOver ? "Release to drop here" : "Drop tasks here"}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export const TasksPage = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks,    setTasks]    = useState<Task[]>([]);
  const [filter,   setFilter]   = useState("all");
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const [showTaskForm,    setShowTaskForm]    = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [newTitle,    setNewTitle]    = useState("");
  const [newProjId,   setNewProjId]   = useState("");
  const [newDesc,     setNewDesc]     = useState("");
  const [newPriority, setNewPriority] = useState<Task["priority"]>("MEDIUM");
  const [newDueDate,  setNewDueDate]  = useState("");
  const [enriching,   setEnriching]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [savingProj,  setSavingProj]  = useState(false);
  const [nlMode,      setNlMode]      = useState(false);
  const [nlText,      setNlText]      = useState("");
  const [nlParsing,   setNlParsing]   = useState(false);

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

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

  const parseNl = async (e: FormEvent) => {
    e.preventDefault();
    if (!nlText.trim() || !newProjId) return;
    setNlParsing(true);
    try {
      const r = await api.post("/ai/tasks/parse", { text: nlText });
      const d = r.data?.data ?? r.data ?? {};
      setNewTitle(d.title ?? nlText);
      if (d.description) setNewDesc(d.description);
      if (d.priority) setNewPriority(d.priority);
      if (d.dueDate) setNewDueDate(d.dueDate);
      setNlMode(false);
      setNlText("");
    } catch { /* ignore */ }
    finally { setNlParsing(false); }
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

  const addTask = async (e: FormEvent, statusOverride?: Task["status"]) => {
    if (e) e.preventDefault();
    if (!newTitle.trim() || !newProjId) return;
    setSaving(true);
    try {
      await api.post("/tasks", {
        title: newTitle,
        projectId: newProjId,
        description: newDesc || undefined,
        priority: newPriority,
        dueDate: newDueDate ? new Date(newDueDate).toISOString() : undefined,
        status: statusOverride ?? "TODO",
      });
      setShowTaskForm(false); setNewTitle(""); setNewDesc(""); setNewDueDate(""); setNewPriority("MEDIUM"); setNlMode(false); setNlText("");
      await load();
    } finally { setSaving(false); }
  };

  const quickAddToCol = async (status: Task["status"], title: string) => {
    if (!title.trim() || !newProjId) {
      // Use first project if available
      const pid = newProjId || projects[0]?.id;
      if (!pid) return;
      await api.post("/tasks", { title, projectId: pid, status, priority: "MEDIUM" });
    } else {
      await api.post("/tasks", { title, projectId: newProjId, status, priority: "MEDIUM" });
    }
    await load();
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

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const newStatus = over.id as Task["status"];
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    try { await api.patch(`/tasks/${taskId}`, { status: newStatus }); }
    catch { await load(); }
  };

  const visible = filter === "all" ? tasks : tasks.filter((t) => t.project.id === filter);
  const overdueCount = tasks.filter(isOverdue).length;

  return (
    <div className="page tasks-page">
      <div className="page-titlebar">
        <div>
          <h1 className="page-title">
            Tasks {overdueCount > 0 && <span className="overdue-badge">⚠ {overdueCount} overdue</span>}
          </h1>
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
          {nlMode ? (
            <form onSubmit={parseNl}>
              <div className="inline-form-row">
                <input
                  className="form-input form-input--grow"
                  value={nlText}
                  onChange={(e) => setNlText(e.target.value)}
                  placeholder='Describe the task… e.g. "Fix login bug, high priority, due Friday"'
                  autoFocus
                  required
                />
                <select className="form-select" value={newProjId} onChange={(e) => setNewProjId(e.target.value)} required>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button type="submit" className="btn-primary btn-sm" disabled={nlParsing || !nlText.trim()}>
                  {nlParsing ? "Parsing…" : "✦ Parse"}
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setNlMode(false)}>Manual</button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setShowTaskForm(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <form onSubmit={addTask}>
              <div className="inline-form-row">
                <input className="form-input form-input--grow" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Task title…" autoFocus required />
                <select className="form-select" value={newProjId} onChange={(e) => setNewProjId(e.target.value)} required>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select className="form-select form-select--sm" value={newPriority} onChange={(e) => setNewPriority(e.target.value as Task["priority"])}>
                  <option value="HIGH">🔴 High</option>
                  <option value="MEDIUM">🟡 Med</option>
                  <option value="LOW">⚪ Low</option>
                </select>
                <input type="date" className="form-input form-input--date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} title="Due date" />
                <button type="button" className="btn-ghost btn-sm" onClick={() => void enrich()} disabled={enriching || !newTitle.trim()}>
                  {enriching ? "…" : "✦ AI"}
                </button>
                <button type="submit" className="btn-primary btn-sm" disabled={saving || !newTitle.trim()}>
                  {saving ? "Saving…" : "Create"}
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setNlMode(true)} title="Describe task in plain English">✦ NL</button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setShowTaskForm(false)}>Cancel</button>
              </div>
              {newDesc && (
                <textarea className="form-textarea" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} placeholder="Description…" />
              )}
            </form>
          )}
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
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="kanban-board">
            {STATUS_COLS.map((col) => {
              const colTasks = visible.filter((t) => t.status === col.key);
              return (
                <KanbanColumn
                  key={col.key}
                  col={col}
                  tasks={colTasks}
                  onCycle={cycleStatus}
                  onDelete={deleteTask}
                  onQuickAdd={quickAddToCol}
                />
              );
            })}
          </div>
          <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
            {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      )}
      {loading && <p className="page-loading">Loading…</p>}
    </div>
  );
};
