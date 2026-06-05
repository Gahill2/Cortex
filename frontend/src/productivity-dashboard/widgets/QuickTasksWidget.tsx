import { useMemo } from "react";
import { api } from "../../api/client";
import type { WidgetRenderProps } from "../types";
import { useDashboardDataContext } from "../hooks/useDashboardDataContext";
import { PdSectionHeader } from "../../components/ui/PdSectionHeader";
import { TaskRow, taskPriorityUi } from "./shared";

export function QuickTasksWidget(props: WidgetRenderProps) {
  const { tasks, tasksLoading, tasksError, refresh } = useDashboardDataContext();
  const title = (props.settings.title as string) || "Today";

  const todayTasks = useMemo(
    () => tasks.filter((t) => t.group === "today" && !t.completed),
    [tasks],
  );

  const toggleTask = async (id: string, completed: boolean) => {
    const nextStatus = completed ? "TODO" : "DONE";
    try {
      await api.patch(`/tasks/${id}`, { status: nextStatus });
      await refresh();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="pd-widget pd-widget--tasks">
      <PdSectionHeader
        title={title}
        eyebrow="Tasks"
        subtitle={
          tasksLoading ? "Loading…" : `${todayTasks.length} open`
        }
      />
      {tasksError ? <p className="pd-widget-empty">{tasksError}</p> : null}
      <div className="pd-widget-scroll">
        {todayTasks.length === 0 && !tasksLoading ? (
          <p className="pd-widget-empty">No tasks due today</p>
        ) : (
          todayTasks.slice(0, 8).map((t) => (
            <TaskRow
              key={t.id}
              title={t.title}
              done={t.completed}
              priority={taskPriorityUi(t.priority)}
              project={t.projectName}
              onToggle={() => void toggleTask(t.id, t.completed)}
            />
          ))
        )}
      </div>
      {props.onNavigate ? (
        <button type="button" className="pd-widget-link" onClick={() => props.onNavigate!("tasks")}>
          Open Tasks →
        </button>
      ) : null}
    </div>
  );
}
