import { useMemo, type CSSProperties } from "react";
import { CalendarListDnd } from "../calendar/CalendarListDnd";
import { CalendarWeekGrid, type ScheduleMode } from "../calendar/CalendarWeekGrid";
import { eventOnDay, localDayKey } from "../../lib/calendarDate";
import { mapCalendarEventToPlanner, mapPlannerToCalendarEvent, fetchRangeForPlannerView } from "./plannerMappers";
import type { CalendarRangeView, PlannerEvent } from "./types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function chipStyle(ev: PlannerEvent): CSSProperties | undefined {
  if (!ev.color) return undefined;
  return { ["--cal-event-color" as string]: ev.color };
}

interface Props {
  calView: CalendarRangeView;
  viewDate: Date;
  events: PlannerEvent[];
  selectedEventId: string | null;
  saving: boolean;
  onSelectEvent: (ev: PlannerEvent) => void;
  onReschedule: (ev: PlannerEvent, start: Date, end: Date) => void;
}

export function TasksCalendarSchedule({
  calView,
  viewDate,
  events,
  selectedEventId,
  saving,
  onSelectEvent,
  onReschedule,
}: Props) {
  const calendarEvents = useMemo(() => events.map(mapPlannerToCalendarEvent), [events]);

  const range = useMemo(
    () => fetchRangeForPlannerView(calView, viewDate),
    [calView, viewDate],
  );

  const rangeStart = useMemo(() => new Date(range.start), [range.start]);
  const rangeEnd = useMemo(() => new Date(range.end), [range.end]);

  if (calView === "agenda") {
    return (
      <section className="tcc-card tcc-cal-card tcc-cal-card--agenda" aria-label="Agenda">
        <CalendarListDnd
          events={calendarEvents}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          saving={saving}
          onSelect={(ev) => {
            const planner = events.find((e) => e.id === ev.id) ?? mapCalendarEventToPlanner(ev);
            onSelectEvent(planner);
          }}
          onReschedule={(ev, start, end) => {
            const planner = events.find((e) => e.id === ev.id);
            if (planner) onReschedule(planner, start, end);
          }}
        />
      </section>
    );
  }

  if (calView === "month") {
    return (
      <MonthGrid
        viewDate={viewDate}
        events={events}
        selectedEventId={selectedEventId}
        onSelectEvent={onSelectEvent}
      />
    );
  }

  const scheduleMode: ScheduleMode =
    calView === "workweek" ? "workweek" : calView === "day" ? "day" : "week";

  return (
    <section
      className="tcc-card tcc-cal-card tcc-cal-card--schedule"
      aria-label={calView === "day" ? "Day schedule" : "Week schedule"}
    >
      <CalendarWeekGrid
        viewDate={viewDate}
        events={calendarEvents}
        saving={saving}
        selectedEventId={selectedEventId}
        scheduleMode={scheduleMode}
        onSelect={(ev) => {
          const planner = events.find((e) => e.id === ev.id);
          if (planner) onSelectEvent(planner);
        }}
        onReschedule={(ev, start, end) => {
          const planner = events.find((e) => e.id === ev.id);
          if (planner) onReschedule(planner, start, end);
        }}
      />
    </section>
  );
}

function MonthGrid({
  viewDate,
  events,
  selectedEventId,
  onSelectEvent,
}: {
  viewDate: Date;
  events: PlannerEvent[];
  selectedEventId: string | null;
  onSelectEvent: (ev: PlannerEvent) => void;
}) {
  const todayKey = localDayKey(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const eventsForDay = (day: Date) =>
    events.filter((e) => eventOnDay(e.start, day));

  const monthLabel = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <section className="tcc-card tcc-cal-card tcc-cal-card--month" aria-label="Month calendar">
      <div className="tcc-card-head tcc-card-head--compact">
        <h2 className="tcc-card-title">{monthLabel}</h2>
        <span className="tcc-card-meta">{events.length} events</span>
      </div>
      <div className="cal-month-grid tcc-month-grid">
        {DAY_NAMES.map((d) => (
          <div key={d} className="cal-weekday-header">
            {d}
          </div>
        ))}
        {Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - firstDay + 1;
          const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
          if (!inMonth) {
            return <div key={`pad-${i}`} className="cal-cell cal-cell--empty cal-cell--pad" />;
          }
          const dayDate = new Date(year, month, dayNum);
          const cellKey = localDayKey(dayDate);
          const isToday = cellKey === todayKey;
          const dayEvents = eventsForDay(dayDate);
          const visible = dayEvents.slice(0, 3);
          const extra = dayEvents.length - visible.length;

          return (
            <div
              key={cellKey}
              className={`cal-cell${isToday ? " cal-cell--today cal-day--today" : ""}`}
            >
              <span className={`cal-cell-num${isToday ? " cal-day-num--today" : ""}`}>{dayNum}</span>
              <div className="cal-cell-events">
                {visible.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    className={`cal-event-bar cal-event-bar--compact${ev.source ? ` cal-event-bar--${ev.source}` : ""}${selectedEventId === ev.id ? " tcc-event--selected" : ""}${ev.color ? " cal-event-bar--colored" : ""}`}
                    style={chipStyle(ev)}
                    onClick={() => onSelectEvent(ev)}
                  >
                    {ev.title}
                  </button>
                ))}
                {extra > 0 ? <span className="cal-cell-more">+{extra} more</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
