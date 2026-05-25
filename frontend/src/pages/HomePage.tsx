import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Tab } from "../tab";
import { CanvasDashboard } from "../components/canvas/CanvasDashboard";
import type { HomeBoardTask } from "../components/home/HomeDashboardTop";
import { createCanvasWidgetRenderer } from "../components/canvas/renderCanvasWidget";

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

  const renderWidget = useMemo(
    () => createCanvasWidgetRenderer(onNavigate, boardTasks, boardDataLoading),
    [onNavigate, boardTasks, boardDataLoading],
  );

  return (
    <div className="page home-page home-page--canvas-full">
      <div className="page-workbench home-page__canvas-wrap">
        <CanvasDashboard onNavigate={onNavigate} renderWidget={renderWidget} />
      </div>
    </div>
  );
};
