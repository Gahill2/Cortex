import {
  Calendar,
  CalendarClock,
  CheckCircle2,
  Flag,
  FolderKanban,
  Inbox,
  LayoutList,
} from "lucide-react";
import type { CortexGoal } from "../../lib/uiCustomization";
import type { TaskListKey } from "../types";
import { ProductivitySidebar, SidebarNavItem, SidebarSection } from "../ProductivitySidebar";
import type { PlannerTask } from "../../components/tasks-calendar/types";
import type { TasksPageTab } from "./TasksPageTabs";

export interface TaskSidebarProject {
  id: string;
  name: string;
  taskCount?: number;
}

interface Props {
  pageTab: TasksPageTab;
  listKey: TaskListKey;
  listMeta?: { projectId?: string };
  onListChange: (key: TaskListKey, meta?: { projectId?: string }) => void;
  tasks: PlannerTask[];
  goals: CortexGoal[];
  projects: TaskSidebarProject[];
  onCreateProject?: () => void;
  onOpenCalendar?: () => void;
}

const TASK_LISTS: { key: TaskListKey; label: string; icon: typeof LayoutList }[] = [
  { key: "all", label: "All tasks", icon: LayoutList },
  { key: "inbox", label: "No due date", icon: Inbox },
  { key: "upcoming", label: "Scheduled", icon: CalendarClock },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
];

const GOAL_LISTS: { key: TaskListKey; label: string; icon: typeof Flag }[] = [
  { key: "all", label: "Active goals", icon: Flag },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
];

const PROJECT_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6", "#8b5cf6"];

function taskBadge(tasks: PlannerTask[], key: TaskListKey): number | undefined {
  if (key === "all") return tasks.filter((t) => !t.completed).length || undefined;
  if (key === "upcoming") return tasks.filter((t) => t.hasDueDate && !t.completed).length || undefined;
  if (key === "inbox") return tasks.filter((t) => !t.completed && !t.hasDueDate).length || undefined;
  if (key === "completed") return tasks.filter((t) => t.completed).length || undefined;
  return undefined;
}

function goalBadge(goals: CortexGoal[], key: TaskListKey): number | undefined {
  if (key === "completed") return goals.filter((g) => g.done).length || undefined;
  return goals.filter((g) => !g.done).length || undefined;
}

export function TaskSidebar({
  pageTab,
  listKey,
  listMeta,
  onListChange,
  tasks,
  goals,
  projects,
  onCreateProject,
  onOpenCalendar,
}: Props) {
  const lists = pageTab === "goals" ? GOAL_LISTS : TASK_LISTS;

  return (
    <ProductivitySidebar title={pageTab === "goals" ? "Goals" : "Tasks"}>
      <SidebarSection label="Views">
        {lists.map((item) => {
          const Icon = item.icon;
          return (
            <SidebarNavItem
              key={item.key}
              icon={<Icon size={16} />}
              label={item.label}
              count={
                pageTab === "goals"
                  ? goalBadge(goals, item.key)
                  : taskBadge(tasks, item.key)
              }
              active={listKey === item.key}
              onClick={() => onListChange(item.key)}
            />
          );
        })}
      </SidebarSection>
      {pageTab === "tasks" ? (
      <SidebarSection label="Projects">
        {projects.length === 0 ? (
          <p className="pd-sidebar-empty">
            No projects yet.{" "}
            {onCreateProject ? (
              <button type="button" className="pd-sidebar-link" onClick={onCreateProject}>
                Create one
              </button>
            ) : null}
          </p>
        ) : (
          projects.map((p, i) => (
            <SidebarNavItem
              key={p.id}
              icon={<FolderKanban size={16} style={{ color: PROJECT_COLORS[i % PROJECT_COLORS.length] }} />}
              label={p.name}
              count={p.taskCount || undefined}
              active={listKey === "project" && listMeta?.projectId === p.id}
              indent
              onClick={() => onListChange("project", { projectId: p.id })}
            />
          ))
        )}
        {projects.length > 0 && onCreateProject ? (
          <button type="button" className="pd-sidebar-add" onClick={onCreateProject}>
            + New project
          </button>
        ) : null}
      </SidebarSection>
      ) : null}
      <SidebarNavItem
        icon={<Calendar size={16} />}
        label="Open calendar"
        onClick={() => (onOpenCalendar ? onOpenCalendar() : onListChange("upcoming"))}
      />
    </ProductivitySidebar>
  );
}
