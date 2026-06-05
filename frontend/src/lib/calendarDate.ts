export type CalendarView = "month" | "workweek" | "week" | "agenda";

export function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function eventDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return localDayKey(d);
}

export function eventOnDay(evStart: string, day: Date): boolean {
  return eventDayKey(evStart) === localDayKey(day);
}

export function startOfWeek(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - s.getDay());
  return s;
}

export function endOfWeek(d: Date): Date {
  const e = new Date(startOfWeek(d));
  e.setDate(e.getDate() + 7);
  e.setMilliseconds(-1);
  return e;
}

/** Monday 00:00 of the week containing `d`. */
export function startOfWorkWeek(d: Date): Date {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  const dow = m.getDay();
  m.setDate(m.getDate() + (dow === 0 ? -6 : 1 - dow));
  return m;
}

export function endOfWorkWeek(d: Date): Date {
  const e = new Date(startOfWorkWeek(d));
  e.setDate(e.getDate() + 5);
  e.setMilliseconds(-1);
  return e;
}

export function fetchRangeForView(view: CalendarView, anchor: Date): { start: string; end: string } {
  if (view === "week") {
    const start = startOfWeek(anchor);
    const end = endOfWeek(anchor);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (view === "workweek") {
    const start = startOfWorkWeek(anchor);
    const end = endOfWorkWeek(anchor);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (view === "month") {
    const gridStart = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    const lastDay = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const gridEnd = endOfWeek(lastDay);
    return { start: gridStart.toISOString(), end: gridEnd.toISOString() };
  }
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function shiftAnchor(view: CalendarView, anchor: Date, direction: -1 | 1): Date {
  const next = new Date(anchor);
  if (view === "week" || view === "workweek") {
    next.setDate(next.getDate() + direction * 7);
  } else {
    next.setMonth(next.getMonth() + direction);
    next.setDate(1);
  }
  return next;
}

export function periodTitle(view: CalendarView, anchor: Date): string {
  if (view === "week") {
    const start = startOfWeek(anchor);
    const end = endOfWeek(anchor);
    const sameMonth = start.getMonth() === end.getMonth();
    const startFmt = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endFmt = end.toLocaleDateString("en-US", {
      month: sameMonth ? undefined : "short",
      day: "numeric",
      year: start.getFullYear() === end.getFullYear() ? undefined : "numeric",
    });
    return `${startFmt} – ${endFmt}`;
  }
  if (view === "workweek") {
    const start = startOfWorkWeek(anchor);
    const end = endOfWorkWeek(anchor);
    const startFmt = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endFmt = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${startFmt} – ${endFmt}`;
  }
  return anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export const SCHEDULE_START_HOUR = 6;
export const SCHEDULE_END_HOUR = 22;
export const SCHEDULE_SLOT_PX = 48;

export function scheduleSlotCount(): number {
  return SCHEDULE_END_HOUR - SCHEDULE_START_HOUR;
}
