import { useMemo } from "react";
import type { WidgetRenderProps } from "../types";
import { useDashboardDataContext } from "../hooks/useDashboardDataContext";
import { PdSectionHeader } from "../../components/ui/PdSectionHeader";

export function UpcomingWidget(props: WidgetRenderProps) {
  const { tasks, todayEvents, tasksLoading, eventsLoading } = useDashboardDataContext();

  const groups = useMemo(() => {
    const today = tasks.filter((t) => t.group === "today" && !t.completed).map((t) => t.title);
    const upcoming = tasks.filter((t) => t.group === "upcoming" && !t.completed).map((t) => t.title);
    const laterEvents = todayEvents
      .filter((e) => new Date(e.start) > new Date())
      .slice(0, 4)
      .map((e) => e.title);
    return [
      { label: "Today", items: today.slice(0, 4) },
      { label: "Upcoming", items: [...upcoming.slice(0, 3), ...laterEvents].slice(0, 5) },
    ].filter((g) => g.items.length > 0);
  }, [tasks, todayEvents]);

  const loading = tasksLoading || eventsLoading;

  return (
    <div className="pd-widget pd-widget--upcoming">
      <PdSectionHeader title="Upcoming" />
      {loading ? (
        <p className="pd-widget-empty">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="pd-widget-empty">Nothing scheduled ahead</p>
      ) : (
        groups.map((g) => (
          <section key={g.label} className="pd-upcoming-group">
            <h4>{g.label}</h4>
            <ul className="pd-agenda-list">
              {g.items.map((item) => (
                <li key={`${g.label}-${item}`} className="pd-agenda-item">
                  <span className="pd-agenda-item__dot" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {props.onNavigate ? (
        <button type="button" className="pd-widget-link" onClick={() => props.onNavigate!("calendar")}>
          Open Calendar →
        </button>
      ) : null}
    </div>
  );
}
