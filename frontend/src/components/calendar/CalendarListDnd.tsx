import { useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { CalendarEvent } from "./calendarTypes";
import { addDays, dateWithMinutes, eventDurationMs, fmtDate, fmtTime, isSameDay, startOfDay } from "./calendarLayout";

interface Props {
  events: CalendarEvent[];
  rangeStart: Date;
  rangeEnd: Date;
  saving: boolean;
  onSelect: (ev: CalendarEvent) => void;
  onReschedule: (ev: CalendarEvent, start: Date, end: Date) => void;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function ListEventRow({
  ev,
  onSelect,
}: {
  ev: CalendarEvent;
  onSelect: (ev: CalendarEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ev.id });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`cal-list-row cal-list-row--draggable ${isDragging ? "cal-list-row--dragging" : ""}`}
      onClick={() => onSelect(ev)}
      {...attributes}
      {...listeners}
    >
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
    </button>
  );
}

function DayDropZone({
  day,
  children,
}: {
  day: Date;
  children: ReactNode;
}) {
  const id = `day-${dayKey(day)}`;
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`cal-list-day-block ${isOver ? "cal-list-day-block--over" : ""}`} data-day={id}>
      <div className="cal-list-date-sep">{fmtDate(day.toISOString())}</div>
      {children}
    </div>
  );
}

export function CalendarListDnd({ events, rangeStart, rangeEnd, saving, onSelect, onReschedule }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const days = useMemo(() => {
    const list: Date[] = [];
    const cur = startOfDay(rangeStart);
    const end = startOfDay(rangeEnd);
    while (cur <= end) {
      list.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return list;
  }, [rangeStart, rangeEnd]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const day of days) {
      map.set(dayKey(day), []);
    }
    for (const ev of events) {
      const start = startOfDay(new Date(ev.start));
      const end = new Date(ev.end);
      for (const day of days) {
        const dayStart = startOfDay(day);
        const dayEnd = addDays(dayStart, 1);
        const overlaps = start < dayEnd && end > dayStart;
        if (overlaps) {
          map.get(dayKey(day))?.push(ev);
        }
      }
    }
    for (const [, list] of map) {
      list.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    }
    return map;
  }, [days, events]);

  const activeEvent = activeId ? events.find((e) => e.id === activeId) : null;

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over || saving) return;

    const ev = events.find((x) => x.id === e.active.id);
    if (!ev) return;

    const overId = String(e.over.id);
    if (!overId.startsWith("day-")) return;

    const parts = overId.replace("day-", "").split("-").map(Number);
    if (parts.length !== 3) return;

    const targetDay = new Date(parts[0], parts[1], parts[2]);
    const duration = eventDurationMs(ev);
    let newStart: Date;

    if (ev.allDay) {
      newStart = startOfDay(targetDay);
    } else {
      const orig = new Date(ev.start);
      const minutes = orig.getHours() * 60 + orig.getMinutes();
      newStart = dateWithMinutes(targetDay, minutes);
    }
    const newEnd = new Date(newStart.getTime() + duration);

    if (isSameDay(newStart, new Date(ev.start)) && newEnd.getTime() === new Date(ev.end).getTime()) {
      return;
    }

    onReschedule(ev, newStart, newEnd);
  };

  const hasAny = events.length > 0;

  if (!hasAny) {
    return <p className="cal-empty">No events in this range.</p>;
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="cal-list cal-list--dnd">
        <p className="cal-list-hint">Drag events between days to reschedule (snaps to 15 minutes in week view).</p>
        {days.map((day) => {
          const dayEvents = eventsByDay.get(dayKey(day)) ?? [];
          return (
            <DayDropZone key={dayKey(day)} day={day}>
              {dayEvents.length === 0 ? (
                <p className="cal-list-day-empty">Drop events here</p>
              ) : (
                dayEvents.map((ev) => <ListEventRow key={ev.id} ev={ev} onSelect={onSelect} />)
              )}
            </DayDropZone>
          );
        })}
      </div>
      <DragOverlay>
        {activeEvent ? (
          <div className="cal-list-row cal-list-row--overlay">
            <span className="cal-list-title">{activeEvent.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
