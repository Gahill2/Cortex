import { useCallback, useMemo, useState } from "react";
import { CheckSquare, Flag } from "lucide-react";
import type { Tab } from "../tab";
import { useUiCustomization } from "../hooks/useUiCustomization";
import type { CortexGoal } from "../lib/uiCustomization";
import { newId } from "../lib/newId";
import { TasksCalendarKanban } from "../components/tasks-calendar/TasksCalendarKanban";
import { useTasksCalendarData } from "../components/tasks-calendar/useTasksCalendarData";
import { ProductivityShell } from "../productivity/ProductivityShell";
import { EventInspectorPanel } from "../productivity/calendar/EventInspectorPanel";
import { TaskSidebar } from "../productivity/tasks/TaskSidebar";
import { TasksTopBar, getListTitle } from "../productivity/tasks/TasksTopBar";
import { TaskCreateBar } from "../productivity/tasks/TaskCreateBar";
import { TasksPlanBoard } from "../productivity/tasks/TasksPlanBoard";
import { TasksPageTabs, type TasksPageTab } from "../productivity/tasks/TasksPageTabs";
import { EmptyState } from "../productivity/shared/EmptyState";
import type { TaskListKey, TaskSortKey } from "../productivity/types";
import {
  filterTasksBySearch,
  sortTasks,
  toPlannerCalView,
} from "../productivity/tasks/taskListUtils";
import {
  filterPlanItems,
  groupPlanItemsByProgress,
  parseProgressFromNotes,
  type PlanItem,
} from "../productivity/tasks/taskProgressGroups";

interface Props {
  onNavigate?: (tab: Tab) => void;
}

function itemKey(item: PlanItem): string {
  return item.kind === "task" ? `t:${item.task.id}` : `g:${item.goal.id}`;
}

const GOAL_LIST_KEYS = new Set<TaskListKey>(["all", "completed"]);

