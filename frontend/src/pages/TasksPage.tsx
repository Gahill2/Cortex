import * as Dialog from "@radix-ui/react-dialog";
import axios from "axios";
import { FormEvent, useEffect, useState } from "react";
import { api, enrichTask } from "../api/client";
import type { Project, Task, TaskStatus } from "../types";

export const TasksPage = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
  const [loadError, setLoadError] = useState<string | null>(null);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toArray = <T,>(payload: unknown): T[] => {
    if (Array.isArray(payload)) return payload as T[];
    if (payload && typeof payload === "object" && "data" in payload) {
      const nested = (payload as { data?: unknown }).data;
      if (Array.isArray(nested)) return nested as T[];
    }
    return [];
  };

  const load = async () => {
    try {
      setLoadError(null);
      const [tasksRes, projectsRes] = await Promise.all([api.get("/tasks"), api.get("/projects")]);
      const nextTasks = toArray<Task>(tasksRes.data);
      const nextProjects = toArray<Project>(projectsRes.data);
      setTasks(nextTasks);
      setProjects(nextProjects);
      if (!projectId && nextProjects.length > 0) {
        setProjectId(nextProjects[0].id);
      }
    } catch (e) {
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
    if (!title.trim()) return;
    setEnriching(true);
    setEnrichError(null);
    try {
      const result = await enrichTask(title);
      setDescription(result);
    } catch (e) {
      setEnrichError(
        axios.isAxiosError(e) ? (e.response?.data?.error ?? "Enrichment failed") : "Enrichment failed"
      );
    } finally {
      setEnriching(false);
    }
  };

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!projectId) return;
    setSaving(true);
    try {
      await api.post("/tasks", { title, projectId, description: description || undefined });
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const onStatusChange = async (taskId: string, status: TaskStatus) => {
    await api.patch(`/tasks/${taskId}`, { status });
    await load();
  };

  const visibleTasks = statusFilter === "ALL" ? tasks : tasks.filter((t) => t.status === statusFilter);

  return (
    <section>
      <h1>Tasks</h1>
      {loadError ? <p className="module-error">{loadError}</p> : null}

      <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Dialog.Trigger asChild>
          <button type="button" onClick={openModal}>
            Add Task
          </button>
        </Dialog.Trigger>

        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content" aria-describedby="task-modal-desc">
            <Dialog.Title>New Task</Dialog.Title>
            <p id="task-modal-desc" className="sr-only">
              Create a task with an optional AI-generated description.
            </p>

            <form onSubmit={onCreate}>
              <label htmlFor="task-title">Title</label>
              <input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                required
                autoFocus
              />

              <label htmlFor="task-project">Project</label>
              <select id="task-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <div className="task-modal-enrich-row">
                <button type="button" onClick={onEnrich} disabled={enriching || !title.trim()}>
                  {enriching ? "Enriching…" : "Enrich with AI"}
                </button>
                {enrichError ? <span className="task-modal-enrich-error">{enrichError}</span> : null}
              </div>

              <label htmlFor="task-description">Description</label>
              <textarea
                id="task-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="AI will fill this in, or type your own"
                rows={10}
              />

              <div className="dialog-actions">
                <Dialog.Close asChild>
                  <button type="button">Cancel</button>
                </Dialog.Close>
                <button type="submit" disabled={saving || !title.trim()}>
                  {saving ? "Creating…" : "Create Task"}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="filters">
        {(["ALL", "TODO", "IN_PROGRESS", "DONE"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setStatusFilter(s)}>
            {s}
          </button>
        ))}
      </div>

      <ul className="list">
        {visibleTasks.map((task) => (
          <li key={task.id}>
            <strong>{task.title}</strong>
            <select value={task.status} onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}>
              <option value="TODO">TODO</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="DONE">DONE</option>
            </select>
          </li>
        ))}
      </ul>
    </section>
  );
};
