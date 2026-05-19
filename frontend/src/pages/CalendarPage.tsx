import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { api } from "../api/client";
import {
  eventOnDay,
  fetchRangeForView,
  localDayKey,
  periodTitle,
  shiftAnchor,
  type CalendarView,
} from "../lib/calendarDate";

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

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function fmtWhen(ev: CalendarEvent) {
  if (ev.allDay) return fmtDate(ev.start);
  return `${fmtDate(ev.start)} · ${fmtTime(ev.start)} – ${fmtTime(ev.end)}`;
}

function compareEvents(a: CalendarEvent, b: CalendarEvent) {
  return new Date(a.start).getTime() - new Date(b.start).getTime();
}

function chipStyle(ev: CalendarEvent): CSSProperties | undefined {
  if (!ev.color) return undefined;
  return { ["--cal-event-color" as string]: ev.color };
}

function SourceBadge({ source }: { source: "google" | "microsoft" }) {
  const label = source === "google" ? "G" : "M";
  const mod = source === "google" ? "google" : "microsoft";
  return <span className={`cal-source-badge cal-source-badge--${mod}`}>{label}</span>;
}

function sourceLabel(source: "google" | "microsoft") {
  return source === "google" ? "Google Calendar" : "Outlook";
}

export const CalendarPage = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [focusDay, setFocusDay] = useState<Date | null>(null);
  const [hasCalendarAccount, setHasCalendarAccount] = useState<boolean | null>(null);

  const load = useCallback(async (anchor: Date, activeView: CalendarView) => {
    setLoading(true);
    setError(null);
    const { start, end } = fetchRangeForView(activeView, anchor);
    try {
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
    void load(viewDate, view);
  }, [viewDate, view, load]);

  useEffect(() => {
    void (async () => {
      try {
        const r = await api.get<{ data?: { accounts: { provider: string }[] } }>("/mail/accounts");
        const accounts = r.data?.data?.accounts ?? [];
        setHasCalendarAccount(
          accounts.some((a) => a.provider === "gmail" || a.provider === "microsoft"),
        );
      } catch {
        setHasCalendarAccount(null);
      }
    })();
  }, []);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayKey = localDayKey(today);

  const sortedEvents = useMemo(() => [...events].sort(compareEvents), [events]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return sortedEvents.filter((e) => new Date(e.end || e.start).getTime() >= now).slice(0, 10);
  }, [sortedEvents]);

  const focusDayEvents = useMemo(() => {
    if (!focusDay) return [];
    return sortedEvents.filter((e) => eventOnDay(e.start, focusDay));
  }, [focusDay, sortedEvents]);

  const eventsForDay = useCallback(
    (day: Date) => sortedEvents.filter((e) => eventOnDay(e.start, day)),
    [sortedEvents],
  );

  const goToday = () => {
    const now = new Date();
    setViewDate(now);
    setFocusDay(now);
  };

  const shiftPeriod = (dir: -1 | 1) => setViewDate((d) => shiftAnchor(view, d, dir));

  const renderEventChip = (ev: CalendarEvent) => (
    <button
      key={ev.id}
      type="button"
      className={`cal-event-chip cal-event-chip--${ev.source}${ev.color ? " cal-event-chip--colored" : ""}`}
      style={chipStyle(ev)}
      onClick={() => setSelectedEvent(ev)}
      title={ev.title}
    >
      <SourceBadge source={ev.source} />
      {!ev.allDay && <span className="cal-chip-time">{fmtTime(ev.start)}</span>}
      <span className="cal-chip-title">{ev.title}</span>
    </button>
  );

  const renderMonthView = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

    const cells: ReactNode[] = [];

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - firstDay + 1;
      const inMonth = dayNum >= 1 && dayNum <= daysInMonth;

      if (!inMonth) {
        cells.push(<div key={`pad-${i}`} className="cal-cell cal-cell--empty cal-cell--pad" />);
        continue;
      }

      const dayDate = new Date(year, month, dayNum);
      const cellKey = localDayKey(dayDate);
      const isToday = cellKey === todayKey;
      const isFocus = focusDay && localDayKey(focusDay) === cellKey;
      const dayEvents = eventsForDay(dayDate);
      const visible = dayEvents.slice(0, 3);
      const extra = dayEvents.length - visible.length;

      cells.push(
        <div
          key={cellKey}
          className={`cal-cell${isToday ? " cal-cell--today cal-day--today" : ""}${isFocus ? " cal-cell--focus" : ""}`}
        >
          <button
            type="button"
            className={`cal-day-num-btn${isToday ? " cal-day-num--today" : ""}`}
            onClick={() => setFocusDay(dayDate)}
          >
            {dayNum}
          </button>
          <div className="cal-cell-events">
            {visible.map((ev) => renderEventChip(ev))}
            {extra > 0 ? (
              <button type="button" className="cal-more-chip" onClick={() => setFocusDay(dayDate)}>
                +{extra} more
              </button>
            ) : null}
          </div>
        </div>,
      );
    }

    return (
      <div className="cal-month-grid">
        {DAY_NAMES.map((d) => (
          <div key={d} className="cal-weekday-header">
            {d}
          </div>
        ))}
        {cells}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = new Date(viewDate);
    weekStart.setDate(viewDate.getDate() - viewDate.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const days: ReactNode[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const isToday = localDayKey(d) === todayKey;
      const dayEvs = eventsForDay(d);

      days.push(
        <div
          key={localDayKey(d)}
          className={`cal-week-day${isToday ? " cal-week-day--today" : ""}${focusDay && localDayKey(focusDay) === localDayKey(d) ? " cal-week-day--focus" : ""}`}
        >
          <button type="button" className="cal-week-day-header" onClick={() => setFocusDay(d)}>
            <span className="cal-week-day-name">{DAY_NAMES[i]}</span>
            <span className={`cal-week-day-num${isToday ? " cal-day-num--today" : ""}`}>{d.getDate()}</span>
          </button>
          <div className="cal-week-events">
            {dayEvs.map((ev) => (
              <button
                key={ev.id}
                type="button"
                className={`cal-event-pill cal-event-pill--${ev.source}${ev.color ? " cal-event-pill--colored" : ""}`}
                style={chipStyle(ev)}
                onClick={() => setSelectedEvent(ev)}
              >
                <span className="cal-pill-time">{ev.allDay ? "All day" : fmtTime(ev.start)}</span>
                <span className="cal-pill-title">{ev.title}</span>
              </button>
            ))}
            {dayEvs.length === 0 ? <span className="cal-day-empty">No events</span> : null}
          </div>
        </div>,
      );
    }

    return <div className="cal-week-grid">{days}</div>;
  };

  const renderListView = () => {
    if (sortedEvents.length === 0) {
      return <p className="cal-empty">No events in this period.</p>;
    }
    let lastDate = "";
    return (
      <div className="cal-list">
        {sortedEvents.map((ev) => {
          const dateLabel = fmtDate(ev.start);
          const showHeader = dateLabel !== lastDate;
          lastDate = dateLabel;
          return (
            <div key={ev.id}>
              {showHeader ? <div className="cal-list-date-sep">{dateLabel}</div> : null}
              <button type="button" className="cal-list-row" onClick={() => setSelectedEvent(ev)}>
                <span className="cal-list-time cal-list-time-big">
                  {ev.allDay ? "All day" : fmtTime(ev.start)}
                </span>
                <div className="cal-list-body">
                  <span className="cal-list-title">{ev.title}</span>
                  {ev.calendarName ? <span className="cal-list-cal">{ev.calendarName}</span> : null}
                  {ev.location ? <span className="cal-list-loc">{ev.location}</span> : null}
                </div>
                <span className={`cal-list-source-badge cal-list-source-badge--${ev.source}`}>
                  {ev.source === "google" ? "Google" : "Outlook"}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const sidebarEvents = focusDay ? focusDayEvents : upcomingEvents;
  const sidebarTitle = focusDay
    ? focusDay.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
    : "Up next";

  return (
    <div className="page calendar-page">
      <div className="page-titlebar flex-wrap gap-3 align-items-center">
        <div className="flex-shrink-0">
          <h1 className="page-title mb-0">Calendar</h1>
          <p className="page-subtitle mb-0">Google & Outlook in one place</p>
        </div>
        <div className="page-actions flex-wrap justify-content-start justify-content-md-end">
          <button type="button" className="btn-ghost btn-sm" onClick={goToday}>
            Today
          </button>
          <div className="cal-nav">
            <button type="button" className="btn-ghost btn-sm cal-nav-btn" onClick={() => shiftPeriod(-1)}>
              ‹
            </button>
            <span className="cal-month-label">{periodTitle(view, viewDate)}</span>
            <button type="button" className="btn-ghost btn-sm cal-nav-btn" onClick={() => shiftPeriod(1)}>
              ›
            </button>
          </div>
          <div className="cal-view-toggle">
            {(["month", "week", "list"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={`btn-ghost btn-sm${view === v ? " active" : ""}`}
                onClick={() => setView(v)}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {hasCalendarAccount === false && !loading && (
        <div className="cal-connect-banner">
          Connect Gmail or Microsoft in Mail to see your calendars here.
        </div>
      )}

      {error ? <p className="page-error">{error}</p> : null}
      {loading ? <p className="page-loading">Loading events…</p> : null}

      {!loading ? (
        <div className="cal-layout">
          <div className="cal-main">
            {view === "month" ? renderMonthView() : null}
            {view === "week" ? renderWeekView() : null}
            {view === "list" ? renderListView() : null}
          </div>

          <aside className="cal-sidebar">
            <div className="cal-sidebar-header">
              <h2 className="cal-sidebar-title">{sidebarTitle}</h2>
              {focusDay ? (
                <button type="button" className="btn-ghost btn-sm" onClick={() => setFocusDay(null)}>
                  Show upcoming
                </button>
              ) : null}
            </div>
            <div className="cal-sidebar-events">
              {sidebarEvents.length === 0 ? (
                <p className="cal-sidebar-empty">Nothing scheduled</p>
              ) : (
                sidebarEvents.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    className={`cal-sidebar-event cal-sidebar-event--${ev.source}`}
                    style={chipStyle(ev)}
                    onClick={() => setSelectedEvent(ev)}
                  >
                    <span className="cal-sidebar-event-time">
                      {ev.allDay ? "All day" : fmtTime(ev.start)}
                    </span>
                    <span className="cal-sidebar-event-title">{ev.title}</span>
                    {ev.location ? <span className="cal-sidebar-event-loc">{ev.location}</span> : null}
                  </button>
                ))
              )}
            </div>
            {!focusDay && sortedEvents.length > 0 ? (
              <p className="cal-sidebar-foot">{sortedEvents.length} events in range</p>
            ) : null}
          </aside>
        </div>
      ) : null}

      {selectedEvent ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedEvent(null)}>
          <div className="modal-card" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{selectedEvent.title}</h2>
              <button type="button" className="modal-close" onClick={() => setSelectedEvent(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="cal-detail-row">
                <span className="cal-detail-label">When</span>
                <span>{fmtWhen(selectedEvent)}</span>
              </div>
              {selectedEvent.location ? (
                <div className="cal-detail-row">
                  <span className="cal-detail-label">Where</span>
                  <span>{selectedEvent.location}</span>
                </div>
              ) : null}
              {selectedEvent.calendarName ? (
                <div className="cal-detail-row">
                  <span className="cal-detail-label">Calendar</span>
                  <span>{selectedEvent.calendarName}</span>
                </div>
              ) : null}
              <div className="cal-detail-row">
                <span className="cal-detail-label">Source</span>
                <span>{sourceLabel(selectedEvent.source)}</span>
              </div>
              {selectedEvent.description ? (
                <div className="cal-detail-desc">{selectedEvent.description}</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
