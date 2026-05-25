import * as ContextMenu from "@radix-ui/react-context-menu";
import type { PlannerTask } from "./types";
type TaskStatus = NonNullable<PlannerTask["status"]>;

interface Props {
  task: PlannerTask;
  children: React.ReactNode;
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
}

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: "TODO", label: "Not started" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "DONE", label: "Completed" },
];

export function TaskContextMenu({ task, children, onUpdateStatus, onDelete }: Props) {
  const currentStatus = task.status ?? (task.completed ? "DONE" : "TODO");

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="ctx-menu-content" alignOffset={-4}>
          <ContextMenu.Label className="ctx-menu-label">{task.title}</ContextMenu.Label>
          <ContextMenu.Separator className="ctx-menu-separator" />
          <ContextMenu.Label className="ctx-menu-sublabel">Move to</ContextMenu.Label>
          {STATUS_OPTIONS.map((opt) => (
            <ContextMenu.Item
              key={opt.value}
              className="ctx-menu-item"
              disabled={currentStatus === opt.value}
              onClick={() => onUpdateStatus(task.id, opt.value)}
            >
              <span className={`ctx-menu-dot ctx-menu-dot--${opt.value.toLowerCase()}`} />
              {opt.label}
            </ContextMenu.Item>
          ))}
          <ContextMenu.Separator className="ctx-menu-separator" />
          <ContextMenu.Item
            className="ctx-menu-item ctx-menu-item--danger"
            onClick={() => onDelete(task.id)}
          >
            Delete task
          </ContextMenu.Item>
          <ContextMenu.Arrow className="ctx-menu-arrow" />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
