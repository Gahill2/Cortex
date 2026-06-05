import {
  SCHEDULE_END_HOUR,
  SCHEDULE_START_HOUR,
  eventOnDay,
} from "./calendarDate";

export interface SchedulableEvent {
  id: string;
  start: string;
  end: string;
  allDay: boolean;
}

const GRID_MINUTES = (SCHEDULE_END_HOUR - SCHEDULE_START_HOUR) * 60;

export function layoutTimedEvent(
  ev: SchedulableEvent,
  day: Date,
): { topPct: number; heightPct: number } | null {
  if (ev.allDay || !eventOnDay(ev.start, day)) return null;

  const start = new Date(ev.start);
  const end = new Date(ev.end || ev.start);
  if (Number.isNaN(start.getTime())) return null;

  let startMin = start.getHours() * 60 + start.getMinutes();
  let endMin = end.getHours() * 60 + end.getMinutes();
  if (!eventOnDay(ev.end, day) && end < start) {
    endMin = SCHEDULE_END_HOUR * 60;
  }
  const gridStart = SCHEDULE_START_HOUR * 60;
  const gridEnd = SCHEDULE_END_HOUR * 60;

  startMin = Math.max(startMin, gridStart);
  endMin = Math.min(Math.max(endMin, startMin + 15), gridEnd);
  if (endMin <= startMin) endMin = startMin + 30;

  const topPct = ((startMin - gridStart) / GRID_MINUTES) * 100;
  const heightPct = ((endMin - startMin) / GRID_MINUTES) * 100;
  return { topPct, heightPct: Math.max(heightPct, 3) };
}

export function formatScheduleHour(h: number): string {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric" });
}
