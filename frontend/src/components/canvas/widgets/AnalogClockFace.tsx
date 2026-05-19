/** Simple SVG analog clock for canvas widget variants. */
export function AnalogClockFace({ size = 120, timeZone }: { size?: number; timeZone?: string }) {
  const now = new Date();
  let h = now.getHours() % 12;
  let m = now.getMinutes();
  let s = now.getSeconds();
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: false,
      }).formatToParts(now);
      const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
      const hour24 = get("hour");
      h = hour24 % 12;
      m = get("minute");
      s = get("second");
    } catch {
      /* use local */
    }
  }
  const secDeg = s * 6;
  const minDeg = m * 6 + s * 0.1;
  const hourDeg = h * 30 + m * 0.5;
  const r = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="analog-clock-face" aria-hidden>
      <circle cx={r} cy={r} r={r - 2} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={2} />
      {[...Array(12)].map((_, i) => {
        const a = (i * 30 - 90) * (Math.PI / 180);
        const x1 = r + (r - 10) * Math.cos(a);
        const y1 = r + (r - 10) * Math.sin(a);
        const x2 = r + (r - 4) * Math.cos(a);
        const y2 = r + (r - 4) * Math.sin(a);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeOpacity={0.35} strokeWidth={1.5} />;
      })}
      <line
        x1={r}
        y1={r}
        x2={r + (r - 28) * Math.cos((hourDeg - 90) * (Math.PI / 180))}
        y2={r + (r - 28) * Math.sin((hourDeg - 90) * (Math.PI / 180))}
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <line
        x1={r}
        y1={r}
        x2={r + (r - 14) * Math.cos((minDeg - 90) * (Math.PI / 180))}
        y2={r + (r - 14) * Math.sin((minDeg - 90) * (Math.PI / 180))}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <line
        x1={r}
        y1={r}
        x2={r + (r - 8) * Math.cos((secDeg - 90) * (Math.PI / 180))}
        y2={r + (r - 8) * Math.sin((secDeg - 90) * (Math.PI / 180))}
        stroke="var(--accent, #5b8dff)"
        strokeWidth={1}
        strokeLinecap="round"
      />
      <circle cx={r} cy={r} r={3} fill="currentColor" />
    </svg>
  );
}
