import type { CalendarViewMode } from "../types";
import type { CalendarRangeView, PlannerEvent } from "../../components/tasks-calendar/types";
import { TasksCalendarSchedule } from "../../components/tasks-calendar/TasksCalendarSchedule";

interface Props {
  view: CalendarViewMode;
  viewDate: Date;
  events: PlannerEvent[];
  selectedEventId: string | null;
  saving: boolean;
  onSelectEvent: (ev: PlannerEvent) => void;
  onReschedule: (ev: PlannerEvent, start: Date, end: Date) => void;
}

function toRangeView(view: CalendarViewMode): CalendarRangeView {
  if (view === "week") return "workweek";
  return view;
}

/** Routes to the correct calendar surface for the active view mode. */
export function CalendarGrid(props: Props) {
  const calView = toRangeView(props.view);
  return (
    <div className={`pd-cal-grid pd-cal-grid--${props.view}`}>
      <TasksCalendarSchedule {...props} calView={calView} />
    </div>
  );
}

export { DayTimelineView } from "./DayTimelineView";
export { WeekTimelineView } from "./WeekTimelineView";
export { MonthCalendarView } from "./MonthCalendarView";
export { AgendaCalendarView } from "./AgendaCalendarView";
