import { useMemo, useState } from "react";
import { CalendarX } from "lucide-react";
import type { Tab } from "../tab";
import { useToastStore } from "../stores/toastStore";
import { TasksCalendarCommandBar } from "../components/tasks-calendar/TasksCalendarCommandBar";
import { TasksCalendarFocusPanel } from "../components/tasks-calendar/TasksCalendarFocusPanel";
import { TasksCalendarHeader } from "../components/tasks-calendar/TasksCalendarHeader";
import { TasksCalendarSchedule } from "../components/tasks-calendar/TasksCalendarSchedule";
import { TasksCalendarKanban } from "../components/tasks-calendar/TasksCalendarKanban";
import { TasksCalendarQuickAdd } from "../components/tasks-calendar/TasksCalendarQuickAdd";
import { TasksCalendarTaskList } from "../components/tasks-calendar/TasksCalendarTaskList";
import { useTasksCalendarData } from "../components/tasks-calendar/useTasksCalendarData";
import type { CalendarRangeView, CategoryFilter, PlannerTask } from "../components/tasks-calendar/types";

type TaskViewMode = "list" | "board";

const CATEGORY_FILTERS: CategoryFilter[] = ["All", "Work", "Personal", "School", "Fitness"];

interface Props {
  activeTab: Tab;
  onNavigate: (tab: Tab) => void;
}

