import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { localDayKey } from "../../lib/calendarDate";

interface Props {
  viewDate: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onMonthChange?: (date: Date) => void;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function MiniCalendar({ viewDate, selectedDate, onSelectDate, onMonthChange }: Props) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = localDayKey(new Date());
  const selectedKey = localDayKey(selectedDate);

  const cells = useMemo(() => {
    const total = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const dayNum = i - firstDay + 1;
      if (dayNum < 1 || dayNum > daysInMonth) return null;
      return new Date(year, month, dayNum);
    });
  }, [firstDay, daysInMonth, year, month]);

  const shiftMonth = (dir: -1 | 1) => {
    const next = new Date(viewDate);
    next.setMonth(next.getMonth() + dir);
    onMonthChange?.(next);
  };

  const label = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="pd-mini-cal">
      <div className="pd-mini-cal__head">
        <button type="button" className="pd-icon-btn pd-icon-btn--xs" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          <ChevronLeft size={14} />
        </button>
        <span className="pd-mini-cal__label">{label}</span>
        <button type="button" className="pd-icon-btn pd-icon-btn--xs" onClick={() => shiftMonth(1)} aria-label="Next month">
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="pd-mini-cal__weekdays">
        {WEEKDAYS.map((d, i) => (
          <span key={`${d}-${i}`} className="pd-mini-cal__wd">
            {d}
          </span>
        ))}
      </div>
      <div className="pd-mini-cal__grid">
        {cells.map((day, i) => {
          if (!day) return <span key={`empty-${i}`} className="pd-mini-cal__day pd-mini-cal__day--empty" />;
          const key = localDayKey(day);
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          return (
            <button
              key={key}
              type="button"
              className={`pd-mini-cal__day${isToday ? " pd-mini-cal__day--today" : ""}${isSelected ? " pd-mini-cal__day--selected" : ""}`}
              onClick={() => onSelectDate(day)}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
