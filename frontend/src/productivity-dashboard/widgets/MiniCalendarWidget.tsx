import type { WidgetRenderProps } from "../types";

export function MiniCalendarWidget(_props: WidgetRenderProps) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="pd-widget pd-widget--mini-cal">
      <header className="pd-mini-cal__head">
        <strong>{now.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
      </header>
      <div className="pd-mini-cal__weekdays">
        {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="pd-mini-cal__grid">
        {cells.map((d, i) => (
          <button
            key={i}
            type="button"
            className={`pd-mini-cal__day${d === now.getDate() ? " pd-mini-cal__day--today" : ""}${d && d % 5 === 0 ? " pd-mini-cal__day--dot" : ""}`}
            disabled={!d}
          >
            {d ?? ""}
          </button>
        ))}
      </div>
    </div>
  );
}
