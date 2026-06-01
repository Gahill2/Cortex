import type { CalendarEvent } from "./calendarTypes";

/** Pixels per hour in the week time grid */
export const HOUR_HEIGHT_PX = 56;
/** Snap drag/resize to this many minutes */
export const SNAP_MINUTES = 15;
/** Visible hours in week grid (inclusive start, exclusive end) */
export const GRID_START_HOUR = 0;
export const GRID_END_HOUR = 24;
export const GRID_HOURS = GRID_END_HOUR - GRID_START_HOUR;
export const GRID_HEIGHT_PX = GRID_HOURS * HOUR_HEIGHT_PX;

const SNAP_MS = SNAP_MINUTES * 60 * 1000;

export function getClientTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function snapDate(d: Date): Date {
  const t = d.getTime();
  return new Date(Math.round(t / SNAP_MS) * SNAP_MS);
}

/** Minutes from midnight for a date */
export function minutesFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function clampMinutes(minutes: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, minutes));
}

export type TimedLayout = {
  top: number;
  height: number;
  column: number;
  /** How many side-by-side columns share this event's time cluster */
  columnCount: number;
};

/** Position a timed event inside a day column for the week grid */
export function layoutTimedEvent(ev: CalendarEvent, day: Date): TimedLayout | null {
  if (ev.allDay) return null;

  const start = new Date(ev.start);
  const end = new Date(ev.end);
  if (!isSameDay(start, day) && !isSameDay(end, day)) {
    if (start < day && end > addDays(day, 1)) {
      // spans entire day
    } else if (!isSameDay(start, day)) {
      return null;
    }
  }

  const dayStart = startOfDay(day);
  const gridStartMs = dayStart.getTime() + GRID_START_HOUR * 60 * 60 * 1000;
  const gridEndMs = dayStart.getTime() + GRID_END_HOUR * 60 * 60 * 1000;

  let startMs = Math.max(start.getTime(), gridStartMs);
  let endMs = Math.min(end.getTime(), gridEndMs);
  if (isSameDay(start, day) && start < dayStart) startMs = gridStartMs;
  if (!isSameDay(end, day) && end > dayStart) endMs = gridEndMs;
  if (endMs <= startMs) endMs = startMs + 30 * 60 * 1000;

  const top = ((startMs - gridStartMs) / (60 * 60 * 1000)) * HOUR_HEIGHT_PX;
  const height = Math.max(((endMs - startMs) / (60 * 60 * 1000)) * HOUR_HEIGHT_PX, 22);
  return { top, height, column: 0, columnCount: 1 };
}

type TimedSegment = {
  id: string;
  startMs: number;
  endMs: number;
  top: number;
  height: number;
};

function clusterTimedSegments(segments: TimedSegment[]): TimedSegment[][] {
  if (segments.length === 0) return [];
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const clusters: TimedSegment[][] = [];
  let cluster: TimedSegment[] = [sorted[0]];
  let clusterEnd = sorted[0].endMs;

  for (let i = 1; i < sorted.length; i++) {
    const seg = sorted[i];
    if (seg.startMs < clusterEnd) {
      cluster.push(seg);
      clusterEnd = Math.max(clusterEnd, seg.endMs);
    } else {
      clusters.push(cluster);
      cluster = [seg];
      clusterEnd = seg.endMs;
    }
  }
  clusters.push(cluster);
  return clusters;
}

function maxConcurrentInCluster(cluster: TimedSegment[]): number {
  const points: { t: number; delta: number }[] = [];
  for (const seg of cluster) {
    points.push({ t: seg.startMs, delta: 1 });
    points.push({ t: seg.endMs, delta: -1 });
  }
  points.sort((a, b) => a.t - b.t || a.delta - b.delta);
  let active = 0;
  let max = 0;
  for (const p of points) {
    active += p.delta;
    max = Math.max(max, active);
  }
  return Math.max(max, 1);
}

/** Side-by-side columns for overlapping timed events on one day */
export function layoutTimedEventsForDay(
  events: CalendarEvent[],
  day: Date,
): Map<string, TimedLayout> {
  const result = new Map<string, TimedLayout>();
  const segments: TimedSegment[] = [];

  for (const ev of events) {
    if (ev.allDay) continue;
    const base = layoutTimedEvent(ev, day);
    if (!base) continue;
    segments.push({
      id: ev.id,
      startMs: new Date(ev.start).getTime(),
      endMs: new Date(ev.end).getTime(),
      top: base.top,
      height: base.height,
    });
  }

  for (const cluster of clusterTimedSegments(segments)) {
    const columnCount = maxConcurrentInCluster(cluster);
    const columnEnds: number[] = [];
    const sorted = [...cluster].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

    for (const seg of sorted) {
      let column = columnEnds.findIndex((end) => end <= seg.startMs);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(seg.endMs);
      } else {
        columnEnds[column] = seg.endMs;
      }
      result.set(seg.id, {
        top: seg.top,
        height: seg.height,
        column,
        columnCount,
      });
    }
  }

  return result;
}

export function yToMinutes(y: number): number {
  const hours = y / HOUR_HEIGHT_PX + GRID_START_HOUR;
  return clampMinutes(Math.round(hours * 60 / SNAP_MINUTES) * SNAP_MINUTES, 0, GRID_END_HOUR * 60);
}

export function minutesToY(minutes: number): number {
  return ((minutes / 60) - GRID_START_HOUR) * HOUR_HEIGHT_PX;
}

export function dateWithMinutes(day: Date, minutes: number): Date {
  const d = startOfDay(day);
  d.setMinutes(minutes);
  return snapDate(d);
}

export function eventDurationMs(ev: CalendarEvent): number {
  const s = new Date(ev.start).getTime();
  const e = new Date(ev.end).getTime();
  return Math.max(e - s, SNAP_MINUTES * 60 * 1000);
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function fmtHourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}
