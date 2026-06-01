import type { Tab } from "../../../App";
import type { WidgetRenderStyle } from "../widgetRenderStyle";
import { useDashboardDataContextOptional } from "../../../productivity-dashboard/hooks/useDashboardDataContext";
import { useUiCustomization } from "../../../hooks/useUiCustomization";
import { goalProgress } from "../../../lib/uiCustomization";

function greetingForHour(h: number): string {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function TodayOverviewWidget({
  style,
  customTitle,
  accentColor,
  onNavigate,
}: {
  style: WidgetRenderStyle;
  customTitle?: string;
  accentColor?: string;
  onNavigate?: (t: Tab) => void;
}) {
  const now = new Date();
  const compact = style.layout === "compact";
  const title = customTitle?.trim() || greetingForHour(now.getHours());
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: compact ? "short" : "long",
    month: "long",
    day: "numeric",
  });

  const dash = useDashboardDataContextOptional();
  const { goals } = useUiCustomization();
  const openTasks = dash?.tasks.filter((t) => !t.completed).length ?? 0;
  const todayEvents = dash?.todayEvents.length ?? 0;
  const activeGoals = goals.filter((g) => !g.done);
  const avgGoal =
    activeGoals.length === 0
      ? 0
      : Math.round(activeGoals.reduce((s, g) => s + goalProgress(g), 0) / activeGoals.length);

  return (
    <div
      className="widget widget--today"
      style={accentColor ? ({ "--widget-accent": accentColor } as React.CSSProperties) : undefined}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="widget--today__glow" aria-hidden />
      <p className="widget--today__eyebrow">{dateStr}</p>
      <h2 className="widget--today__title">{title}</h2>
      {!compact && (
        <p className="widget--today__summary">
          {openTasks} open task{openTasks === 1 ? "" : "s"}
          {todayEvents > 0 ? ` · ${todayEvents} event${todayEvents === 1 ? "" : "s"} today` : ""}
          {activeGoals.length > 0 ? ` · ${activeGoals.length} active goal${activeGoals.length === 1 ? "" : "s"} (${avgGoal}%)` : ""}
        </p>
      )}
      <div className="widget--today__chips">
        <button type="button" className="widget--today__chip" onClick={() => onNavigate?.("tasks")}>
          Tasks
        </button>
        <button type="button" className="widget--today__chip" onClick={() => onNavigate?.("calendar")}>
          Calendar
        </button>
        <button type="button" className="widget--today__chip" onClick={() => onNavigate?.("tasks")}>
          Goals
        </button>
      </div>
    </div>
  );
}
