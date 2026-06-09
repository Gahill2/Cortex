import type { ReactNode } from "react";
import type { Tab } from "../../App";
import type { HomeBoardTask } from "../home/types";
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
import { AtAGlanceWidget } from "./widgets/AtAGlanceWidget";
import { MediaStatusWidget } from "./widgets/MediaStatusWidget";
import type { WidgetRenderStyle } from "./widgetRenderStyle";
import type { WidgetInstanceConfig } from "../../dashboard/types";
import {
  type BoardTypography,
  effectiveTextPx,
  resolveWidgetTypography,
  widgetHasOwnTypography,
} from "../../lib/uiCustomization";
import { CanvasWidgetErrorBoundary } from "./CanvasWidgetErrorBoundary";

function widgetShell(
  key: string,
  style: WidgetRenderStyle,
  child: ReactNode,
  config: Record<string, unknown> | undefined,
  boardTypography: BoardTypography,
) {
  const typo = resolveWidgetTypography(config, boardTypography);
  const renderedPx = effectiveTextPx(typo);
  const shellStyle: React.CSSProperties = {
    "--widget-font-body": `var(--home-font-body, ${style.fontFamily})`,
    "--widget-font-display": `var(--home-font-body, ${style.displayFontFamily})`,
    "--widget-text-base-px": `${typo.textSizePx}px`,
    "--widget-text-scale": String(typo.textScale),
    "--widget-text-size-px": `${renderedPx}px`,
  } as React.CSSProperties;
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
      data-widget-text-px={renderedPx}
      data-widget-text-custom={widgetHasOwnTypography(config) ? "true" : undefined}
      style={shellStyle}
    >
      <CanvasWidgetErrorBoundary widgetKey={key}>{child}</CanvasWidgetErrorBoundary>
    </div>
  );
}

export function createCanvasWidgetRenderer(
  onNavigate: (t: Tab) => void,
  boardTasks: HomeBoardTask[],
  boardDataLoading: boolean,
  boardTypography: BoardTypography = { textSizePx: 24, textScale: 1 },
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
    const shellConfig = instance?.widgetConfig;

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
          shellConfig,
          boardTypography,
        );
      case "at-a-glance":
        return widgetShell(
          key,
          style,
          <AtAGlanceWidget
            style={style}
            onNavigate={onNavigate}
            boardTasks={boardTasks}
            boardTasksLoading={boardDataLoading}
          />,
          shellConfig,
          boardTypography,
        );
      case "media":
        return widgetShell(
          key,
          style,
          <MediaStatusWidget onNavigate={onNavigate} compact={compact} />,
          shellConfig,
          boardTypography,
        );
      case "calendar":
        return widgetShell(
          key,
          style,
          <CalendarWidget onNavigate={onNavigate} compact={compact} />,
          shellConfig,
          boardTypography,
        );
      case "goals":
        return widgetShell(
          key,
          style,
          <GoalsWidget onNavigate={onNavigate} compact={compact} />,
          shellConfig,
          boardTypography,
        );
      case "notes":
        return widgetShell(key, style, <NotesWidget compact={compact} />, shellConfig, boardTypography);
      case "automations":
        return widgetShell(
          key,
          style,
          <AutomationsWidget onNavigate={onNavigate} compact={compact} />,
          shellConfig,
          boardTypography,
        );
      case "system":
        return widgetShell(key, style, <SystemStatusWidget compact={compact} />, shellConfig, boardTypography);
      case "weather":
        return widgetShell(
          key,
          style,
          <WeatherWidget display={style.display} layout={style.layout} />,
          shellConfig,
          boardTypography,
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
          shellConfig,
          boardTypography,
        );
      case "mail":
        return widgetShell(key, style, <MailWidget onNavigate={onNavigate} compact={compact} />, shellConfig, boardTypography);
      case "spotify":
        return widgetShell(key, style, <SpotifyWidget onNavigate={onNavigate} />, shellConfig, boardTypography);
      case "ai":
        return widgetShell(key, style, <AIWidget onNavigate={onNavigate} />, shellConfig, boardTypography);
      case "pomodoro":
        return widgetShell(key, style, <PomodoroWidget />, shellConfig, boardTypography);
      case "clock":
        return widgetShell(
          key,
          style,
          <WorldClockWidget display={style.display} layout={style.layout} />,
          shellConfig,
          boardTypography,
        );
      case "habits":
        return widgetShell(key, style, <HabitTrackerWidget />, shellConfig, boardTypography);
      case "quote":
        return widgetShell(key, style, <QuoteWidget />, shellConfig, boardTypography);
      case "homelab":
        return widgetShell(
          key,
          style,
          <HomelabWidget onNavigate={onNavigate} compact={compact} />,
          shellConfig,
          boardTypography,
        );
      default:
        return null;
    }
  };
}
