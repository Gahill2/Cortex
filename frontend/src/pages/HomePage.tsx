import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Tab } from "../tab";
import { CanvasDashboard } from "../components/canvas/CanvasDashboard";
import type { HomeBoardTask } from "../components/home/HomeDashboardTop";
import { createCanvasWidgetRenderer } from "../components/canvas/renderCanvasWidget";
import { DashboardDataProvider } from "../productivity-dashboard/hooks/useDashboardDataContext";
import { useDashboardLayoutStore } from "../productivity-dashboard/state/dashboardLayoutStore";

interface Props {
  onNavigate: (tab: Tab) => void;
  onCommand?: () => void;
}

export const HomePage = ({ onNavigate, onCommand }: Props) => {
  const [boardTasks, setBoardTasks] = useState<HomeBoardTask[]>([]);
  const [boardDataLoading, setBoardDataLoading] = useState(true);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const editMode = useDashboardLayoutStore((s) => s.editMode);
  const setEditMode = useDashboardLayoutStore((s) => s.setEditMode);

  useEffect(() => {
    let cancelled = false;
    setBoardDataLoading(true);
    Promise.all([api.get("/tasks"), api.get("/projects")])
      .then(([tr]) => {
        if (cancelled) return;
        const body = tr.data as { data?: HomeBoardTask[] } | HomeBoardTask[];
        const t: HomeBoardTask[] = Array.isArray(body)
          ? body
          : Array.isArray(body?.data)
            ? body.data
            : [];
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
    <DashboardDataProvider>
      <div className="page home-page home-page--board">
        <div className="home-page__canvas-wrap">
          <CanvasDashboard
            onNavigate={onNavigate}
            onCommand={onCommand}
            renderWidget={renderWidget}
            editMode={editMode}
            onEditModeChange={setEditMode}
            libraryOpen={libraryOpen}
            onLibraryOpenChange={setLibraryOpen}
          />
        </div>
      </div>
    </DashboardDataProvider>
  );
};
