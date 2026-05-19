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
  SCHEDULE_END_HOUR,
  SCHEDULE_SLOT_PX,
  SCHEDULE_START_HOUR,
  scheduleSlotCount,
  shiftAnchor,
  startOfWeek,
  startOfWorkWeek,
  type CalendarView,
} from "../lib/calendarDate";
import { formatScheduleHour, layoutTimedEvent } from "../lib/calendarSchedule";

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
const WORK_DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const VIEW_OPTIONS: { id: CalendarView; label: string }[] = [
  { id: "workweek", label: "Work week" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "agenda", label: "Agenda" },
];

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

function sourceLabel(source: "google" | "microsoft") {
  return source === "google" ? "Google Calendar" : "Outlook";
}

export const CalendarPage = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>("workweek");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [focusDay, setFocusDay] = useState<Date | null>(null);
  const [hasCalendarAccount, setHasCalendarAccount] = useState<boolean | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const load = useCallback(async (anchor: Date, activeView: CalendarView) => {
    setLoading(true);
    setError(null);
    setWarnings([]);
    const { start, end } = fetchRangeForView(activeView, anchor);
    try {
      const r = await api.get("/calendar/events", { params: { start, end } });
      const payload = r.data?.data ?? r.data;
      const evs: CalendarEvent[] = payload?.events ?? [];
      const apiWarnings: string[] = Array.isArray(payload?.warnings) ? payload.warnings : [];
      setEvents(evs);
      setWarnings(apiWarnings);
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
    return sortedEvents.filter((e) => new Date(e.end || e.start).getTime() >= now).slice(0, 12);
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

  const renderEventBar = (ev: CalendarEvent) => (
    <button
      key={ev.id}
      type="button"
      className={`cal-event-bar cal-event-bar--${ev.source}${ev.color ? " cal-event-bar--colored" : ""}`}
      style={chipStyle(ev)}
      onClick={() => setSelectedEvent(ev)}
      title={`${ev.title}${ev.allDay ? "" : ` · ${fmtTime(ev.start)}`}`}
    >
      <span className="cal-event-bar-title">{ev.title}</span>
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
      const visible = dayEvents.slice(0, 4);
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
            {visible.map((ev) => renderEventBar(ev))}
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

  const renderScheduleView = (workWeek: boolean) => {
    const weekStart = workWeek ? startOfWorkWeek(viewDate) : startOfWeek(viewDate);
    const dayCount = workWeek ? 5 : 7;
    const dayLabels = workWeek ? WORK_DAY_NAMES : DAY_NAMES;
    const slots = scheduleSlotCount();
    const gridHeight = slots * SCHEDULE_SLOT_PX;

    const days: Date[] = [];
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      days.push(d);
    }

    const hours: number[] = [];
    for (let h = SCHEDULE_START_HOUR; h < SCHEDULE_END_HOUR; h++) hours.push(h);

    const scheduleStyle = { ["--cal-cols" as string]: String(dayCount) } as CSSProperties;

    return (
      <div className="cal-schedule" style={scheduleStyle}>
        <div className="cal-schedule-header">
          <div className="cal-schedule-gutter cal-schedule-gutter--corner" />
          {days.map((d, i) => {
            const isToday = localDayKey(d) === todayKey;
            const isFocus = focusDay && localDayKey(focusDay) === localDayKey(d);
            return (
              <button
                key={localDayKey(d)}
                type="button"
                className={`cal-schedule-dayhead${isToday ? " cal-schedule-dayhead--today" : ""}${isFocus ? " cal-schedule-dayhead--focus" : ""}`}
                onClick={() => setFocusDay(d)}
              >
                <span className="cal-schedule-dayname">{dayLabels[i]}</span>
                <span className={`cal-schedule-daynum${isToday ? " cal-day-num--today" : ""}`}>{d.getDate()}</span>
              </button>
            );
          })}
        </div>

        <div className="cal-schedule-allday">
          <div className="cal-schedule-gutter cal-schedule-allday-label">All day</div>
          {days.map((d) => {
            const allDay = eventsForDay(d).filter((e) => e.allDay);
            return (
              <div key={`allday-${localDayKey(d)}`} className="cal-schedule-allday-col">
                {allDay.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    className={`cal-event-bar cal-event-bar--compact cal-event-bar--${ev.source}${ev.color ? " cal-event-bar--colored" : ""}`}
                    style={chipStyle(ev)}
                    onClick={() => setSelectedEvent(ev)}
                  >
                    {ev.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        <div className="cal-schedule-body">
          <div className="cal-schedule-times" style={{ height: gridHeight }}>
            {hours.map((h) => (
              <div key={h} className="cal-schedule-time" style={{ height: SCHEDULE_SLOT_PX }}>
                {formatScheduleHour(h)}
              </div>
            ))}
          </div>
          <div className="cal-schedule-cols" style={{ height: gridHeight }}>
            {days.map((d) => (
              <div key={localDayKey(d)} className="cal-schedule-col">
                {hours.map((h) => (
                  <div key={h} className="cal-schedule-slot" style={{ height: SCHEDULE_SLOT_PX }} />
                ))}
                {eventsForDay(d)
                  .filter((e) => !e.allDay)
                  .map((ev) => {
                    const layout = layoutTimedEvent(ev, d);
                    if (!layout) return null;
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        className={`cal-schedule-event cal-schedule-event--${ev.source}${ev.color ? " cal-schedule-event--colored" : ""}`}
                        style={{
                          ...chipStyle(ev),
                          top: `${layout.topPct}%`,
                          height: `${layout.heightPct}%`,
                        }}
                        onClick={() => setSelectedEvent(ev)}
                        title={ev.title}
                      >
                        <span className="cal-schedule-event-title">{ev.title}</span>
                        <span className="cal-schedule-event-time">
                          {fmtTime(ev.start)} – {fmtTime(ev.end)}
                        </span>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderAgendaView = () => {
    if (sortedEvents.length === 0) {
      return <p className="cal-empty">No events in this period.</p>;
    }
    let lastDate = "";
    return (
      <div className="cal-agenda">
        {sortedEvents.map((ev) => {
          const dateLabel = fmtDate(ev.start);
          const showHeader = dateLabel !== lastDate;
          lastDate = dateLabel;
          return (
            <div key={ev.id}>
              {showHeader ? <div className="cal-agenda-date">{dateLabel}</div> : null}
              <button
                type="button"
                className={`cal-agenda-row cal-agenda-row--${ev.source}${ev.color ? " cal-agenda-row--colored" : ""}`}
                style={chipStyle(ev)}
                onClick={() => setSelectedEvent(ev)}
              >
                <span className="cal-agenda-time">{ev.allDay ? "All day" : fmtTime(ev.start)}</span>
                <div className="cal-agenda-body">
                  <span className="cal-agenda-title">{ev.title}</span>
                  {ev.location ? <span className="cal-agenda-meta">{ev.location}</span> : null}
                </div>
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

  const showSidebar = view === "month" || view === "agenda";

  return (
    <div className="page calendar-page teams-surface">
      <div className="teams-command-bar cal-command-bar">
        <div className="teams-command-bar-start">
          <h1 className="teams-page-heading">Calendar</h1>
        </div>
        <div className="teams-command-bar-end">
          <button type="button" className="teams-btn teams-btn--ghost" onClick={goToday}>
            Today
          </button>
          <div className="cal-nav teams-nav">
            <button type="button" className="teams-btn teams-btn--icon" onClick={() => shiftPeriod(-1)} aria-label="Previous">
              ‹
            </button>
            <span className="cal-period-label">{periodTitle(view, viewDate)}</span>
            <button type="button" className="teams-btn teams-btn--icon" onClick={() => shiftPeriod(1)} aria-label="Next">
              ›
            </button>
          </div>
          <div className="teams-segmented cal-view-toggle">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`teams-segment${view === opt.id ? " teams-segment--active" : ""}`}
                onClick={() => setView(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {hasCalendarAccount === false && !loading && (
        <div className="cal-connect-banner">Connect Gmail or Microsoft in Mail to see your calendars here.</div>
      )}

      {warnings.length > 0 && !loading ? (
        <div className="cal-connect-banner cal-connect-banner--warn" role="status">
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      ) : null}

      {error ? <p className="page-error">{error}</p> : null}
      {loading ? <p className="page-loading">Loading events…</p> : null}

      {!loading ? (
        <div className={`cal-layout${showSidebar ? "" : " cal-layout--full"}`}>
          <div className="cal-main">
            {view === "month" ? renderMonthView() : null}
            {view === "workweek" ? renderScheduleView(true) : null}
            {view === "week" ? renderScheduleView(false) : null}
            {view === "agenda" ? renderAgendaView() : null}
          </div>

          {showSidebar ? (
            <aside className="cal-sidebar">
              <div className="cal-sidebar-header">
                <h2 className="cal-sidebar-title">{sidebarTitle}</h2>
                {focusDay ? (
                  <button type="button" className="teams-btn teams-btn--ghost teams-btn--sm" onClick={() => setFocusDay(null)}>
                    Upcoming
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
                      className={`cal-sidebar-event cal-sidebar-event--${ev.source}${ev.color ? " cal-sidebar-event--colored" : ""}`}
                      style={chipStyle(ev)}
                      onClick={() => setSelectedEvent(ev)}
                    >
                      <span className="cal-sidebar-event-time">{ev.allDay ? "All day" : fmtTime(ev.start)}</span>
                      <span className="cal-sidebar-event-title">{ev.title}</span>
                      {ev.location ? <span className="cal-sidebar-event-loc">{ev.location}</span> : null}
                    </button>
                  ))
                )}
              </div>
            </aside>
          ) : null}
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
