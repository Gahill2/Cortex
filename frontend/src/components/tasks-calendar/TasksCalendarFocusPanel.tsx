import { TccIconSparkles } from "./TccIcons";
import type { PlannerEvent, PlannerTask } from "./types";

interface Props {
  selectedTask: PlannerTask | null;
  selectedEvent: PlannerEvent | null;
  tasks: PlannerTask[];
  events: PlannerEvent[];
}

function nextEvent(events: PlannerEvent[]): PlannerEvent | null {
  const now = Date.now();
  const upcoming = events
    .filter((e) => new Date(e.start).getTime() >= now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return upcoming[0] ?? null;
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TasksCalendarFocusPanel({
  selectedTask,
  selectedEvent,
  tasks,
  events,
}: Props) {
  const completed = tasks.filter((t) => t.completed).length;
  const meetingsToday = events.filter((e) => {
    const d = new Date(e.start);
    const t = new Date();
    return d.toDateString() === t.toDateString();
  }).length;
  const focusHours = 2.5;
  const mainPriority =
    selectedTask ??
    tasks.find((t) => t.group === "today" && !t.completed && t.priority === "HIGH") ??
    tasks.find((t) => t.group === "today" && !t.completed) ??
    null;
  const upcoming = nextEvent(events);

  return (
    <aside className="tcc-detail" aria-label="Today focus">
      <h2 className="tcc-detail-title">Today&apos;s Focus</h2>

      <div className="tcc-detail-block">
        <p className="tcc-detail-label">Main priority</p>
        {mainPriority ? (
          <>
            <p className="tcc-detail-value">{mainPriority.title}</p>
            <p className="tcc-detail-muted">{mainPriority.category} · {mainPriority.priority}</p>
          </>
        ) : (
          <p className="tcc-detail-muted">No priority set</p>
        )}
      </div>

      <div className="tcc-detail-block">
        <p className="tcc-detail-label">Next event</p>
        {selectedEvent ? (
          <>
            <p className="tcc-detail-value">{selectedEvent.title}</p>
            <p className="tcc-detail-muted">{fmtWhen(selectedEvent.start)}</p>
          </>
        ) : upcoming ? (
          <>
            <p className="tcc-detail-value">{upcoming.title}</p>
            <p className="tcc-detail-muted">{fmtWhen(upcoming.start)}</p>
          </>
        ) : (
          <p className="tcc-detail-muted">Nothing scheduled</p>
        )}
      </div>

      <div className="tcc-stats">
        <div className="tcc-stat">
          <span className="tcc-stat-num">{completed}</span>
          <span className="tcc-stat-label">Tasks done</span>
        </div>
        <div className="tcc-stat">
          <span className="tcc-stat-num">{meetingsToday}</span>
          <span className="tcc-stat-label">Meetings</span>
        </div>
        <div className="tcc-stat">
          <span className="tcc-stat-num">{focusHours}h</span>
          <span className="tcc-stat-label">Focus time</span>
        </div>
      </div>

      {selectedTask?.notes ? (
        <div className="tcc-detail-block">
          <p className="tcc-detail-label">Notes</p>
          <p className="tcc-detail-notes">{selectedTask.notes}</p>
        </div>
      ) : null}

      <div className="tcc-ai-card">
        <div className="tcc-ai-card-head">
          <TccIconSparkles />
          <span>AI Suggestion</span>
        </div>
        <p className="tcc-ai-card-body">
          {/* TODO: POST /ai/planner/suggest */}
          You have a 2-hour gap after work. This may be a good time to work on Cortex or go to
          the gym.
        </p>
      </div>
    </aside>
  );
}
