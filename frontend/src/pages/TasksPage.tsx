import { useMemo, useState } from "react";
import { CheckSquare } from "lucide-react";
import type { Tab } from "../tab";
import { TasksCalendarKanban } from "../components/tasks-calendar/TasksCalendarKanban";
import { TasksCalendarQuickAdd } from "../components/tasks-calendar/TasksCalendarQuickAdd";
import { useTasksCalendarData } from "../components/tasks-calendar/useTasksCalendarData";
import { ProductivityShell } from "../productivity/ProductivityShell";
import { EventInspectorPanel } from "../productivity/calendar/EventInspectorPanel";
import { TaskSidebar } from "../productivity/tasks/TaskSidebar";
import { TaskRow } from "../productivity/tasks/TaskRow";
import { TaskSection } from "../productivity/tasks/TaskSection";
import { TasksTopBar, getListTitle } from "../productivity/tasks/TasksTopBar";
import { EmptyState } from "../productivity/shared/EmptyState";
import type { TaskListKey, TaskSortKey } from "../productivity/types";
import {
  filterTasksByList,
  filterTasksBySearch,
  groupTasksForList,
  sortTasks,
  toPlannerCalView,
} from "../productivity/tasks/taskListUtils";

interface Props {
  onNavigate?: (tab: Tab) => void;
}

export function TasksPage({ onNavigate }: Props) {
  const [listKey, setListKey] = useState<TaskListKey>("today");
  const [listMeta, setListMeta] = useState<{ projectId?: string; areaId?: string; labelId?: string }>();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<TaskSortKey>("due");
  const [boardMode, setBoardMode] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const viewDate = useMemo(() => new Date(), []);
  const calView = toPlannerCalView("week");

  const {
    tasks,
    loading,
    busy,
    tasksError,
    toggleTask,
    createTask,
    createTaskFromNl,
    quickAddTask,
    updateTaskStatus,
    deleteTask,
    refresh,
  } = useTasksCalendarData(viewDate, calView);

  const filtered = useMemo(() => {
    const byList = filterTasksByList(tasks, listKey, listMeta);
    const searched = filterTasksBySearch(byList, search);
    return sortTasks(searched, sort);
  }, [tasks, listKey, listMeta, search, sort]);

  const sections = useMemo(() => groupTasksForList(filtered, listKey), [filtered, listKey]);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  const title = getListTitle(listKey);

  const onListChange = (
    key: TaskListKey,
    meta?: { projectId?: string; areaId?: string; labelId?: string },
  ) => {
    setListKey(key);
    setListMeta(meta);
  };

  const onQuickAddNl = async (text: string) => {
    const id = await createTaskFromNl(text);
    if (id) {
      setSelectedTaskId(id);
      setBoardMode(false);
    }
    return id;
  };

  return (
    <div className="pd-route pd-route--tasks">
      <ProductivityShell
        left={<TaskSidebar listKey={listKey} onListChange={onListChange} tasks={tasks} />}
        main={
          <div className="pd-route__stack">
            <TasksTopBar
              title={title}
              count={filtered.filter((t) => !t.completed).length}
              search={search}
              onSearchChange={setSearch}
              sort={sort}
              onSortChange={setSort}
              boardMode={boardMode}
              onBoardModeChange={setBoardMode}
              onQuickAdd={() => void createTask().then((id) => id && setSelectedTaskId(id))}
              busy={busy}
            />
            {tasksError ? (
              <p className="pd-route__banner pd-route__banner--error" role="alert">
                {tasksError}
              </p>
            ) : null}
            <div className="pd-route__quick-add">
              <TasksCalendarQuickAdd busy={busy} onAdd={onQuickAddNl} />
            </div>
            {loading ? (
              <p className="pd-route__loading" aria-busy="true">
                Loading tasks…
              </p>
            ) : null}
            <div className="pd-route__body pd-route__body--tasks">
              {boardMode ? (
                <TasksCalendarKanban
                  tasks={filtered}
                  selectedTaskId={selectedTaskId}
                  onSelectTask={(t) => setSelectedTaskId(t.id)}
                  onUpdateStatus={(id, status) => void updateTaskStatus(id, status)}
                  onDeleteTask={(id) => {
                    void deleteTask(id);
                    if (selectedTaskId === id) setSelectedTaskId(null);
                  }}
                  onQuickAdd={async (status, t) => {
                    const id = await quickAddTask(status, t);
                    if (id) setSelectedTaskId(id);
                  }}
                />
              ) : sections.length === 0 ? (
                <EmptyState
                  icon={CheckSquare}
                  title="All clear"
                  message="No tasks in this list. Capture something or switch lists."
                  action={
                    <button
                      type="button"
                      className="pd-btn pd-btn--primary pd-btn--sm"
                      onClick={() => void createTask().then((id) => id && setSelectedTaskId(id))}
                    >
                      Add task
                    </button>
                  }
                />
              ) : (
                <div className="pd-task-list">
                  {sections.map((section) => (
                    <div key={section.id} className="pd-task-list__section">
                      <TaskSection
                        title={section.title}
                        count={section.tasks.length}
                        collapsed={collapsedSections[section.id]}
                        onToggleCollapse={() =>
                          setCollapsedSections((s) => ({
                            ...s,
                            [section.id]: !s[section.id],
                          }))
                        }
                      />
                      {!collapsedSections[section.id]
                        ? section.tasks.map((task) => (
                            <TaskRow
                              key={task.id}
                              task={task}
                              selected={selectedTaskId === task.id}
                              onSelect={() => setSelectedTaskId(task.id)}
                              onToggle={() => void toggleTask(task.id)}
                            />
                          ))
                        : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        }
        right={
          <EventInspectorPanel
            selectedEvent={null}
            selectedTask={selectedTask}
            onToggleTask={(id) => void toggleTask(id)}
            onDeleteTask={(id) => {
              void deleteTask(id);
              if (selectedTaskId === id) setSelectedTaskId(null);
            }}
          />
        }
      />
    </div>
  );
}
