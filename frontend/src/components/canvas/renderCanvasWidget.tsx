import type { ReactNode } from "react";
import type { Tab } from "../../App";
import type { HomeBoardTask } from "../home/HomeDashboardTop";
import {
  AIWidget,
  MailWidget,
  HomelabWidget,
  SpotifyWidget,
  TasksWidget,
  WeatherWidget,
} from "../home/widgets";
import { PomodoroWidget } from "./widgets/PomodoroWidget";
import { WorldClockWidget } from "./widgets/WorldClockWidget";
import { HabitTrackerWidget } from "./widgets/HabitTrackerWidget";
import { QuoteWidget } from "./widgets/QuoteWidget";
import { TodayOverviewWidget } from "./widgets/TodayOverviewWidget";
import { CalendarWidget } from "./widgets/CalendarWidget";
import { GoalsWidget } from "./widgets/GoalsWidget";
import { NotesWidget } from "./widgets/NotesWidget";
import { AutomationsWidget } from "./widgets/AutomationsWidget";
import { SystemStatusWidget } from "./widgets/SystemStatusWidget";
import type { WidgetRenderStyle } from "./widgetRenderStyle";
import type { WidgetInstanceConfig } from "../../dashboard/types";

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
          "--widget-font-body": `var(--home-font-body, ${style.fontFamily})`,
          "--widget-font-display": `var(--home-font-body, ${style.displayFontFamily})`,
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
  return (
    key: string,
    style: WidgetRenderStyle,
    instance?: { title?: string; widgetConfig?: Record<string, unknown> },
  ): ReactNode => {
    const compact = style.layout === "compact";
    const taskLimit = style.variant === "small" ? 2 : style.variant === "large" ? 6 : 4;
    const cfg = (instance?.widgetConfig ?? {}) as WidgetInstanceConfig;
    const customTitle =
      (typeof cfg.title === "string" ? cfg.title : undefined) ?? instance?.title;
    const accentColor =
      typeof cfg.accentColor === "string" ? cfg.accentColor : undefined;

    switch (key) {
      case "today":
        return widgetShell(
          key,
          style,
          <TodayOverviewWidget
            style={style}
            customTitle={customTitle}
            accentColor={accentColor}
            onNavigate={onNavigate}
          />,
        );
      case "calendar":
        return widgetShell(
          key,
          style,
          <CalendarWidget onNavigate={onNavigate} compact={compact} />,
        );
      case "goals":
        return widgetShell(
          key,
          style,
          <GoalsWidget onNavigate={onNavigate} compact={compact} />,
        );
      case "notes":
        return widgetShell(key, style, <NotesWidget compact={compact} />);
      case "automations":
        return widgetShell(
          key,
          style,
          <AutomationsWidget onNavigate={onNavigate} compact={compact} />,
        );
      case "system":
        return widgetShell(key, style, <SystemStatusWidget compact={compact} />);
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
      case "homelab":
        return widgetShell(
          key,
          style,
          <HomelabWidget onNavigate={onNavigate} compact={compact} />,
        );
      default:
        return null;
    }
  };
}
