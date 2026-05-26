import type { WidgetRenderStyle } from "../widgetRenderStyle";

function greetingForHour(h: number): string {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function TodayOverviewWidget({
  style,
  customTitle,
  accentColor,
}: {
  style: WidgetRenderStyle;
  customTitle?: string;
  accentColor?: string;
}) {
  const now = new Date();
  const compact = style.layout === "compact";
  const title = customTitle?.trim() || greetingForHour(now.getHours());
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: compact ? "short" : "long",
    month: "long",
    day: "numeric",
  });

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
          Your board is ready — open the widget library to add tasks, mail, music, and more.
        </p>
      )}
      <div className="widget--today__chips">
        <span className="widget--today__chip">Focus</span>
        <span className="widget--today__chip">Inbox</span>
        <span className="widget--today__chip">Calendar</span>
      </div>
    </div>
  );
}
