import type { CSSProperties } from "react";
import type { PlannerEvent } from "../../components/tasks-calendar/types";
import { CATEGORY_COLORS } from "../mockData";

interface Props {
  event: PlannerEvent;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function EventCard({ event, selected, compact, onClick }: Props) {
  const color = event.color ?? CATEGORY_COLORS[event.category ?? "Work"] ?? "#5b8dff";
  const style = { ["--ev-color" as string]: color } as CSSProperties;

  return (
    <button
      type="button"
      className={`pd-event-card${selected ? " pd-event-card--selected" : ""}${compact ? " pd-event-card--compact" : ""}`}
      style={style}
      onClick={onClick}
    >
      <span className="pd-event-card__accent" aria-hidden />
      <span className="pd-event-card__body">
        <span className="pd-event-card__title">{event.title}</span>
        {!event.allDay ? (
          <span className="pd-event-card__time">
            {fmtTime(event.start)} – {fmtTime(event.end)}
          </span>
        ) : (
          <span className="pd-event-card__time">All day</span>
        )}
        {event.category ? <span className="pd-event-card__cat">{event.category}</span> : null}
      </span>
    </button>
  );
}
