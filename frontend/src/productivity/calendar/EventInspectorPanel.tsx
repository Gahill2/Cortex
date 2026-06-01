import { useEffect, useState } from "react";
import { Calendar, CheckSquare, Flag, Link2, MapPin, Trash2 } from "lucide-react";
import type { PlannerEvent, PlannerTask, TaskPriority } from "../../components/tasks-calendar/types";
import type { CortexGoal } from "../../lib/uiCustomization";
import { goalProgress } from "../../lib/uiCustomization";
import { EmptyState } from "../shared/EmptyState";
import { TaskProgressControl } from "../tasks/TaskProgressControl";
import { parseProgressFromNotes } from "../tasks/taskProgressGroups";

interface ProjectOption {
  id: string;
  name: string;
}

interface Props {
  selectedEvent: PlannerEvent | null;
  selectedTask: PlannerTask | null;
  selectedGoal?: CortexGoal | null;
  projects?: ProjectOption[];
  onDeleteTask?: (id: string) => void;
  onToggleTask?: (id: string) => void;
  onToggleGoal?: (id: string) => void;
  onUpdateGoal?: (id: string, patch: Partial<CortexGoal>) => void;
  onDeleteGoal?: (id: string) => void;
  onUpdateTask?: (
    id: string,
    patch: {
      title?: string;
      description?: string | null;
      status?: PlannerTask["status"];
      priority?: TaskPriority;
      progressPercent?: number;
      dueDate?: string | null;
      planStart?: string | null;
      planEnd?: string | null;
      syncToCalendar?: boolean;
      projectId?: string;
    },
  ) => void | Promise<{ calendarError?: string } | void>;
}

function fmtRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const day = s.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const t1 = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const t2 = e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${t1} – ${t2}`;
}

function toDateInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function toTimeInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function combineDateAndTime(date: string, time: string): string | null {
  if (!date) return null;
  if (!time) return new Date(`${date}T12:00:00`).toISOString();
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function EventInspectorPanel({
  selectedEvent,
  selectedTask,
  selectedGoal = null,
  projects = [],
  onDeleteTask,
  onToggleTask,
  onToggleGoal,
  onUpdateGoal,
  onDeleteGoal,
  onUpdateTask,
}: Props) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [status, setStatus] = useState<PlannerTask["status"]>("TODO");
  const [dueDate, setDueDate] = useState("");
  const [planStartTime, setPlanStartTime] = useState("");
  const [planEndTime, setPlanEndTime] = useState("");
  const [syncToCalendar, setSyncToCalendar] = useState(true);
  const [progressPercent, setProgressPercent] = useState(0);
  const [projectId, setProjectId] = useState("");
  const [calendarNote, setCalendarNote] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTask) return;
    setTitle(selectedTask.title);
    setNotes(selectedTask.notes ?? "");
    setPriority(selectedTask.priority);
    setStatus(selectedTask.status ?? "TODO");
    setProgressPercent(selectedTask.progressPercent ?? 0);
    setDueDate(selectedTask.hasDueDate ? toDateInput(selectedTask.dueAt) : "");
    setPlanStartTime(toTimeInput(selectedTask.planStart));
    setPlanEndTime(toTimeInput(selectedTask.planEnd));
    setSyncToCalendar(selectedTask.syncToCalendar ?? true);
    setProjectId(selectedTask.projectId ?? "");
    setCalendarNote(null);
  }, [selectedTask]);

  useEffect(() => {
    if (!selectedGoal) return;
    setTitle(selectedGoal.text);
    setNotes("");
    setProgressPercent(goalProgress(selectedGoal));
    setDueDate(selectedGoal.targetDate ? toDateInput(selectedGoal.targetDate) : "");
    setCalendarNote(null);
  }, [selectedGoal]);

  if (!selectedEvent && !selectedTask && !selectedGoal) {
    return (
      <div className="pd-inspector pd-inspector--empty">
        <EmptyState
          icon={Calendar}
          title="Nothing selected"
          message="Select a task or goal. Set progress with the steps, slider, or “progress: 50” in notes."
        />
      </div>
    );
  }

  if (selectedEvent) {
    return (
      <div className="pd-inspector">
        <p className="pd-inspector__eyebrow">Event</p>
        <h2 className="pd-inspector__title">{selectedEvent.title}</h2>
        <p className="pd-inspector__meta">{fmtRange(selectedEvent.start, selectedEvent.end)}</p>
        {selectedEvent.category ? (
          <span className="pd-inspector__chip">{selectedEvent.category}</span>
        ) : null}
        {selectedEvent.location ? (
          <p className="pd-inspector__row">
            <MapPin size={14} /> {selectedEvent.location}
          </p>
        ) : null}
        {selectedEvent.description ? (
          <p className="pd-inspector__notes">{selectedEvent.description}</p>
        ) : null}
      </div>
    );
  }

  if (selectedGoal && !selectedTask) {
    const pct = goalProgress(selectedGoal);
    return (
      <div className="pd-inspector pd-inspector--task">
        <p className="pd-inspector__eyebrow">
          <Flag size={12} aria-hidden /> Goal
        </p>
        <label className="pd-inspector__field">
          Title
          <input
            className="pd-inspector__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => onUpdateGoal?.(selectedGoal.id, { text: title.trim() })}
          />
        </label>
        <label className="pd-inspector__field">
          Your progress (%)
          <input
            type="number"
            min={0}
            max={100}
            className="pd-inspector__input"
            value={progressPercent}
            disabled={selectedGoal.done}
            onChange={(e) => {
              const next = Math.min(100, Math.max(0, Number(e.target.value) || 0));
              setProgressPercent(next);
              onUpdateGoal?.(selectedGoal.id, {
                progressPercent: next,
                done: next >= 100,
              });
            }}
          />
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={pct}
          disabled={selectedGoal.done}
          className="pd-inspector__range"
          onChange={(e) => {
            const next = Number(e.target.value);
            setProgressPercent(next);
            onUpdateGoal?.(selectedGoal.id, { progressPercent: next, done: false });
          }}
        />
        <label className="pd-inspector__field">
          Target date (optional)
          <input
            type="date"
            className="pd-inspector__input"
            value={dueDate}
            onChange={(e) => {
              setDueDate(e.target.value);
              onUpdateGoal?.(selectedGoal.id, {
                targetDate: e.target.value
                  ? new Date(`${e.target.value}T12:00:00`).toISOString()
                  : null,
              });
            }}
          />
        </label>
        <div className="pd-inspector__actions">
          {onToggleGoal ? (
            <button type="button" className="pd-btn pd-btn--ghost pd-btn--sm" onClick={() => onToggleGoal(selectedGoal.id)}>
              <CheckSquare size={14} />
              {selectedGoal.done ? "Mark incomplete" : "Complete"}
            </button>
          ) : null}
          {onDeleteGoal ? (
            <button type="button" className="pd-btn pd-btn--danger pd-btn--sm" onClick={() => onDeleteGoal(selectedGoal.id)}>
              <Trash2 size={14} />
              Remove
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (!selectedTask) return null;

  const save = async (extra?: Parameters<NonNullable<typeof onUpdateTask>>[1]) => {
    if (!onUpdateTask || !title.trim()) return;
    const planStart = dueDate && planStartTime ? combineDateAndTime(dueDate, planStartTime) : null;
    const planEnd = dueDate && planEndTime ? combineDateAndTime(dueDate, planEndTime) : null;
    const result = await onUpdateTask(selectedTask.id, {
      title: title.trim(),
      description: notes.trim() || null,
      priority,
      status,
      progressPercent,
      dueDate: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
      planStart,
      planEnd,
      syncToCalendar,
      projectId: projectId || undefined,
      ...extra,
    });
    if (result && "calendarError" in result && result.calendarError) {
      setCalendarNote(result.calendarError);
    } else if (dueDate && syncToCalendar) {
      setCalendarNote(selectedTask.googleEventId ? "Updated on Google Calendar" : "Scheduled on Google Calendar");
    }
  };

  return (
    <div className="pd-inspector pd-inspector--task">
      <p className="pd-inspector__eyebrow">Task</p>
      <label className="pd-inspector__field">
        Title
        <input
          className="pd-inspector__input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void save()}
        />
      </label>
      <label className="pd-inspector__field">
        Your progress (%)
        <input
          type="number"
          min={0}
          max={100}
          className="pd-inspector__input"
          value={progressPercent}
          onChange={(e) => {
            const next = Math.min(100, Math.max(0, Number(e.target.value) || 0));
            const nextStatus =
              next >= 100 ? "DONE" : next > 0 ? "IN_PROGRESS" : "TODO";
            setProgressPercent(next);
            setStatus(nextStatus);
            void save({ progressPercent: next, status: nextStatus });
          }}
        />
      </label>
      <TaskProgressControl
        progressPercent={progressPercent}
        status={status}
        onChange={(nextProgress, nextStatus) => {
          setProgressPercent(nextProgress);
          setStatus(nextStatus);
          void save({ progressPercent: nextProgress, status: nextStatus });
        }}
      />
      <label className="pd-inspector__field">
        Due date <span className="pd-inspector__optional">(optional)</span>
        <input
          type="date"
          className="pd-inspector__input"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          onBlur={() => void save()}
        />
      </label>
      {dueDate ? (
        <div className="pd-inspector__field-row">
          <label className="pd-inspector__field">
            Start time
            <input
              type="time"
              className="pd-inspector__input"
              value={planStartTime}
              onChange={(e) => setPlanStartTime(e.target.value)}
              onBlur={() => void save()}
            />
          </label>
          <label className="pd-inspector__field">
            End time
            <input
              type="time"
              className="pd-inspector__input"
              value={planEndTime}
              onChange={(e) => setPlanEndTime(e.target.value)}
              onBlur={() => void save()}
            />
          </label>
        </div>
      ) : null}
      <label className="pd-inspector__check">
        <input
          type="checkbox"
          checked={syncToCalendar}
          onChange={(e) => {
            const next = e.target.checked;
            setSyncToCalendar(next);
            void save({ syncToCalendar: next });
          }}
        />
        Add to Google Calendar when scheduled
      </label>
      {selectedTask.googleEventId ? (
        <p className="pd-inspector__calendar-link">
          <Link2 size={14} aria-hidden />
          Linked to Google Calendar
        </p>
      ) : null}
      {calendarNote ? <p className="pd-inspector__meta">{calendarNote}</p> : null}
      <div className="pd-inspector__field-row">
        <label className="pd-inspector__field">
          Priority
          <select
            className="pd-inspector__input"
            value={priority}
            onChange={(e) => {
              const next = e.target.value as TaskPriority;
              setPriority(next);
              onUpdateTask?.(selectedTask.id, { priority: next });
            }}
          >
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </label>
        <label className="pd-inspector__field">
          Status
          <select
            className="pd-inspector__input"
            value={status}
            onChange={(e) => {
              const next = e.target.value as PlannerTask["status"];
              const progress =
                next === "DONE" ? 100 : next === "IN_PROGRESS" ? Math.max(progressPercent, 25) : 0;
              setStatus(next);
              setProgressPercent(progress);
              void save({ status: next, progressPercent: progress });
            }}
          >
            <option value="TODO">To do</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="DONE">Done</option>
          </select>
        </label>
      </div>
      {projects.length > 0 ? (
        <label className="pd-inspector__field">
          Project
          <select
            className="pd-inspector__input"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              onUpdateTask?.(selectedTask.id, { projectId: e.target.value });
            }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="pd-inspector__field">
        Notes
        <textarea
          className="pd-inspector__textarea"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            const parsed = parseProgressFromNotes(notes);
            if (parsed !== null) {
              const nextStatus =
                parsed >= 100 ? "DONE" : parsed > 0 ? "IN_PROGRESS" : "TODO";
              setProgressPercent(parsed);
              setStatus(nextStatus);
              void save({ progressPercent: parsed, status: nextStatus });
            } else {
              void save();
            }
          }}
          placeholder="Notes… Tip: “progress: 40” sets your %"
        />
      </label>
      <div className="pd-inspector__actions">
        {onToggleTask ? (
          <button type="button" className="pd-btn pd-btn--ghost pd-btn--sm" onClick={() => onToggleTask(selectedTask.id)}>
            <CheckSquare size={14} />
            {selectedTask.completed ? "Mark incomplete" : "Complete"}
          </button>
        ) : null}
        {onDeleteTask ? (
          <button type="button" className="pd-btn pd-btn--danger pd-btn--sm" onClick={() => onDeleteTask(selectedTask.id)}>
            <Trash2 size={14} />
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}
