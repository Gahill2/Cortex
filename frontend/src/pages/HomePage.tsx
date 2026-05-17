import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Tab } from "../App";
import { HomeProduction } from "../components/home/HomeProduction";
import type { HomeBoardTask } from "../components/home/HomeDashboardTop";
import {
  AIWidget,
  MailWidget,
  SpotifyWidget,
  TasksWidget,
  WeatherWidget,
} from "../components/home/widgets";
import { useTheme } from "../hooks/useTheme";
import { useMediaQuery } from "../hooks/useMediaQuery";

interface Props {
  onNavigate: (tab: Tab) => void;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export const HomePage = ({ onNavigate }: Props) => {
  const { theme } = useTheme();
  const isNarrow = useMediaQuery("(max-width: 768px)");

  const [boardTasks, setBoardTasks] = useState<HomeBoardTask[]>([]);
  const [projectsCount, setProjectsCount] = useState(0);
  const [boardDataLoading, setBoardDataLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setBoardDataLoading(true);
    Promise.all([api.get("/tasks"), api.get("/projects")])
      .then(([tr, pr]) => {
        if (cancelled) return;
        const t: HomeBoardTask[] = Array.isArray(tr.data) ? tr.data : (tr.data?.data ?? []);
        const projects = Array.isArray(pr.data) ? pr.data : (pr.data?.data ?? []);
        setBoardTasks(t);
        setProjectsCount(projects.length);
      })
      .catch(() => {
        if (!cancelled) {
          setBoardTasks([]);
          setProjectsCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setBoardDataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <HomeProduction
      onNavigate={onNavigate}
      isNarrow={isNarrow}
      greeting={greeting()}
      themeName={theme?.name}
      tasks={boardTasks}
      projectsCount={projectsCount}
      loading={boardDataLoading}
      widgets={{
        weather: <WeatherWidget />,
        tasks: (
          <TasksWidget onNavigate={onNavigate} tasks={boardTasks} loading={boardDataLoading} />
        ),
        mail: <MailWidget onNavigate={onNavigate} compact />,
        spotify: <SpotifyWidget onNavigate={onNavigate} />,
        ai: <AIWidget onNavigate={onNavigate} />,
      }}
    />
  );
};
