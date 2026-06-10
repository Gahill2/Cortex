import { useMemo, useState } from "react";
import { CalendarX } from "lucide-react";
import type { Tab } from "../tab";
import { useToastStore } from "../stores/toastStore";
import { useTasksCalendarData } from "../components/tasks-calendar/useTasksCalendarData";
import { usePlannerBackendStatus } from "../components/tasks-calendar/usePlannerBackendStatus";
import type { CategoryFilter, PlannerEvent } from "../components/tasks-calendar/types";
import { ProductivityShell } from "../productivity/ProductivityShell";
import { CalendarTopBar } from "../productivity/calendar/CalendarTopBar";
import { CalendarGrid } from "../productivity/calendar/CalendarGrid";
import { CalendarLeftRail } from "../productivity/calendar/CalendarLeftRail";
import { EventInspectorPanel } from "../productivity/calendar/EventInspectorPanel";
import { EmptyState } from "../productivity/shared/EmptyState";
import { CalendarConnectBanner } from "../components/calendar/CalendarConnectBanner";
import type { CalendarViewMode } from "../productivity/types";
import { toPlannerCalView } from "../productivity/tasks/taskListUtils";

interface Props {
  onNavigate: (tab: Tab) => void;
}

export function CalendarPage({ onNavigate }: Props) {
  const [view, setView] = useState<CalendarViewMode>("week");
  const [viewDate, setViewDate] = useState(() => new Date());
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("All");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  const calView = useMemo(() => toPlannerCalView(view), [view]);
  const { databaseOk, databaseMessage } = usePlannerBackendStatus();
  const {
    tasks,
    events,
    loading,
    calendarSaving,
    eventsError,
    calendarWarnings,
    hasCalendarAccount,
    calendarStatus,
    createTask,
    rescheduleEvent,
  } = useTasksCalendarData(viewDate, calView);

  const filteredEvents = useMemo(() => {
    let list = events;
    if (categoryFilter !== "All") {
      list = list.filter((e) => e.category === categoryFilter);
    }
    return list;
  }, [events, categoryFilter]);

  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  const pushToast = useToastStore((s) => s.push);

  const onSelectEvent = (ev: PlannerEvent) => {
    setSelectedEventId(ev.id);
    setSelectedTaskId(null);
    setMobileInspectorOpen(true);
  };

  const statusMessage =
    eventsError ??
    (hasCalendarAccount === false
      ? "Connect Gmail or Microsoft in Mail to sync your calendar."
      : null);

  const showGrid = view !== "agenda" || filteredEvents.length > 0 || loading;

  return (
    <div className="pd-route pd-route--calendar">
      <ProductivityShell
        mobileSidebarOpen={mobileSidebarOpen}
        onMobileSidebarOpenChange={setMobileSidebarOpen}
        mobileInspectorOpen={mobileInspectorOpen}
        onMobileInspectorOpenChange={setMobileInspectorOpen}
        left={
          <CalendarLeftRail
            viewDate={viewDate}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            onViewDateChange={setViewDate}
            onGoTasks={() => {
              onNavigate("tasks");
              setMobileSidebarOpen(false);
            }}
          />
        }
        main={
          <div className="pd-route__stack">
            <CalendarTopBar
              viewDate={viewDate}
              view={view}
              onViewChange={setView}
              onViewDateChange={setViewDate}
              onToday={() => setViewDate(new Date())}
              onQuickAdd={() => void createTask().then((id) => id && onNavigate("tasks"))}
              onOpenSidebar={() => setMobileSidebarOpen(true)}
              onOpenInspector={() => setMobileInspectorOpen(true)}
              showInspectorButton={Boolean(selectedEvent || selectedTask)}
            />
            {databaseOk === false && databaseMessage ? (
              <p className="pd-route__banner pd-route__banner--error" role="alert">
                {databaseMessage}
              </p>
            ) : null}
            {statusMessage ? (
              <p className="pd-route__banner pd-route__banner--error" role="alert">
                {statusMessage}
              </p>
            ) : null}
            <CalendarConnectBanner
              status={calendarStatus}
              warnings={calendarWarnings}
              onNavigateMail={() => onNavigate("mail")}
            />
            {loading && !calendarSaving ? (
              <p className="pd-route__loading" aria-busy="true">
                Loading calendar…
              </p>
            ) : null}
            <div className="pd-route__body">
              {showGrid ? (
                <CalendarGrid
                  view={view}
                  viewDate={viewDate}
                  events={filteredEvents}
                  selectedEventId={selectedEventId}
                  saving={calendarSaving}
                  onSelectEvent={onSelectEvent}
                  onReschedule={(ev, start, end) => void rescheduleEvent(ev, start, end)}
                />
              ) : (
                <EmptyState
                  icon={CalendarX}
                  title="No events"
                  message="Nothing scheduled in this range."
                  action={
                    <button
                      type="button"
                      className="pd-btn pd-btn--ghost pd-btn--sm"
                      onClick={() => {
                        onNavigate("settings");
                        pushToast({
                          title: "Connect calendar",
                          message: "Link Gmail or Microsoft in Settings → Integrations.",
                          tone: "neutral",
                        });
                      }}
                    >
                      Connect account
                    </button>
                  }
                />
              )}
            </div>
          </div>
        }
        right={
          <EventInspectorPanel
            selectedEvent={selectedEvent}
            selectedTask={selectedTask}
          />
        }
      />
    </div>
  );
}
