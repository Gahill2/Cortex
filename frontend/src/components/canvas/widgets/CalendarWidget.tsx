import { Calendar } from "lucide-react";
import type { Tab } from "../../../App";
import { useDashboardDataContextOptional } from "../../../productivity-dashboard/hooks/useDashboardDataContext";

export function CalendarWidget({
  onNavigate,
  compact,
}: {
  onNavigate?: (t: Tab) => void;
  compact?: boolean;
}) {
  const data = useDashboardDataContextOptional();
  const limit = compact ? 2 : 4;
  const events = data?.todayEvents ?? [];
  const loading = data?.eventsLoading ?? false;
  const error = data?.eventsError;

  return (
    <div
      className="widget widget--calendar"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => onNavigate?.("calendar")}
      role={onNavigate ? "button" : undefined}
      tabIndex={onNavigate ? 0 : undefined}
    >
      <div className="widget--calendar__head">
        <Calendar size={18} strokeWidth={1.75} aria-hidden />
        <span>Today</span>
      </div>
      {loading ? (
        <p className="widget--calendar__foot">Loading calendar…</p>
      ) : events.length === 0 ? (
        <p className="widget--calendar__foot">
          {error ? "Connect Google or Microsoft in Settings." : "No events today — open Calendar to schedule."}
        </p>
      ) : (
        <ul className="widget--calendar__list">
          {events.slice(0, limit).map((ev) => {
            const start = new Date(ev.start);
            const time = ev.allDay
              ? "All day"
              : start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            return (
              <li key={ev.id} className="widget--calendar__row widget--calendar__row--neutral">
                <span className="widget--calendar__time">{time}</span>
                <span className="widget--calendar__event">{ev.title}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