export function TasksPage({ onNavigate }: Props) {
  const { goals, setGoals } = useUiCustomization();
  const [pageTab, setPageTab] = useState<TasksPageTab>("tasks");
  const [listKey, setListKey] = useState<TaskListKey>("all");
  const [listMeta, setListMeta] = useState<{ projectId?: string }>();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<TaskSortKey>("priority");
  const [boardMode, setBoardMode] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [createFocusToken, setCreateFocusToken] = useState(0);

  const viewDate = useMemo(() => new Date(), []);
  const calView = toPlannerCalView("week");

  const {
    tasks,
    projects,
    loading,
    busy,
    tasksError,
    toggleTask,
    createTaskFromNl,
    createOpenTask,
    quickAddTask,
    updateTaskStatus,
    updateTask,
    deleteTask,
    createProject,
    refresh,
  } = useTasksCalendarData(viewDate, calView);

  const projectSidebar = useMemo(
    () =>
      projects.map((p) => ({
        id: p.id,
        name: p.name,
        taskCount: tasks.filter((t) => t.projectId === p.id && !t.completed).length,
      })),
    [projects, tasks],
  );

  const searchedTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = tasks;
    if (q) {
      list = filterTasksBySearch(tasks, search);
    }
    return sortTasks(list, sort);
  }, [tasks, search, sort]);

  const activeGoals = useMemo(() => {
    const base =
      listKey === "completed"
        ? goals.filter((g) => g.done)
        : goals.filter((g) => !g.done);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((g) => g.text.toLowerCase().includes(q));
  }, [goals, listKey, search]);

  const planItems = useMemo(() => {
    if (pageTab === "goals") {
      return activeGoals.map((goal) => ({ kind: "goal" as const, goal }));
    }
    const filtered = filterPlanItems(searchedTasks, [], listKey, listMeta);
    if (!search.trim()) return filtered;
    const q = search.trim().toLowerCase();
    return filtered.filter((i) => {
      if (i.kind === "task") {
        return (
          i.task.title.toLowerCase().includes(q) ||
          (i.task.notes?.toLowerCase().includes(q) ?? false)
        );
      }
      return false;
    });
  }, [pageTab, searchedTasks, activeGoals, listKey, listMeta, search]);

  const progressSections = useMemo(
    () => groupPlanItemsByProgress(planItems, listKey !== "completed"),
    [planItems, listKey],
  );

  const selectedItem = useMemo((): PlanItem | null => {
    if (!selectedKey) return null;
    if (selectedKey.startsWith("t:")) {
      const id = selectedKey.slice(2);
      const task = tasks.find((t) => t.id === id);
      return task ? { kind: "task", task } : null;
    }
    if (selectedKey.startsWith("g:")) {
      const id = selectedKey.slice(2);
      const goal = goals.find((g) => g.id === id);
      return goal ? { kind: "goal", goal } : null;
    }
    return null;
  }, [selectedKey, tasks, goals]);

  const selectedTask = selectedItem?.kind === "task" ? selectedItem.task : null;
  const selectedGoal = selectedItem?.kind === "goal" ? selectedItem.goal : null;

  const title =
    pageTab === "tasks" && listKey === "project" && listMeta?.projectId
      ? projects.find((p) => p.id === listMeta.projectId)?.name ?? "Project"
      : getListTitle(listKey, pageTab);

  const openCount = planItems.length;
  const openTaskCount = useMemo(
    () => tasks.filter((t) => !t.completed).length,
    [tasks],
  );
  const openGoalCount = useMemo(
    () => goals.filter((g) => !g.done).length,
    [goals],
  );

  const onListChange = (key: TaskListKey, meta?: { projectId?: string }) => {
    setListKey(key);
    setListMeta(meta);
    setSelectedKey(null);
  };

  const onPageTabChange = (tab: TasksPageTab) => {
    setPageTab(tab);
    setBoardMode(false);
    if (
      selectedKey &&
      ((tab === "tasks" && selectedKey.startsWith("g:")) ||
        (tab === "goals" && selectedKey.startsWith("t:")))
    ) {
      setSelectedKey(null);
    }
    if (tab === "goals" && !GOAL_LIST_KEYS.has(listKey)) {
      setListKey("all");
      setListMeta(undefined);
    }
    if (tab === "tasks" && listKey === "completed" && goals.some((g) => g.done) && !tasks.some((t) => t.completed)) {
      setListKey("all");
    }
  };

  const handleCreateTask = useCallback(
    async (fields: { title: string; dueDate?: string | null; notes?: string }) => {
      let id: string | null;
      if (fields.dueDate) {
        id = await createTaskFromNl(
          `${fields.title} due ${fields.dueDate}${fields.notes ? `. ${fields.notes}` : ""}`,
        );
      } else {
        id = await createOpenTask(fields.title, fields.notes?.trim() || null);
      }
      if (!id) return null;
      const parsed = fields.notes ? parseProgressFromNotes(fields.notes) : null;
      if (parsed !== null) {
        await updateTask(id, { progressPercent: parsed, description: fields.notes ?? null });
      } else if (fields.notes?.trim()) {
        await updateTask(id, { description: fields.notes.trim() });
      }
      setSelectedKey(`t:${id}`);
      setBoardMode(false);
      return id;
    },
    [createTaskFromNl, createOpenTask, updateTask],
  );

  const handleCreateGoal = useCallback(
    (fields: { title: string; targetDate?: string | null; estimateHours?: number }) => {
      const row: CortexGoal = {
        id: newId("goal"),
        text: fields.title,
        done: false,
        estimateHours: fields.estimateHours ?? 4,
        progressPercent: 0,
        targetDate: fields.targetDate ?? undefined,
      };
      setGoals((prev) => [...prev, row]);
      setSelectedKey(`g:${row.id}`);
    },
    [setGoals],
  );

  const handleCreateProject = async () => {
    const name = window.prompt("Project name");
    if (!name?.trim()) return;
    const id = await createProject(name);
    if (id) onListChange("project", { projectId: id });
  };

  const handleToggleGoal = (id: string) => {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === id
          ? {
              ...g,
              done: !g.done,
              progressPercent: !g.done ? 100 : g.progressPercent ?? 0,
            }
          : g,
      ),
    );
  };

  const handleUpdateGoal = (id: string, patch: Partial<CortexGoal>) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const handleDeleteGoal = (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    if (selectedKey === `g:${id}`) setSelectedKey(null);
  };

  const boardTasks = useMemo(() => searchedTasks, [searchedTasks]);

  return (
    <div className="pd-route pd-route--tasks pd-route--planner">
      <ProductivityShell
        mobileSidebarOpen={mobileSidebarOpen}
        onMobileSidebarOpenChange={setMobileSidebarOpen}
        mobileInspectorOpen={mobileInspectorOpen}
        onMobileInspectorOpenChange={setMobileInspectorOpen}
        left={
          <TaskSidebar
            pageTab={pageTab}
            listKey={listKey}
            listMeta={listMeta}
            onListChange={(key, meta) => {
              onListChange(key, meta);
              setMobileSidebarOpen(false);
            }}
            tasks={tasks}
            goals={goals}
            projects={projectSidebar}
            onCreateProject={() => void handleCreateProject()}
            onOpenCalendar={() => onNavigate?.("calendar")}
          />
        }
        main={
          <div className="pd-route__stack pd-route__stack--planner">
            <TasksPageTabs
              tab={pageTab}
              taskCount={openTaskCount}
              goalCount={openGoalCount}
              onChange={onPageTabChange}
            />
            <TasksTopBar
              pageTab={pageTab}
              title={title}
              count={openCount}
              search={search}
              onSearchChange={setSearch}
              sort={sort}
              onSortChange={setSort}
              boardMode={boardMode}
              onBoardModeChange={setBoardMode}
              onQuickAdd={() => setCreateFocusToken((n) => n + 1)}
              onRefresh={() => void refresh()}
              busy={busy}
              onOpenSidebar={() => setMobileSidebarOpen(true)}
              onOpenInspector={() => setMobileInspectorOpen(true)}
              showInspectorButton={Boolean(selectedItem)}
            />
            {pageTab === "tasks" && projects.length === 0 && !loading ? (
              <p className="pd-route__banner" role="status">
                Create a project for API-backed tasks. Goals work without one.{" "}
                <button type="button" className="pd-link-btn" onClick={() => void handleCreateProject()}>
                  Add project
                </button>
              </p>
            ) : null}
            {tasksError ? (
              <p className="pd-route__banner pd-route__banner--error" role="alert">
                {tasksError}
              </p>
            ) : null}
            <TaskCreateBar
              busy={busy}
              focusToken={createFocusToken}
              lockedKind={pageTab === "goals" ? "goal" : "task"}
              onCreateTask={handleCreateTask}
              onCreateGoal={handleCreateGoal}
            />
            {loading ? (
              <p className="pd-route__loading" aria-busy="true">
                Loading…
              </p>
            ) : null}
            <div className="pd-route__body pd-route__body--tasks">
              {pageTab === "tasks" && boardMode ? (
                <TasksCalendarKanban
                  tasks={boardTasks}
                  selectedTaskId={selectedTask?.id ?? null}
                  onSelectTask={(t) => {
                    setSelectedKey(`t:${t.id}`);
                    setMobileInspectorOpen(true);
                  }}
                  onUpdateStatus={(id, status) => void updateTaskStatus(id, status)}
                  onDeleteTask={(id) => {
                    void deleteTask(id);
                    if (selectedKey === `t:${id}`) setSelectedKey(null);
                  }}
                  onQuickAdd={async (status, t) => {
                    const id = await quickAddTask(status, t);
                    if (id) setSelectedKey(`t:${id}`);
                  }}
                />
              ) : progressSections.length === 0 ? (
                <EmptyState
                  icon={pageTab === "goals" ? Flag : CheckSquare}
                  title="Nothing here yet"
                  message={
                    pageTab === "goals"
                      ? "Add a goal above. Goals group by progress — track long-term outcomes here."
                      : "Add a task above. Items group by how far along you are — no due date required."
                  }
                />
              ) : (
                <TasksPlanBoard
                  sections={progressSections}
                  selectedKey={selectedKey}
                  collapsedSections={collapsedSections}
                  onToggleSection={(id) =>
                    setCollapsedSections((s) => ({ ...s, [id]: !s[id] }))
                  }
                  onSelectItem={(item) => {
                    setSelectedKey(itemKey(item));
                    setMobileInspectorOpen(true);
                  }}
                  onToggleTask={(id) => void toggleTask(id)}
                  onToggleGoal={handleToggleGoal}
                />
              )}
            </div>
          </div>
        }
        right={
          <EventInspectorPanel
            selectedEvent={null}
            selectedTask={selectedTask}
            selectedGoal={selectedGoal}
            projects={projects}
            onToggleTask={(id) => void toggleTask(id)}
            onUpdateTask={(id, patch) => updateTask(id, patch)}
            onDeleteTask={(id) => {
              void deleteTask(id);
              if (selectedKey === `t:${id}`) setSelectedKey(null);
            }}
            onToggleGoal={handleToggleGoal}
            onUpdateGoal={handleUpdateGoal}
            onDeleteGoal={handleDeleteGoal}
          />
        }
      />
    </div>
  );
}
