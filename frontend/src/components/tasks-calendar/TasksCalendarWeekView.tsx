import { useMemo, type CSSProperties } from "react";
import {
  SCHEDULE_END_HOUR,
  SCHEDULE_SLOT_PX,
  SCHEDULE_START_HOUR,
  localDayKey,
  scheduleSlotCount,
  startOfWeek,
} from "../../lib/calendarDate";
import { formatScheduleHour, layoutTimedEvent } from "../../lib/calendarSchedule";
import type { CalendarRangeView, PlannerEvent } from "./types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  view: CalendarRangeView;
  viewDate: Date;
  events: PlannerEvent[];
  selectedEventId: string | null;
  onSelectEvent: (ev: PlannerEvent) => void;
}

function chipStyle(ev: PlannerEvent): CSSProperties | undefined {
  if (!ev.color) return undefined;
  return { ["--cal-event-color" as string]: ev.color };
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function TasksCalendarWeekView(props: Props) {
  const { view, viewDate, events, selectedEventId, onSelectEvent } = props;
  const todayKey = localDayKey(new Date());
  const weekStart = useMemo(() => startOfWeek(viewDate), [viewDate]);

  const days = useMemo(() => {
    if (view === "day") {
      const d = new Date(viewDate);
      d.setHours(0, 0, 0, 0);
      return [d];
    }
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [view, viewDate, weekStart]);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = SCHEDULE_START_HOUR; h < SCHEDULE_END_HOUR; h++) list.push(h);
    return list;
  }, []);

  const gridHeight = scheduleSlotCount() * SCHEDULE_SLOT_PX;
  const scheduleStyle = { ["--cal-cols" as string]: String(days.length) } as CSSProperties;

  const eventsForDay = (day: Date) =>
    events.filter((e) => localDayKey(new Date(e.start)) === localDayKey(day));

  if (view === "month") {
    return (
      <section className="tcc-card tcc-cal-card" aria-label="Month calendar">
        <div className="tcc-card-head">
          <h2 className="tcc-card-title">Calendar</h2>
        </div>
        <div className="tcc-cal-placeholder">
          <p className="tcc-cal-placeholder-title">Month view</p>
          <p className="tcc-cal-placeholder-hint">Use Week or Day for the schedule preview.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="tcc-card tcc-cal-card"
      aria-label={view === "day" ? "Day calendar" : "Weekly calendar"}
    >
      <div className="tcc-card-head">
        <h2 className="tcc-card-title">Calendar</h2>
        <span className="tcc-card-meta">{view === "day" ? "Day" : "Week"}</span>
      </div>
      <div className="cal-schedule tcc-cal-schedule" style={scheduleStyle}>
        <ScheduleGrid
          days={days}
          hours={hours}
          gridHeight={gridHeight}
          todayKey={todayKey}
          eventsForDay={eventsForDay}
          selectedEventId={selectedEventId}
          onSelectEvent={onSelectEvent}
          chipStyle={chipStyle}
          fmtTime={fmtTime}
        />
      </div>
    </section>
  );
}

type GridProps = {
  days: Date[];
  hours: number[];
  gridHeight: number;
  todayKey: string;
  eventsForDay: (day: Date) => PlannerEvent[];
  selectedEventId: string | null;
  onSelectEvent: (ev: PlannerEvent) => void;
  chipStyle: (ev: PlannerEvent) => CSSProperties | undefined;
  fmtTime: (iso: string) => string;
};

function ScheduleGrid({
  days,
  hours,
  gridHeight,
  todayKey,
  eventsForDay,
  selectedEventId,
  onSelectEvent,
  chipStyle,
  fmtTime,
}: GridProps) {
  return (
    <>
      <div className="cal-schedule-header">
        <div className="cal-schedule-gutter cal-schedule-gutter--corner" />
        {days.map((d) => {
          const isToday = localDayKey(d) === todayKey;
          return (
            <div
              key={localDayKey(d)}
              className={`cal-schedule-dayhead${isToday ? " cal-schedule-dayhead--today" : ""}`}
            >
              <span className="cal-schedule-dayname">{DAY_NAMES[d.getDay()]}</span>
              <span className={`cal-schedule-daynum${isToday ? " cal-day-num--today" : ""}`}>
                {d.getDate()}
              </span>
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
                  const selected = selectedEventId === ev.id;
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      className={`cal-schedule-event cal-schedule-event--google${ev.color ? " cal-schedule-event--colored" : ""}${selected ? " tcc-event--selected" : ""}`}
                      style={{
                        ...chipStyle(ev),
                        top: `${layout.topPct}%`,
                        height: `${layout.heightPct}%`,
                      }}
                      onClick={() => onSelectEvent(ev)}
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
    </>
  );
}
