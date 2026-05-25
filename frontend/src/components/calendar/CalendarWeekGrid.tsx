import { useCallback, useMemo, useRef, useState } from "react";
import type { CalendarEvent } from "./calendarTypes";
import { DAY_NAMES } from "./calendarTypes";
import { startOfWorkWeek } from "../../lib/calendarDate";
import {
  GRID_END_HOUR,
  GRID_HEIGHT_PX,
  GRID_START_HOUR,
  HOUR_HEIGHT_PX,
  addDays,
  dateWithMinutes,
  eventDurationMs,
  fmtHourLabel,
  fmtTime,
  isSameDay,
  layoutTimedEvent,
  snapDate,
  startOfDay,
  startOfWeek,
  yToMinutes,
} from "./calendarLayout";

export type ScheduleMode = "workweek" | "week" | "day";

const WORK_DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];

type DragMode = "move" | "resize";

type DragState = {
  eventId: string;
  mode: DragMode;
  dayIndex: number;
  pointerId: number;
  origStart: Date;
  origEnd: Date;
  grabOffsetY: number;
};

interface Props {
  viewDate: Date;
  events: CalendarEvent[];
  saving: boolean;
  selectedEventId?: string | null;
  onSelect: (ev: CalendarEvent) => void;
  onReschedule: (ev: CalendarEvent, start: Date, end: Date) => void;
  /** Teams-style range: work week (Mon–Fri), full week, or single day */
  scheduleMode?: ScheduleMode;
}

function SourceDot({ source }: { source: CalendarEvent["source"] }) {
  return <span className={`cal-week-ev-source cal-week-ev-source--${source}`} aria-hidden />;
}

function isWeekend(day: Date): boolean {
  const dow = day.getDay();
  return dow === 0 || dow === 6;
}

function NowIndicator({ day }: { day: Date }) {
  if (!isSameDay(day, new Date())) return null;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = GRID_START_HOUR * 60;
  const endMinutes = GRID_END_HOUR * 60;
  if (minutes < startMinutes || minutes >= endMinutes) return null;
  const topPct = ((minutes - startMinutes) / (endMinutes - startMinutes)) * 100;
  return (
    <div className="cal-week-now-line" style={{ top: `${topPct}%` }} aria-hidden>
      <span className="cal-week-now-dot" />
    </div>
  );
}

