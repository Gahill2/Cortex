import { FormEvent, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { PlannerTask } from "./types";
import { TaskContextMenu } from "./TaskContextMenu";

const STATUS_COLS: Array<{ key: NonNullable<PlannerTask["status"]>; label: string }> = [
  { key: "TODO", label: "Not started" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "DONE", label: "Completed" },
];

const NEXT: Record<NonNullable<PlannerTask["status"]>, NonNullable<PlannerTask["status"]>> = {
  TODO: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  DONE: "TODO",
};

const PRIORITY_COLORS: Record<PlannerTask["priority"], string> = {
  HIGH: "#ef4444",
  MEDIUM: "#f59e0b",
  LOW: "#6b7280",
};

function taskStatus(task: PlannerTask): NonNullable<PlannerTask["status"]> {
  return task.status ?? (task.completed ? "DONE" : "TODO");
}

function isOverdue(task: PlannerTask) {
  if (task.completed || taskStatus(task) === "DONE") return false;
  return new Date(task.dueAt) < new Date();
}

function fmtDue(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff < 7) return `${diff}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function KanbanCard({
  task,
  onCycle,
  onDelete,
  onSelect,
  onUpdateStatus,
  selected,
}: {
  task: PlannerTask;
  onCycle: (task: PlannerTask) => void;
  onDelete: (id: string) => void;
  onSelect: (task: PlannerTask) => void;
  onUpdateStatus: (id: string, status: NonNullable<PlannerTask["status"]>) => void;
  selected: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const overdue = isOverdue(task);
  const status = taskStatus(task);
  const checked = status === "DONE";

  const card = (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`kanban-card kanban-card--planner kanban-card--priority-${task.priority} ${overdue ? "kanban-card--overdue" : ""} ${isDragging ? "kanban-card--dragging" : ""} ${selected ? "tcc-kanban-card--selected" : ""}`}
      style={{ cursor: isDragging ? "grabbing" : "grab", opacity: isDragging ? 0.35 : 1 }}
      onClick={() => onSelect(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelect(task);
      }}
      role="button"
      tabIndex={0}
    >
      <button
        type="button"
        className={`kanban-check${checked ? " kanban-check--done" : ""}`}
        aria-label={checked ? "Mark not complete" : "Mark complete"}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onCycle(task);
        }}
      />
      <div className="kanban-card-main">
        <div className="kanban-card-top">
          <p className={`kanban-card-title${checked ? " done" : ""}`}>{task.title}</p>
          <button
            type="button"
            className="kanban-card-delete"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
          >
            ×
          </button>
        </div>
        <div className="kanban-card-meta">
          <span className="kanban-card-project">{task.projectName ?? task.category}</span>
          <span className={`kanban-due-badge${overdue ? " kanban-due-badge--overdue" : ""}`}>
            {fmtDue(task.dueAt)}
          </span>
          <span
            className="kanban-priority-dot"
            style={{ background: PRIORITY_COLORS[task.priority] }}
            title={task.priority}
          />
        </div>
      </div>
    </div>
  );

  return (
    <TaskContextMenu task={task} onUpdateStatus={onUpdateStatus} onDelete={onDelete}>
      {card}
    </TaskContextMenu>
  );
}

function KanbanColumn({
  col,
  tasks,
  selectedTaskId,
  onCycle,
  onDelete,
  onSelect,
  onUpdateStatus,
  onQuickAdd,
}: {
  col: (typeof STATUS_COLS)[number];
  tasks: PlannerTask[];
  selectedTaskId: string | null;
  onCycle: (task: PlannerTask) => void;
  onDelete: (id: string) => void;
  onSelect: (task: PlannerTask) => void;
  onUpdateStatus: (id: string, status: NonNullable<PlannerTask["status"]>) => void;
  onQuickAdd: (status: NonNullable<PlannerTask["status"]>, title: string) => Promise<void>;
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
    <div className={`tcc-kanban-col${isOver ? " tcc-kanban-col--over" : ""}`}>
      <div className="tcc-kanban-col-head">
        <span className="tcc-kanban-col-title">{col.label}</span>
        <span className="tcc-kanban-col-count">{tasks.length}</span>
        <button type="button" className="kanban-col-add-btn" onClick={() => setAdding((v) => !v)} aria-label={`Add to ${col.label}`}>
          +
        </button>
      </div>
      <div ref={setNodeRef} className="tcc-kanban-col-body">
        {tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            selected={selectedTaskId === task.id}
            onCycle={onCycle}
            onDelete={onDelete}
            onSelect={onSelect}
            onUpdateStatus={onUpdateStatus}
          />
        ))}
        {adding ? (
          <form className="kanban-quick-add" onSubmit={(e) => void submitQuick(e)}>
            <input
              className="form-input"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="Task title…"
              autoFocus
              disabled={saving}
            />
            <button type="submit" className="btn-primary btn-sm" disabled={saving || !quickTitle.trim()}>
              {saving ? "…" : "Add"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

interface Props {
  tasks: PlannerTask[];
  selectedTaskId: string | null;
  onSelectTask: (task: PlannerTask) => void;
  onUpdateStatus: (id: string, status: NonNullable<PlannerTask["status"]>) => void;
  onDeleteTask: (id: string) => void;
  onQuickAdd: (status: NonNullable<PlannerTask["status"]>, title: string) => Promise<void>;
}

export function TasksCalendarKanban({
  tasks,
  selectedTaskId,
  onSelectTask,
  onUpdateStatus,
  onDeleteTask,
  onQuickAdd,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const activeTask = activeId ? (tasks.find((t) => t.id === activeId) ?? null) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = String(active.id);
    const newStatus = over.id as NonNullable<PlannerTask["status"]>;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || taskStatus(task) === newStatus) return;
    void onUpdateStatus(taskId, newStatus);
  };

  const cycleStatus = (task: PlannerTask) => {
    const current = taskStatus(task);
    void onUpdateStatus(task.id, NEXT[current]);
  };

  return (
    <section className="tcc-card tcc-tasks-card tcc-tasks-card--board" aria-label="Task board">
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="tcc-kanban-board teams-planner-board">
          {STATUS_COLS.map((col) => (
            <KanbanColumn
              key={col.key}
              col={col}
              tasks={tasks.filter((t) => taskStatus(t) === col.key)}
              selectedTaskId={selectedTaskId}
              onCycle={cycleStatus}
              onDelete={onDeleteTask}
              onSelect={onSelectTask}
              onUpdateStatus={onUpdateStatus}
              onQuickAdd={onQuickAdd}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
          {activeTask ? (
            <div className={`kanban-card kanban-card--planner kanban-card--priority-${activeTask.priority} kanban-card--overlay`}>
              <p className="kanban-card-title">{activeTask.title}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </section>
  );
}
