import type { CalendarViewMode } from "../types";

const VIEWS: { id: CalendarViewMode; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "agenda", label: "Agenda" },
];

interface Props {
  view: CalendarViewMode;
  onChange: (view: CalendarViewMode) => void;
}

export function CalendarViewSwitcher({ view, onChange }: Props) {
  return (
    <div className="pd-view-switcher" role="tablist" aria-label="Calendar view">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          role="tab"
          aria-selected={view === v.id}
          className={`pd-view-switcher__btn${view === v.id ? " pd-view-switcher__btn--active" : ""}`}
          onClick={() => onChange(v.id)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
