import type { ReactNode } from "react";
import type { Tab } from "../../App";
import type { HomeBoardTask } from "../home/HomeDashboardTop";
import {
  AIWidget,
  MailWidget,
  SpotifyWidget,
  TasksWidget,
  WeatherWidget,
} from "../home/widgets";
import { PomodoroWidget } from "./widgets/PomodoroWidget";
import { WorldClockWidget } from "./widgets/WorldClockWidget";
import { HabitTrackerWidget } from "./widgets/HabitTrackerWidget";
import { QuoteWidget } from "./widgets/QuoteWidget";
import type { WidgetRenderStyle } from "./widgetRenderStyle";

function widgetShell(key: string, style: WidgetRenderStyle, child: ReactNode) {
  return (
    <div
      className={[
        "canvas-widget-shell",
        `widget--size-${style.variant}`,
        `widget--layout-${style.layout}`,
        `widget-skin--${style.skin}`,
        `widget-display--${style.display}`,
      ].join(" ")}
      data-widget-size={style.variant}
      data-widget-layout={style.layout}
      data-widget-skin={style.skin}
      data-widget-display={style.display}
      style={
        {
          "--widget-font-body": style.fontFamily,
          "--widget-font-display": style.displayFontFamily,
        } as React.CSSProperties
      }
    >
      {child}
    </div>
  );
}

export function createCanvasWidgetRenderer(
  onNavigate: (t: Tab) => void,
  boardTasks: HomeBoardTask[],
  boardDataLoading: boolean,
) {
  return (key: string, style: WidgetRenderStyle): ReactNode => {
    const compact = style.layout === "compact";
    const taskLimit = style.variant === "small" ? 2 : style.variant === "large" ? 6 : 4;

    switch (key) {
      case "weather":
        return widgetShell(
          key,
          style,
          <WeatherWidget display={style.display} layout={style.layout} />,
        );
      case "tasks":
        return widgetShell(
          key,
          style,
          <TasksWidget
            onNavigate={onNavigate}
            tasks={boardTasks}
            loading={boardDataLoading}
            previewLimit={taskLimit}
          />,
        );
      case "mail":
        return widgetShell(key, style, <MailWidget onNavigate={onNavigate} compact={compact} />);
      case "spotify":
        return widgetShell(key, style, <SpotifyWidget onNavigate={onNavigate} />);
      case "ai":
        return widgetShell(key, style, <AIWidget onNavigate={onNavigate} />);
      case "pomodoro":
        return widgetShell(key, style, <PomodoroWidget />);
      case "clock":
        return widgetShell(
          key,
          style,
          <WorldClockWidget display={style.display} layout={style.layout} />,
        );
      case "habits":
        return widgetShell(key, style, <HabitTrackerWidget />);
      case "quote":
        return widgetShell(key, style, <QuoteWidget />);
      default:
        return null;
    }
  };
}
