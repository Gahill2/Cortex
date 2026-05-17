import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Tab } from "../App";
import { CanvasDashboard } from "../components/canvas/CanvasDashboard";
import type { HomeBoardTask } from "../components/home/HomeDashboardTop";
import {
  AIWidget,
  MailWidget,
  SpotifyWidget,
  TasksWidget,
  WeatherWidget,
} from "../components/home/widgets";
import { PomodoroWidget } from "../components/canvas/widgets/PomodoroWidget";
import { WorldClockWidget } from "../components/canvas/widgets/WorldClockWidget";
import { HabitTrackerWidget } from "../components/canvas/widgets/HabitTrackerWidget";
import { QuoteWidget } from "../components/canvas/widgets/QuoteWidget";

interface Props {
  onNavigate: (tab: Tab) => void;
}

export const HomePage = ({ onNavigate }: Props) => {
  const [boardTasks, setBoardTasks] = useState<HomeBoardTask[]>([]);
  const [boardDataLoading, setBoardDataLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setBoardDataLoading(true);
    Promise.all([api.get("/tasks"), api.get("/projects")])
      .then(([tr, _pr]) => {
        if (cancelled) return;
        const t: HomeBoardTask[] = Array.isArray(tr.data) ? tr.data : (tr.data?.data ?? []);
        setBoardTasks(t);
      })
      .catch(() => {
        if (!cancelled) setBoardTasks([]);
      })
      .finally(() => {
        if (!cancelled) setBoardDataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const widgets: Record<string, React.ReactNode> = {
    weather: <WeatherWidget />,
    tasks: <TasksWidget onNavigate={onNavigate} tasks={boardTasks} loading={boardDataLoading} />,
    mail: <MailWidget onNavigate={onNavigate} compact />,
    spotify: <SpotifyWidget onNavigate={onNavigate} />,
    ai: <AIWidget onNavigate={onNavigate} />,
    pomodoro: <PomodoroWidget />,
    clock: <WorldClockWidget />,
    habits: <HabitTrackerWidget />,
    quote: <QuoteWidget />,
  };

  return <CanvasDashboard onNavigate={onNavigate} widgets={widgets} />;
};