export function TasksCalendarPage({ activeTab: _activeTab, onNavigate }: Props) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("All");
  const [calView, setCalView] = useState<CalendarRangeView>("workweek");
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [taskView, setTaskView] = useState<TaskViewMode>("list");

  const {
    tasks,
    events,
    loading,
    busy,
    calendarSaving,
    tasksError,
    eventsError,
    calendarWarnings,
    hasCalendarAccount,
    refresh,
    toggleTask,
    createTask,
    createTaskFromNl,
    quickAddTask,
    updateTaskStatus,
    deleteTask,
    rescheduleEvent,
  } = useTasksCalendarData(viewDate, calView);

  const needle = search.trim().toLowerCase();

  const filteredTasks = useMemo(() => {
    let list =
      categoryFilter === "All" ? tasks : tasks.filter((t) => t.category === categoryFilter);
    if (!needle) return list;
    return list.filter(
      (t) =>
        t.title.toLowerCase().includes(needle) ||
        t.category.toLowerCase().includes(needle) ||
        (t.projectName?.toLowerCase().includes(needle) ?? false),
    );
  }, [tasks, needle, categoryFilter]);

  const filteredEvents = useMemo(() => {
    if (!needle) return events;
    return events.filter((e) => e.title.toLowerCase().includes(needle));
  }, [events, needle]);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;

  const selectTask = (task: PlannerTask) => {
    setSelectedTaskId(task.id);
    setSelectedEventId(null);
  };

  const onNewTask = async () => {
    const id = await createTask();
    if (id) setSelectedTaskId(id);
  };

  const onQuickAddNl = async (text: string) => {
    const id = await createTaskFromNl(text);
    if (id) {
      setSelectedTaskId(id);
      setTaskView("list");
    }
    return id;
  };

  const pushToast = useToastStore((s) => s.push);

  const onNewEvent = () => {
    onNavigate("settings");
    pushToast({
      title: "Calendar connection required",
      message:
        "Google Calendar uses the same sign-in as Gmail. Open Mail → Connect Gmail (or reconnect to grant calendar access), then refresh Tasks & Calendar.",
      tone: "neutral",
      dismissMs: 6000,
    });
  };

  const statusMessage =
    tasksError ??
    eventsError ??
    (hasCalendarAccount === false
      ? "Connect Gmail or Microsoft in Mail to see your calendar (Gmail includes Google Calendar)."
      : null);

  const showSchedule = calView !== "agenda" || filteredEvents.length > 0 || loading;

  return (
    <div className="page tcc-page teams-surface">
      <TasksCalendarHeader
        search={search}
        onSearchChange={setSearch}
        onNewTask={() => void onNewTask()}
        onNewEvent={onNewEvent}
        loading={loading}
        busy={busy}
        onRefresh={() => void refresh()}
      />
      <div className="tcc-shell tcc-shell--no-rail page-workbench">
        <div className="tcc-workspace">
          <TasksCalendarCommandBar
            viewDate={viewDate}
            calView={calView}
            onViewDateChange={setViewDate}
            onCalViewChange={setCalView}
          />
          {statusMessage ? (
            <p className="page-error tcc-status-banner" role="alert">
              {statusMessage}
            </p>
          ) : null}
          {calendarWarnings.length > 0 ? (
            <div className="tcc-warnings" role="status">
              {calendarWarnings.map((w) => (
                <p key={w} className="tcc-warning-line">
                  {w}
                </p>
              ))}
            </div>
          ) : null}
          {loading && !calendarSaving ? (
            <div className="tcc-loading-hint">
              <span className="tcc-spinner" aria-hidden="true" />
              <span>Loading calendar and tasks…</span>
            </div>
          ) : null}
          <div className="tcc-body tcc-body--teams">
            <div className="tcc-cal-main">
              {showSchedule ? (
                <TasksCalendarSchedule
                  calView={calView}
                  viewDate={viewDate}
                  events={filteredEvents}
                  selectedEventId={selectedEventId}
                  saving={calendarSaving}
                  onSelectEvent={(ev) => {
                    setSelectedEventId(ev.id);
                    setSelectedTaskId(null);
                  }}
                  onReschedule={(ev, start, end) => void rescheduleEvent(ev, start, end)}
                />
              ) : (
                <div className="empty-state">
                  <CalendarX size={32} strokeWidth={1.5} className="empty-state-icon" aria-hidden />
                  <p className="empty-state-title">No events</p>
                  <p className="empty-state-message">Nothing scheduled in this range.</p>
                </div>
              )}
            </div>
            <aside className="tcc-sidebar">
              <div className="tcc-sidebar-toolbar">
                <div className="tcc-task-panel-head">
                  <span className="tcc-sidebar-label">Tasks</span>
                  <div className="teams-segmented tcc-task-view-toggle" role="group" aria-label="Task view">
                    <button
                      type="button"
                      className={taskView === "list" ? "active" : ""}
                      onClick={() => setTaskView("list")}
                    >
                      List
                    </button>
                    <button
                      type="button"
                      className={taskView === "board" ? "active" : ""}
                      onClick={() => setTaskView("board")}
                    >
                      Board
                    </button>
                  </div>
                </div>
                <TasksCalendarQuickAdd busy={busy} onAdd={onQuickAddNl} />
                <div className="tcc-sidebar-filters" role="group" aria-label="Task category filters">
                  {CATEGORY_FILTERS.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`tcc-chip${categoryFilter === cat ? " tcc-chip--active" : ""}`}
                      onClick={() => setCategoryFilter(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              {taskView === "list" ? (
                <TasksCalendarTaskList
                  tasks={filteredTasks}
                  selectedTaskId={selectedTaskId}
                  onSelectTask={selectTask}
                  onToggleTask={(id) => void toggleTask(id)}
                  onUpdateStatus={(id, status) => void updateTaskStatus(id, status)}
                  onDeleteTask={(id) => {
                    void deleteTask(id);
                    if (selectedTaskId === id) setSelectedTaskId(null);
                  }}
                />
              ) : (
                <TasksCalendarKanban
                  tasks={filteredTasks}
                  selectedTaskId={selectedTaskId}
                  onSelectTask={selectTask}
                  onUpdateStatus={(id, status) => void updateTaskStatus(id, status)}
                  onDeleteTask={(id) => {
                    void deleteTask(id);
                    if (selectedTaskId === id) setSelectedTaskId(null);
                  }}
                  onQuickAdd={async (status, title) => {
                    const id = await quickAddTask(status, title);
                    if (id) setSelectedTaskId(id);
                  }}
                />
              )}
              <TasksCalendarFocusPanel
                selectedTask={selectedTask}
                selectedEvent={selectedEvent}
                tasks={tasks}
                events={events}
              />
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
