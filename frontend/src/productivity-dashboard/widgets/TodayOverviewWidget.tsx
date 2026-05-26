import { useMemo } from "react";
import { CloudSun } from "lucide-react";
import type { WidgetRenderProps } from "../types";
import { formatGreeting, formatLongDate } from "../utils/dateUtils";
import { useDashboardDataContext } from "../hooks/useDashboardDataContext";
import { PdBadge } from "../../components/ui/PdBadge";

export function TodayOverviewWidget(_props: WidgetRenderProps) {
  const { tasks, todayEvents, tasksLoading, eventsLoading } = useDashboardDataContext();

  const todayTasks = useMemo(
    () => tasks.filter((t) => t.group === "today" && !t.completed).length,
    [tasks],
  );
  const events = todayEvents.length;

  return (
    <div className="pd-widget pd-widget--today">
      <p className="pd-widget--today__eyebrow">Today</p>
      <p className="pd-widget--today__greeting">{formatGreeting()}</p>
      <p className="pd-widget--today__date">{formatLongDate()}</p>
      <p className="pd-widget--today__focus">Your live tasks and calendar at a glance.</p>
      <div className="pd-widget--today__stats">
        <div className="pd-stat-pill">
          <span className="pd-stat-pill__value">{tasksLoading ? "…" : todayTasks}</span>
          <span className="pd-stat-pill__label">tasks</span>
        </div>
        <div className="pd-stat-pill">
          <span className="pd-stat-pill__value">{eventsLoading ? "…" : events}</span>
          <span className="pd-stat-pill__label">events</span>
        </div>
      </div>
      <div className="pd-widget--today__weather">
        <CloudSun size={18} strokeWidth={1.75} aria-hidden />
        <span>Connect calendar & mail in Settings</span>
        <PdBadge tone="neutral">Live</PdBadge>
      </div>
    </div>
  );
}
