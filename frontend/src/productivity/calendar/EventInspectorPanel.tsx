import { Calendar, CheckSquare, MapPin, Trash2 } from "lucide-react";
import type { PlannerEvent, PlannerTask } from "../../components/tasks-calendar/types";
import { EmptyState } from "../shared/EmptyState";

interface Props {
  selectedEvent: PlannerEvent | null;
  selectedTask: PlannerTask | null;
  onDeleteTask?: (id: string) => void;
  onToggleTask?: (id: string) => void;
}

function fmtRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const day = s.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const t1 = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const t2 = e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${t1} – ${t2}`;
}

export function EventInspectorPanel({ selectedEvent, selectedTask, onDeleteTask, onToggleTask }: Props) {
  if (!selectedEvent && !selectedTask) {
    return (
      <div className="pd-inspector pd-inspector--empty">
        <EmptyState
          icon={Calendar}
          title="Nothing selected"
          message="Choose an event or task to see details, notes, and quick actions."
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

  if (!selectedTask) return null;

  return (
    <div className="pd-inspector">
      <p className="pd-inspector__eyebrow">Task</p>
      <h2 className={`pd-inspector__title${selectedTask.completed ? " pd-inspector__title--done" : ""}`}>
        {selectedTask.title}
      </h2>
      <p className="pd-inspector__meta">
        {selectedTask.category}
        {selectedTask.projectName ? ` · ${selectedTask.projectName}` : ""}
      </p>
      <span className={`pd-inspector__chip pd-inspector__chip--${selectedTask.priority.toLowerCase()}`}>
        {selectedTask.priority}
      </span>
      {selectedTask.notes ? <p className="pd-inspector__notes">{selectedTask.notes}</p> : null}
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
