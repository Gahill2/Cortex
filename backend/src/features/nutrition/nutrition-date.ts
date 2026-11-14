/** Calendar day helpers using the browser's `Date.getTimezoneOffset()` convention. */

export function dayBoundsUtc(dateStr: string, tzOffsetMinutes = 0): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const startMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) + tzOffsetMinutes * 60_000;
  const endMs = startMs + 86_400_000 - 1;
  return { start: new Date(startMs), end: new Date(endMs) };
}

export function localDateKeyFromUtc(utcMs: number, tzOffsetMinutes: number): string {
  const shifted = new Date(utcMs - tzOffsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function subtractDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  dt.setUTCDate(dt.getUTCDate() - days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function weekDateKeys(endDateStr: string): string[] {
  const keys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    keys.push(subtractDays(endDateStr, i));
  }
  return keys;
}

export function parseTzOffset(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || Math.abs(n) > 840) return 0;
  return Math.trunc(n);
}
