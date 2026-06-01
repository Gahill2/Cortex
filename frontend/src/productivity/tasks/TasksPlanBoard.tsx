import type { CortexGoal } from "../../lib/uiCustomization";
import type { PlannerTask } from "../../components/tasks-calendar/types";
import { GoalRow } from "./GoalRow";
import { TaskRow } from "./TaskRow";
import { TaskSection } from "./TaskSection";
import type { ProgressSection, PlanItem } from "./taskProgressGroups";

interface Props {
  sections: ProgressSection[];
  selectedKey: string | null;
  collapsedSections: Record<string, boolean>;
  onToggleSection: (id: string) => void;
  onSelectItem: (item: PlanItem) => void;
  onToggleTask: (id: string) => void;
  onToggleGoal: (id: string) => void;
}

function itemKey(item: PlanItem): string {
  return item.kind === "task" ? `t:${item.task.id}` : `g:${item.goal.id}`;
}

export function TasksPlanBoard({
  sections,
  selectedKey,
  collapsedSections,
  onToggleSection,
  onSelectItem,
  onToggleTask,
  onToggleGoal,
}: Props) {
  return (
    <div className="pd-plan-board">
      {sections.map((section) => (
        <section key={section.id} className="pd-plan-board__section">
          <TaskSection
            title={section.title}
            count={section.items.length}
            subtitle={section.hint}
            collapsed={collapsedSections[section.id]}
            onToggleCollapse={() => onToggleSection(section.id)}
          />
          {!collapsedSections[section.id] ? (
            <div className="pd-plan-board__list">
              {section.items.map((item) => {
                const key = itemKey(item);
                if (item.kind === "task") {
                  return (
                    <TaskRow
                      key={key}
                      task={item.task}
                      selected={selectedKey === key}
                      onSelect={() => onSelectItem(item)}
                      onToggle={() => onToggleTask(item.task.id)}
                    />
                  );
                }
                return (
                  <GoalRow
                    key={key}
                    goal={item.goal}
                    selected={selectedKey === key}
                    onSelect={() => onSelectItem(item)}
                    onToggle={() => onToggleGoal(item.goal.id)}
                  />
                );
              })}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}
