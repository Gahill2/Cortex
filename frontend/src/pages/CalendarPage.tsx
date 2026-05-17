import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  description?: string;
  source: "google" | "microsoft";
  calendarName?: string;
  color?: string;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function SourceBadge({ source, className }: { source: "google" | "microsoft"; className?: string }) {
  const label = source === "google" ? "G" : "M";
  const mod   = source === "google" ? "google" : "microsoft";
  return (
    <span className={`cal-source-badge cal-source-badge--${mod}${className ? ` ${className}` : ""}`}>
      {label}
    </span>
  );
}

function sourceTag(source: "google" | "microsoft") {
  if (source === "google") return <span className="cal-event-source cal-event-source--google">G</span>;
  return <span className="cal-event-source cal-event-source--microsoft">⊞</span>;
}

export const CalendarPage = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "list">("month");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const load = useCallback(async (year: number, month: number) => {
    setLoading(true);
    setError(null);
    try {
      const start = new Date(year, month - 1, 1).toISOString();
      const end   = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const r = await api.get("/calendar/events", { params: { start, end } });
      const evs: CalendarEvent[] = r.data?.data?.events ?? r.data?.events ?? [];
      setEvents(evs);
    } catch {
      setError("Could not load calendar events.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(viewDate.getFullYear(), viewDate.getMonth() + 1);
  }, [viewDate, load]);

  const prevMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday   = () => setViewDate(new Date());

  // ── Month grid ──────────────────────────────────────────────────────────────
  const renderMonthView = () => {
    const year  = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

    const cells: React.ReactNode[] = [];

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="cal-cell cal-cell--empty" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cellKey  = `${year}-${month}-${day}`;
      const isToday  = cellKey === todayKey;

      const allDayEvents = events.filter((e) => {
        const evDate = new Date(e.start);
        return evDate.getFullYear() === year && evDate.getMonth() === month && evDate.getDate() === day;
      });

      const visibleEvents = allDayEvents.slice(0, 3);
      const extraCount    = allDayEvents.length - visibleEvents.length;

      cells.push(
        <div key={cellKey} className={`cal-cell ${isToday ? "cal-cell--today cal-day--today" : ""}`}>
          <span className={`cal-day-num${isToday ? " cal-day-num--today" : ""}`}>{day}</span>
          <div className="cal-cell-events">
            {visibleEvents.map((ev) => (
              <button
                key={ev.id}
                className={`cal-event-chip cal-event-chip--${ev.source}`}
                onClick={() => setSelectedEvent(ev)}
                title={ev.title}
              >
                <SourceBadge source={ev.source} />
                {!ev.allDay && <span className="cal-chip-time">{fmtTime(ev.start)} </span>}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</span>
              </button>
            ))}
            {extraCount > 0 && (
              <button className="cal-more-chip" onClick={() => setView("list")}>
                +{extraCount} more
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="cal-month-grid">
        {DAY_NAMES.map((d) => <div key={d} className="cal-weekday-header">{d}</div>)}
        {cells}
      </div>
    );
  };

  // ── Week view ───────────────────────────────────────────────────────────────
  const renderWeekView = () => {
    const startOfWeek = new Date(viewDate);
    startOfWeek.setDate(viewDate.getDate() - viewDate.getDay());

    const days: React.ReactNode[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const isToday = d.toDateString() === new Date().toDateString();
      const dayEvs = events.filter((e) => new Date(e.start).toDateString() === d.toDateString());

      days.push(
        <div key={i} className={`cal-week-day ${isToday ? "cal-week-day--today" : ""}`}>
          <div className="cal-week-day-header">
            <span className="cal-week-day-name">{DAY_NAMES[i]}</span>
            <span className={`cal-week-day-num ${isToday ? "cal-day-num--today" : ""}`}>{d.getDate()}</span>
          </div>
          <div className="cal-week-events">
            {dayEvs.map((ev) => (
              <button key={ev.id} className={`cal-event-pill cal-event-pill--${ev.source}`} onClick={() => setSelectedEvent(ev)}>
                <span className="cal-pill-time">{ev.allDay ? "All day" : fmtTime(ev.start)}</span>
                <span className="cal-pill-title">{ev.title}</span>
              </button>
            ))}
            {dayEvs.length === 0 && <span className="cal-day-empty">—</span>}
          </div>
        </div>
      );
    }

    return <div className="cal-week-grid">{days}</div>;
  };

  // ── List view ───────────────────────────────────────────────────────────────
  const renderListView = () => {
    const sorted = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    if (sorted.length === 0) {
      return <p className="cal-empty">No events this month.</p>;
    }
    let lastDate = "";
    return (
      <div className="cal-list">
        {sorted.map((ev) => {
          const dateLabel = fmtDate(ev.start);
          const showHeader = dateLabel !== lastDate;
          lastDate = dateLabel;
          return (
            <div key={ev.id}>
              {showHeader && <div className="cal-list-date-sep">{dateLabel}</div>}
              <button className="cal-list-row" onClick={() => setSelectedEvent(ev)}>
                <div className="cal-list-time cal-list-time-big">
                  {ev.allDay ? "All day" : fmtTime(ev.start)}
                </div>
                <div className="cal-list-body">
                  <span className="cal-list-title">{ev.title}</span>
                  {ev.calendarName && <span className="cal-list-cal">{ev.calendarName}</span>}
                </div>
                <span className={`cal-list-source-badge cal-list-source-badge--${ev.source}`}>
                  {ev.source === "google" ? "Google" : "Outlook"}
                </span>
                {sourceTag(ev.source)}
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="page calendar-page">
      <div className="page-titlebar flex-wrap gap-3 align-items-center">
        <div className="flex-shrink-0">
          <h1 className="page-title mb-0">Calendar</h1>
        </div>
        <div className="page-actions flex-wrap justify-content-start justify-content-md-end">
          <button className="btn-ghost btn-sm" onClick={goToday}>Today</button>
          <div className="cal-nav">
            <button className="btn-ghost btn-sm cal-nav-btn" onClick={prevMonth}>‹</button>
            <span className="cal-month-label">{MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
            <button className="btn-ghost btn-sm cal-nav-btn" onClick={nextMonth}>›</button>
          </div>
          <div className="cal-view-toggle">
            {(["month","week","list"] as const).map((v) => (
              <button key={v} className={`btn-ghost btn-sm ${view === v ? "active" : ""}`} onClick={() => setView(v)}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="page-error">{error}</p>}
      {loading && <p className="page-loading">Loading events…</p>}

      {!loading && (
        <>
          {view === "month" && renderMonthView()}
          {view === "week"  && renderWeekView()}
          {view === "list"  && renderListView()}
        </>
      )}

      {/* Event detail modal */}
      {selectedEvent && (
        <div className="modal-backdrop" onClick={() => setSelectedEvent(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{selectedEvent.title}</h2>
              <button className="modal-close" onClick={() => setSelectedEvent(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="cal-detail-row">
                <span className="cal-detail-label">When</span>
                <span>{selectedEvent.allDay ? fmtDate(selectedEvent.start) : `${fmtDate(selectedEvent.start)} · ${fmtTime(selectedEvent.start)} – ${fmtTime(selectedEvent.end)}`}</span>
              </div>
              {selectedEvent.location && (
                <div className="cal-detail-row">
                  <span className="cal-detail-label">Where</span>
                  <span>{selectedEvent.location}</span>
                </div>
              )}
              {selectedEvent.calendarName && (
                <div className="cal-detail-row">
                  <span className="cal-detail-label">Calendar</span>
                  <span>{selectedEvent.calendarName}</span>
                </div>
              )}
              <div className="cal-detail-row">
                <span className="cal-detail-label">Source</span>
                <span className="cal-detail-source">{sourceTag(selectedEvent.source)} {selectedEvent.source === "google" ? "Google Calendar" : "Outlook Calendar"}</span>
              </div>
              {selectedEvent.description && (
                <div className="cal-detail-desc">{selectedEvent.description}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
