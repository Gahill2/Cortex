import type { WidgetRenderProps } from "../types";
import { useDashboardDataContext } from "../hooks/useDashboardDataContext";
import { PdSectionHeader } from "../../components/ui/PdSectionHeader";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function DailyAgendaWidget(_props: WidgetRenderProps) {
  const { todayEvents, eventsLoading, eventsError } = useDashboardDataContext();
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const timed = todayEvents.filter((e) => !e.allDay).slice(0, 5);

  return (
    <div className="pd-widget pd-widget--agenda">
      <PdSectionHeader title="Daily agenda" eyebrow="Plan" subtitle="Timeline" />
      {eventsError ? <p className="pd-widget-empty">{eventsError}</p> : null}
      <div className="pd-timeline">
        <div className="pd-timeline__hours" aria-hidden>
          {Array.from({ length: 10 }, (_, i) => i + 8).map((h) => (
            <span key={h}>{h}:00</span>
          ))}
        </div>
        <div className="pd-timeline__track">
          <div className="pd-timeline__now" style={{ top: `${((hour - 8) / 10) * 100}%` }} />
          {eventsLoading ? (
            <p className="pd-widget-empty">Loading events…</p>
          ) : timed.length === 0 ? (
            <p className="pd-widget-empty">No events today</p>
          ) : (
            timed.map((ev, i) => (
              <article
                key={ev.id}
                className="pd-timeline__event"
                style={{
                  top: `${12 + i * 22}%`,
                  borderLeftColor: ev.color ?? "var(--accent)",
                }}
              >
                <span className="pd-timeline__event-time">{formatTime(ev.start)}</span>
                <span className="pd-timeline__event-title">{ev.title}</span>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
