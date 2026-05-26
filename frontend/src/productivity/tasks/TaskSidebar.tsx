import {
  Briefcase,
  Calendar,
  CalendarClock,
  Filter,
  FolderKanban,
  Inbox,
  Infinity,
  Sun,
  Tag,
} from "lucide-react";
import type { TaskListKey } from "../types";
import { MOCK_AREAS, MOCK_LABELS, MOCK_PROJECTS } from "../mockData";
import { ProductivitySidebar, SidebarNavItem, SidebarSection } from "../ProductivitySidebar";
import type { PlannerTask } from "../../components/tasks-calendar/types";

interface Props {
  listKey: TaskListKey;
  onListChange: (key: TaskListKey, meta?: { projectId?: string; areaId?: string; labelId?: string }) => void;
  tasks: PlannerTask[];
}

const SMART: { key: TaskListKey; label: string; icon: typeof Inbox }[] = [
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "today", label: "Today", icon: Sun },
  { key: "upcoming", label: "Upcoming", icon: CalendarClock },
  { key: "anytime", label: "Anytime", icon: Calendar },
  { key: "someday", label: "Someday", icon: Infinity },
];

function badge(tasks: PlannerTask[], key: TaskListKey): number | undefined {
  if (key === "today") return tasks.filter((t) => t.group === "today" && !t.completed).length || undefined;
  if (key === "upcoming") return tasks.filter((t) => t.group === "upcoming" && !t.completed).length || undefined;
  if (key === "inbox") return tasks.filter((t) => !t.completed).length || undefined;
  return undefined;
}

export function TaskSidebar({ listKey, onListChange, tasks }: Props) {
  return (
    <ProductivitySidebar title="Tasks">
      <SidebarSection label="Lists">
        {SMART.map((item) => {
          const Icon = item.icon;
          return (
            <SidebarNavItem
              key={item.key}
              icon={<Icon size={16} />}
              label={item.label}
              count={badge(tasks, item.key)}
              active={listKey === item.key}
              onClick={() => onListChange(item.key)}
            />
          );
        })}
      </SidebarSection>
      <SidebarSection label="Projects">
        {MOCK_PROJECTS.map((p) => (
          <SidebarNavItem
            key={p.id}
            icon={<FolderKanban size={16} style={{ color: p.color }} />}
            label={p.name}
            active={listKey === "project"}
            indent
            onClick={() => onListChange("project", { projectId: p.id })}
          />
        ))}
      </SidebarSection>
      <SidebarSection label="Areas">
        {MOCK_AREAS.map((a) => (
          <SidebarNavItem
            key={a.id}
            icon={<Briefcase size={16} />}
            label={a.name}
            active={listKey === "area"}
            indent
            onClick={() => onListChange("area", { areaId: a.id })}
          />
        ))}
      </SidebarSection>
      <SidebarSection label="Labels">
        {MOCK_LABELS.map((l) => (
          <SidebarNavItem
            key={l.id}
            icon={<Tag size={16} style={{ color: l.color }} />}
            label={l.name}
            active={listKey === "label"}
            indent
            onClick={() => onListChange("label", { labelId: l.id })}
          />
        ))}
      </SidebarSection>
      <SidebarNavItem
        icon={<Filter size={16} />}
        label="Filters"
        active={listKey === "filter"}
        onClick={() => onListChange("filter")}
      />
    </ProductivitySidebar>
  );
}
