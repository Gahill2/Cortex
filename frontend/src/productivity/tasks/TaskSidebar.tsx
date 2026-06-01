import {
  Calendar,
  CalendarClock,
  CheckCircle2,
  FolderKanban,
  Inbox,
  LayoutList,
} from "lucide-react";
import type { CortexGoal } from "../../lib/uiCustomization";
import type { TaskListKey } from "../types";
import { ProductivitySidebar, SidebarNavItem, SidebarSection } from "../ProductivitySidebar";
import type { PlannerTask } from "../../components/tasks-calendar/types";

export interface TaskSidebarProject {
  id: string;
  name: string;
  taskCount?: number;
}

interface Props {
  listKey: TaskListKey;
  listMeta?: { projectId?: string };
  onListChange: (key: TaskListKey, meta?: { projectId?: string }) => void;
  tasks: PlannerTask[];
  goals: CortexGoal[];
  projects: TaskSidebarProject[];
  onCreateProject?: () => void;
  onOpenCalendar?: () => void;
}

const LISTS: { key: TaskListKey; label: string; icon: typeof LayoutList }[] = [
  { key: "all", label: "All work", icon: LayoutList },
  { key: "inbox", label: "No due date", icon: Inbox },
  { key: "upcoming", label: "Scheduled", icon: CalendarClock },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
];

const PROJECT_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6", "#8b5cf6"];

function badge(tasks: PlannerTask[], goals: CortexGoal[], key: TaskListKey): number | undefined {
  if (key === "all") {
    const n = tasks.filter((t) => !t.completed).length + goals.filter((g) => !g.done).length;
    return n || undefined;
  }
  if (key === "upcoming") {
    return tasks.filter((t) => t.hasDueDate && !t.completed).length || undefined;
  }
  if (key === "inbox") {
    const n =
      tasks.filter((t) => !t.completed && !t.hasDueDate).length + goals.filter((g) => !g.done).length;
    return n || undefined;
  }
  if (key === "completed") {
    const n = tasks.filter((t) => t.completed).length + goals.filter((g) => g.done).length;
    return n || undefined;
  }
  return undefined;
}

export function TaskSidebar({
  listKey,
  listMeta,
  onListChange,
  tasks,
  goals,
  projects,
  onCreateProject,
  onOpenCalendar,
}: Props) {
  return (
    <ProductivitySidebar title="Tasks & goals">
      <SidebarSection label="Views">
        {LISTS.map((item) => {
          const Icon = item.icon;
          return (
            <SidebarNavItem
              key={item.key}
              icon={<Icon size={16} />}
              label={item.label}
              count={badge(tasks, goals, item.key)}
              active={listKey === item.key}
              onClick={() => onListChange(item.key)}
            />
          );
        })}
      </SidebarSection>
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
      <SidebarNavItem
        icon={<Calendar size={16} />}
        label="Open calendar"
        onClick={() => (onOpenCalendar ? onOpenCalendar() : onListChange("upcoming"))}
      />
    </ProductivitySidebar>
  );
}
