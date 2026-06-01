/** Minutes of inactivity before Cortex shows the PIN gate. 0 = disabled. */
export function getIdleLockMinutes(): number {
  const raw = import.meta.env.VITE_IDLE_LOCK_MINUTES;
  if (raw === undefined || raw === "") return 15;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 15;
  return n;
}

export function getIdleLockMs(): number {
  const minutes = getIdleLockMinutes();
  if (minutes === 0) return 0;
  return minutes * 60 * 1000;
}

export function isIdleLockEnabled(): boolean {
  return getIdleLockMs() > 0;
}
