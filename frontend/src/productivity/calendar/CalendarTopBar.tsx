import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarViewMode } from "../types";
import { CalendarViewSwitcher } from "./CalendarViewSwitcher";

interface Props {
  viewDate: Date;
  view: CalendarViewMode;
  onViewChange: (view: CalendarViewMode) => void;
  onViewDateChange: (date: Date) => void;
  onToday: () => void;
  onQuickAdd: () => void;
  loading?: boolean;
  onRefresh?: () => void;
}

function formatHeading(date: Date, view: CalendarViewMode): string {
  if (view === "day") {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  if (view === "month") {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startFmt = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endFmt = end.toLocaleDateString("en-US", {
    month: sameMonth ? undefined : "short",
    day: "numeric",
    year: start.getFullYear() !== end.getFullYear() ? "numeric" : undefined,
  });
  return `${startFmt} – ${endFmt}`;
}

function shiftDate(date: Date, view: CalendarViewMode, dir: -1 | 1): Date {
  const next = new Date(date);
  if (view === "day") next.setDate(next.getDate() + dir);
  else if (view === "month") next.setMonth(next.getMonth() + dir);
  else next.setDate(next.getDate() + dir * 7);
  return next;
}

export function CalendarTopBar({
  viewDate,
  view,
  onViewChange,
  onViewDateChange,
  onToday,
  onQuickAdd,
  loading,
  onRefresh,
}: Props) {
  return (
    <header className="pd-cal-topbar">
      <div className="pd-cal-topbar__start">
        <h1 className="pd-cal-topbar__title">{formatHeading(viewDate, view)}</h1>
      </div>
      <div className="pd-cal-topbar__center">
        <CalendarViewSwitcher view={view} onChange={onViewChange} />
      </div>
      <div className="pd-cal-topbar__end">
        {onRefresh ? (
          <button
            type="button"
            className="pd-btn pd-btn--ghost pd-btn--sm"
            onClick={onRefresh}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        ) : null}
        <button type="button" className="pd-btn pd-btn--ghost pd-btn--sm" onClick={onToday}>
          Today
        </button>
        <div className="pd-cal-nav">
          <button
            type="button"
            className="pd-icon-btn"
            onClick={() => onViewDateChange(shiftDate(viewDate, view, -1))}
            aria-label="Previous"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="pd-icon-btn"
            onClick={() => onViewDateChange(shiftDate(viewDate, view, 1))}
            aria-label="Next"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <button type="button" className="pd-btn pd-btn--primary pd-btn--sm" onClick={onQuickAdd}>
          Quick add
        </button>
      </div>
    </header>
  );
}
