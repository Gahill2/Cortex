import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { TccIconSparkles } from "./TccIcons";
import { buildFocusSuggestion } from "./focusSuggestion";
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

function fmtRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime())) return "";
  const day = s.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const t1 = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const t2 = e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${t1} – ${t2}`;
}

export function TasksCalendarFocusPanel({
  selectedTask,
  selectedEvent,
  tasks,
  events,
}: Props) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);

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

  useEffect(() => {
    const date = new Date().toISOString().split("T")[0];
    const fallback = buildFocusSuggestion(tasks, events);
    setSuggestionLoading(true);
    void api
      .get("/ai/meeting-prep", { params: { date } })
      .then((r) => {
        const payload = (r.data?.data ?? r.data) as { summary?: string; briefing?: string };
        const text = payload?.summary?.trim() || payload?.briefing?.trim();
        setSuggestion(text || fallback);
      })
      .catch(() => setSuggestion(fallback))
      .finally(() => setSuggestionLoading(false));
  }, [tasks, events]);

  return (
    <aside className="tcc-detail" aria-label="Today focus">
      <h2 className="tcc-detail-title">Today&apos;s Focus</h2>

      {selectedEvent ? (
        <div className="tcc-detail-block tcc-detail-block--event">
          <p className="tcc-detail-label">Selected event</p>
          <p className="tcc-detail-value">{selectedEvent.title}</p>
          <p className="tcc-detail-muted">{fmtRange(selectedEvent.start, selectedEvent.end)}</p>
          {selectedEvent.location ? (
            <p className="tcc-detail-muted">{selectedEvent.location}</p>
          ) : null}
          {selectedEvent.calendarName ? (
            <p className="tcc-detail-muted">{selectedEvent.calendarName}</p>
          ) : null}
        </div>
      ) : null}

      <div className="tcc-detail-block">
        <p className="tcc-detail-label">Main priority</p>
        {mainPriority ? (
          <>
            <p className="tcc-detail-value">{mainPriority.title}</p>
            <p className="tcc-detail-muted">
              {mainPriority.category}
              {mainPriority.projectName ? ` · ${mainPriority.projectName}` : ""} · {mainPriority.priority}
            </p>
          </>
        ) : (
          <p className="tcc-detail-muted">No priority set</p>
        )}
      </div>

      <div className="tcc-detail-block">
        <p className="tcc-detail-label">Next event</p>
        {selectedEvent ? (
          <p className="tcc-detail-muted">See selected event above</p>
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
          {suggestionLoading ? "Analyzing your calendar…" : suggestion ?? buildFocusSuggestion(tasks, events)}
        </p>
      </div>
    </aside>
  );
}