export function CalendarWeekGrid({
  viewDate,
  events,
  saving,
  selectedEventId = null,
  onSelect,
  onReschedule,
  scheduleMode = "week",
}: Props) {
  const rangeStart = useMemo(() => {
    if (scheduleMode === "day") return startOfDay(viewDate);
    if (scheduleMode === "workweek") return startOfWorkWeek(viewDate);
    return startOfWeek(viewDate);
  }, [scheduleMode, viewDate]);

  const dayCount = scheduleMode === "workweek" ? 5 : scheduleMode === "day" ? 1 : 7;

  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => addDays(rangeStart, i)),
    [rangeStart, dayCount],
  );

  const dayName = (day: Date, index: number) =>
    scheduleMode === "workweek" ? WORK_DAY_NAMES[index] : DAY_NAMES[day.getDay()];

  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [preview, setPreview] = useState<{ id: string; start: Date; end: Date } | null>(null);

  const allDayByDay = useMemo(
    () => days.map((day) => events.filter((e) => e.allDay && isSameDay(new Date(e.start), day))),
    [days, events]
  );

  const timedByDay = useMemo(
    () => days.map((day) => events.filter((e) => !e.allDay && layoutTimedEvent(e, day))),
    [days, events]
  );

  const hours = useMemo(
    () => Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => GRID_START_HOUR + i),
    []
  );

  const getPreviewTimes = useCallback(
    (ev: CalendarEvent): { start: Date; end: Date } => {
      if (preview?.id === ev.id) return { start: preview.start, end: preview.end };
      return { start: new Date(ev.start), end: new Date(ev.end) };
    },
    [preview]
  );

  const columnBody = (dayIndex: number): HTMLElement | null =>
    gridRef.current?.querySelector(
      `[data-day-index="${dayIndex}"] .cal-week-day-body`
    ) as HTMLElement | null;

  const dayIndexFromPointer = (clientX: number): number => {
    const cols = gridRef.current?.querySelectorAll(".cal-week-day-col");
    if (!cols?.length) return 0;
    for (let i = 0; i < cols.length; i++) {
      const rect = cols[i].getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) return i;
    }
    let best = 0;
    let bestDist = Infinity;
    cols.forEach((col, i) => {
      const rect = col.getBoundingClientRect();
      const mid = (rect.left + rect.right) / 2;
      const dist = Math.abs(clientX - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  };

  const pointerYToMinutes = (dayIndex: number, clientY: number, grabOffsetY: number): number => {
    const col = columnBody(dayIndex);
    if (!col) return 0;
    const rect = col.getBoundingClientRect();
    const y = clientY - rect.top + col.scrollTop - grabOffsetY;
    return yToMinutes(y);
  };

  const onPointerDownMove = (e: React.PointerEvent, ev: CalendarEvent, dayIndex: number) => {
    if (saving || ev.allDay) return;
    e.stopPropagation();
    const col = columnBody(dayIndex);
    let grabOffsetY = 0;
    if (col) {
      const rect = col.getBoundingClientRect();
      const layout = layoutTimedEvent(ev, days[dayIndex]);
      grabOffsetY = e.clientY - rect.top + col.scrollTop - (layout?.top ?? 0);
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      eventId: ev.id,
      mode: "move",
      dayIndex,
      pointerId: e.pointerId,
      origStart: new Date(ev.start),
      origEnd: new Date(ev.end),
      grabOffsetY,
    });
    setPreview({ id: ev.id, start: new Date(ev.start), end: new Date(ev.end) });
  };

  const onPointerDownResize = (e: React.PointerEvent, ev: CalendarEvent, dayIndex: number) => {
    if (saving || ev.allDay) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      eventId: ev.id,
      mode: "resize",
      dayIndex,
      pointerId: e.pointerId,
      origStart: new Date(ev.start),
      origEnd: new Date(ev.end),
      grabOffsetY: 0,
    });
    setPreview({ id: ev.id, start: new Date(ev.start), end: new Date(ev.end) });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || drag.pointerId !== e.pointerId) return;

    if (drag.mode === "resize") {
      const endMinutes = pointerYToMinutes(drag.dayIndex, e.clientY, 0);
      const newEnd = dateWithMinutes(days[drag.dayIndex], endMinutes);
      if (newEnd.getTime() <= drag.origStart.getTime() + 15 * 60 * 1000) return;
      setPreview({ id: drag.eventId, start: drag.origStart, end: newEnd });
      return;
    }

    const startMinutes = pointerYToMinutes(drag.dayIndex, e.clientY, drag.grabOffsetY);
    const duration = drag.origEnd.getTime() - drag.origStart.getTime();
    const newStart = dateWithMinutes(days[drag.dayIndex], startMinutes);
    const newEnd = new Date(newStart.getTime() + duration);
    setPreview({ id: drag.eventId, start: newStart, end: newEnd });
  };

  const finishDrag = (e: React.PointerEvent, ev: CalendarEvent, dayIndex: number) => {
    if (!drag || drag.eventId !== ev.id || drag.pointerId !== e.pointerId) return;

    const targetDayIndex = dayIndexFromPointer(e.clientX);
    let nextStart = preview?.start ?? new Date(ev.start);
    let nextEnd = preview?.end ?? new Date(ev.end);

    if (drag.mode === "move") {
      const startMinutes = pointerYToMinutes(targetDayIndex, e.clientY, drag.grabOffsetY);
      const duration = eventDurationMs(ev);
      nextStart = dateWithMinutes(days[targetDayIndex], startMinutes);
      nextEnd = new Date(nextStart.getTime() + duration);
    } else {
      const endMinutes = pointerYToMinutes(targetDayIndex, e.clientY, 0);
      nextEnd = dateWithMinutes(days[targetDayIndex], endMinutes);
      nextStart = drag.origStart;
    }

    setDrag(null);
    setPreview(null);

    if (
      nextStart.getTime() === new Date(ev.start).getTime() &&
      nextEnd.getTime() === new Date(ev.end).getTime()
    ) {
      return;
    }

    onReschedule(ev, snapDate(nextStart), snapDate(nextEnd));
  };

  const cancelDrag = () => {
    setDrag(null);
    setPreview(null);
  };

  return (
    <div className="cal-week-schedule" ref={gridRef}>
      <div className="cal-week-schedule-head">
        <div className="cal-week-gutter cal-week-gutter--head" />
        {days.map((day, i) => {
          const isToday = isSameDay(day, new Date());
          const weekend = isWeekend(day);
          return (
            <div
              key={i}
              className={`cal-week-schedule-dayhead${isToday ? " cal-week-schedule-dayhead--today" : ""}${weekend ? " cal-week-schedule-dayhead--weekend" : ""}`}
            >
              <span className="cal-week-day-name">{dayName(day, i)}</span>
              <span className={`cal-week-day-num ${isToday ? "cal-day-num--today" : ""}`}>
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      <div className="cal-week-allday-row">
        <div className="cal-week-gutter cal-week-allday-label">All day</div>
        {days.map((day, i) => (
          <div key={i} className="cal-week-allday-cell" data-day-index={i}>
            {allDayByDay[i].map((ev) => (
              <button
                key={ev.id}
                type="button"
                className={`cal-week-allday-chip cal-week-allday-chip--${ev.source}`}
                onClick={() => onSelect(ev)}
                style={ev.color ? { borderLeftColor: ev.color } : undefined}
              >
                <SourceDot source={ev.source} />
                <span className="cal-week-ev-title">{ev.title}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="cal-week-schedule-body" onPointerMove={onPointerMove} onPointerUp={cancelDrag}>
        <div className="cal-week-time-gutter">
          {hours.map((h) => (
            <div key={h} className="cal-week-time-label" style={{ height: HOUR_HEIGHT_PX }}>
              {fmtHourLabel(h)}
            </div>
          ))}
        </div>

        <div className="cal-week-day-columns">
          {days.map((day, dayIndex) => {
            const weekend = isWeekend(day);
            return (
            <div
              key={dayIndex}
              className={`cal-week-day-col${weekend ? " cal-week-day-col--weekend" : ""}`}
              data-day-index={dayIndex}
            >
              <div className="cal-week-day-body">
                <div className="cal-week-grid-lines" style={{ height: GRID_HEIGHT_PX }}>
                  {hours.map((h) => (
                    <div key={h} className="cal-week-hour-line" />
                  ))}
                </div>
                <NowIndicator day={day} />

                {timedByDay[dayIndex].map((ev) => {
                  const times = getPreviewTimes(ev);
                  const layoutEv = {
                    ...ev,
                    start: times.start.toISOString(),
                    end: times.end.toISOString(),
                  };
                  const layout = layoutTimedEvent(layoutEv, day);
                  if (!layout) return null;

                  const dragging = drag?.eventId === ev.id;
                  const selected = selectedEventId === ev.id;

                  return (
                    <div
                      key={ev.id}
                      role="button"
                      tabIndex={0}
                      className={`cal-week-event cal-week-event--${ev.source}${dragging ? " cal-week-event--dragging" : ""}${selected ? " tcc-event--selected" : ""}`}
                      style={{
                        top: layout.top,
                        height: layout.height,
                        ...(ev.color
                          ? {
                              borderLeftColor: ev.color,
                              background: `color-mix(in srgb, ${ev.color} 22%, var(--bg-2))`,
                            }
                          : {}),
                      }}
                      onPointerDown={(e) => onPointerDownMove(e, ev, dayIndex)}
                      onPointerUp={(e) => finishDrag(e, ev, dayIndex)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onSelect(ev);
                      }}
                    >
                      <div className="cal-week-event-inner">
                        <SourceDot source={ev.source} />
                        <span className="cal-week-ev-title">{ev.title}</span>
                        <span className="cal-week-ev-time">
                          {fmtTime(times.start.toISOString())} – {fmtTime(times.end.toISOString())}
                        </span>
                      </div>
                      <div
                        className="cal-week-event-resize"
                        onPointerDown={(e) => onPointerDownResize(e, ev, dayIndex)}
                        onPointerUp={(e) => finishDrag(e, ev, dayIndex)}
                        aria-label="Resize event"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
          })}
        </div>
      </div>

      {saving && (
        <div className="cal-week-saving" role="status">
          Saving…
        </div>
      )}
    </div>
  );
}