import { Calendar } from "lucide-react";
import type { Tab } from "../../../App";

const SAMPLE_EVENTS = [
  { time: "9:00", title: "Standup", tone: "primary" },
  { time: "11:30", title: "Design review", tone: "neutral" },
  { time: "14:00", title: "Deep work block", tone: "focus" },
  { time: "16:30", title: "1:1 sync", tone: "neutral" },
];

export function CalendarWidget({
  onNavigate,
  compact,
}: {
  onNavigate?: (t: Tab) => void;
  compact?: boolean;
}) {
  const limit = compact ? 2 : 4;

  return (
    <div
      className="widget widget--calendar"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => onNavigate?.("calendar")}
      role={onNavigate ? "button" : undefined}
      tabIndex={onNavigate ? 0 : undefined}
    >
      <div className="widget--calendar__head">
        <Calendar size={18} strokeWidth={1.75} aria-hidden />
        <span>Upcoming</span>
      </div>
      <ul className="widget--calendar__list">
        {SAMPLE_EVENTS.slice(0, limit).map((ev) => (
          <li key={ev.title} className={`widget--calendar__row widget--calendar__row--${ev.tone}`}>
            <span className="widget--calendar__time">{ev.time}</span>
            <span className="widget--calendar__event">{ev.title}</span>
          </li>
        ))}
      </ul>
      {!compact && (
        <p className="widget--calendar__foot">Connect calendar sync in a future release.</p>
      )}
    </div>
  );
}
