import { periodTitle, shiftAnchor } from "../../lib/calendarDate";
import type { CalendarRangeView } from "./types";

const VIEW_OPTIONS: { id: CalendarRangeView; label: string }[] = [
  { id: "workweek", label: "Work week" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
  { id: "month", label: "Month" },
  { id: "agenda", label: "Agenda" },
];

function periodLabel(view: CalendarRangeView, anchor: Date): string {
  if (view === "day") {
    return anchor.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  if (view === "month") {
    return anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  if (view === "agenda") {
    return "Upcoming";
  }
  const calView = view === "workweek" ? "workweek" : "week";
  return periodTitle(calView, anchor);
}

interface Props {
  viewDate: Date;
  calView: CalendarRangeView;
  onViewDateChange: (d: Date) => void;
  onCalViewChange: (v: CalendarRangeView) => void;
}

export function TasksCalendarCommandBar({
  viewDate,
  calView,
  onViewDateChange,
  onCalViewChange,
}: Props) {
  const goToday = () => onViewDateChange(new Date());

  const shiftPeriod = (dir: -1 | 1) => {
    if (calView === "day") {
      const d = new Date(viewDate);
      d.setDate(d.getDate() + dir);
      onViewDateChange(d);
      return;
    }
    if (calView === "month" || calView === "agenda") {
      onViewDateChange(shiftAnchor("month", viewDate, dir));
      return;
    }
    const mode = calView === "workweek" ? "workweek" : "week";
    onViewDateChange(shiftAnchor(mode, viewDate, dir));
  };

  return (
    <div className="tcc-cal-command teams-command-bar cal-command-bar">
      <div className="teams-command-bar-start">
        <button type="button" className="teams-btn teams-btn--ghost" onClick={goToday}>
          Today
        </button>
        <div className="cal-nav teams-nav">
          <button
            type="button"
            className="teams-btn teams-btn--icon"
            onClick={() => shiftPeriod(-1)}
            aria-label="Previous period"
          >
            ‹
          </button>
          <span className="cal-period-label">{periodLabel(calView, viewDate)}</span>
          <button
            type="button"
            className="teams-btn teams-btn--icon"
            onClick={() => shiftPeriod(1)}
            aria-label="Next period"
          >
            ›
          </button>
        </div>
      </div>
      <div className="teams-command-bar-end">
        <div className="teams-segmented cal-view-toggle tcc-view-toggle" role="group" aria-label="Calendar view">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={calView === opt.id ? "active" : ""}
              onClick={() => onCalViewChange(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
