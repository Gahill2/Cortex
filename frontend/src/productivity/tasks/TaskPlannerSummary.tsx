import { useMemo } from "react";
import { Calendar, CheckCircle2, CircleDashed, Loader2 } from "lucide-react";
import type { PlannerTask } from "../../components/tasks-calendar/types";

interface Props {
  tasks: PlannerTask[];
  listTitle: string;
}

export function TaskPlannerSummary({ tasks, listTitle }: Props) {
  const stats = useMemo(() => {
    const open = tasks.filter((t) => !t.completed);
    const done = tasks.filter((t) => t.completed);
    const inProgress = open.filter((t) => t.status === "IN_PROGRESS" || (t.progressPercent ?? 0) > 0);
    const scheduled = open.filter((t) => t.hasDueDate);
    const onCalendar = open.filter((t) => t.googleEventId);
    const avgProgress =
      open.length === 0
        ? 100
        : Math.round(open.reduce((s, t) => s + (t.progressPercent ?? 0), 0) / open.length);
    return { open: open.length, done: done.length, inProgress: inProgress.length, scheduled: scheduled.length, onCalendar: onCalendar.length, avgProgress };
  }, [tasks]);

  return (
    <section className="pd-planner-summary" aria-label="Planning overview">
      <div className="pd-planner-summary__head">
        <h2 className="pd-planner-summary__title">{listTitle}</h2>
        <p className="pd-planner-summary__subtitle">Plan · track · sync to Google Calendar</p>
      </div>
      <div className="pd-planner-summary__grid">
        <div className="pd-planner-summary__card">
          <CircleDashed size={16} aria-hidden />
          <span className="pd-planner-summary__value">{stats.open}</span>
          <span className="pd-planner-summary__label">Open</span>
        </div>
        <div className="pd-planner-summary__card">
          <Loader2 size={16} aria-hidden />
          <span className="pd-planner-summary__value">{stats.inProgress}</span>
          <span className="pd-planner-summary__label">In progress</span>
        </div>
        <div className="pd-planner-summary__card">
          <CheckCircle2 size={16} aria-hidden />
          <span className="pd-planner-summary__value">{stats.done}</span>
          <span className="pd-planner-summary__label">Done</span>
        </div>
        <div className="pd-planner-summary__card">
          <Calendar size={16} aria-hidden />
          <span className="pd-planner-summary__value">{stats.scheduled}</span>
          <span className="pd-planner-summary__label">Scheduled</span>
        </div>
      </div>
      <div className="pd-planner-summary__footer">
        <span>Avg. progress {stats.avgProgress}%</span>
        {stats.onCalendar > 0 ? (
          <span className="pd-planner-summary__sync">{stats.onCalendar} on Google Calendar</span>
        ) : null}
      </div>
    </section>
  );
}
