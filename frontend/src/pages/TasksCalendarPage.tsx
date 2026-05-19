import { useMemo, useState } from "react";
import type { Tab } from "../tab";
import { TasksCalendarFocusPanel } from "../components/tasks-calendar/TasksCalendarFocusPanel";
import { TasksCalendarHeader } from "../components/tasks-calendar/TasksCalendarHeader";
import { createMockEvents, createMockTasks } from "../components/tasks-calendar/mockData";
import { TasksCalendarTaskList } from "../components/tasks-calendar/TasksCalendarTaskList";
import { TasksCalendarWeekView } from "../components/tasks-calendar/TasksCalendarWeekView";
import type {
  CalendarRangeView,
  CategoryFilter,
  PlannerEvent,
  PlannerTask,
} from "../components/tasks-calendar/types";

const CATEGORY_FILTERS: CategoryFilter[] = ["All", "Work", "Personal", "School", "Fitness"];
const CAL_VIEWS: { id: CalendarRangeView; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

interface Props {
  activeTab: Tab;
  onNavigate: (tab: Tab) => void;
}

export function TasksCalendarPage(_props: Props) {
  const [tasks, setTasks] = useState<PlannerTask[]>(() => createMockTasks());
  const [events] = useState<PlannerEvent[]>(() => createMockEvents());
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("All");
  const [calView, setCalView] = useState<CalendarRangeView>("week");
  const [viewDate] = useState(() => new Date());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const needle = search.trim().toLowerCase();

  const filteredTasks = useMemo(() => {
    if (!needle) return tasks;
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(needle) ||
        t.category.toLowerCase().includes(needle),
    );
  }, [tasks, needle]);

  const filteredEvents = useMemo(() => {
    if (!needle) return events;
    return events.filter((e) => e.title.toLowerCase().includes(needle));
  }, [events, needle]);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const completed = !t.completed;
        return {
          ...t,
          completed,
          group: completed ? "completed" : t.group === "completed" ? "today" : t.group,
        };
      }),
    );
  };

  const onNewTask = () => {
    const id = `t-${Date.now()}`;
    setTasks((prev) => [
      {
        id,
        title: "New task",
        dueAt: new Date().toISOString(),
        priority: "MEDIUM",
        category: "Personal",
        group: "today",
        completed: false,
      },
      ...prev,
    ]);
    setSelectedTaskId(id);
  };

  const onNewEvent = () => {
    window.alert("New event — connect calendar API when ready.");
  };

  return (
    <div className="page tcc-page teams-surface">
      <div className="tcc-shell tcc-shell--no-rail">
        <div className="tcc-workspace">
          <TasksCalendarHeader
            search={search}
            onSearchChange={setSearch}
            onNewTask={onNewTask}
            onNewEvent={onNewEvent}
          />
          <div className="tcc-toolbar">
            <div className="tcc-filters" role="group" aria-label="Category filters">
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
            <div className="teams-segmented" role="group" aria-label="Calendar view">
              {CAL_VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={calView === v.id ? "active" : ""}
                  onClick={() => setCalView(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div className="tcc-body">
            <div className="tcc-main">
              <TasksCalendarWeekView
                view={calView}
                viewDate={viewDate}
                events={filteredEvents}
                selectedEventId={selectedEventId}
                onSelectEvent={(ev) => {
                  setSelectedEventId(ev.id);
                  setSelectedTaskId(null);
                }}
              />
              <TasksCalendarTaskList
                tasks={filteredTasks}
                selectedTaskId={selectedTaskId}
                categoryFilter={categoryFilter}
                onSelectTask={(task) => {
                  setSelectedTaskId(task.id);
                  setSelectedEventId(null);
                }}
                onToggleTask={toggleTask}
              />
            </div>
            <TasksCalendarFocusPanel
              selectedTask={selectedTask}
              selectedEvent={selectedEvent}
              tasks={tasks}
              events={events}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
