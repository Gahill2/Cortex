import { Calendar, CheckSquare, LayoutDashboard, Server } from "lucide-react";
import type { Tab } from "../../../tab";
import type { HomeBoardTask } from "../../home/types";
import type { WidgetRenderStyle } from "../widgetRenderStyle";
import { useDashboardDataContextOptional } from "../../../productivity-dashboard/hooks/useDashboardDataContext";
import { useHomelabQuickStatus } from "../../../hooks/useHomelabQuickStatus";

function greetingForHour(h: number): string {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function healthDot(health: string) {
  if (health === "ok") return "at-glance__dot--ok";
  if (health === "warn") return "at-glance__dot--warn";
  if (health === "down") return "at-glance__dot--down";
  return "at-glance__dot--unknown";
}

const MEDIA_PREVIEW_IDS = ["jellyfin", "qbittorrent", "radarr"] as const;

export function AtAGlanceWidget({
  style,
  onNavigate,
  boardTasks,
  boardTasksLoading,
}: {
  style: WidgetRenderStyle;
  onNavigate: (t: Tab) => void;
  boardTasks?: HomeBoardTask[];
  boardTasksLoading?: boolean;
}) {
  const now = new Date();
  const compact = style.layout === "compact";
  const dash = useDashboardDataContextOptional();
  const { status: homelab, loading: homelabLoading } = useHomelabQuickStatus();
  const tasks = boardTasks ?? [];

  const openTasks = tasks.filter((t) => t?.status !== "DONE");
  const previewTasks = [...openTasks.filter((t) => t.status === "IN_PROGRESS"), ...openTasks.filter((t) => t.status === "TODO")].slice(
    0,
    compact ? 2 : 3,
  );

  const events = dash?.todayEvents ?? [];
  const eventsLoading = dash?.eventsLoading ?? false;
  const eventLimit = compact ? 2 : 3;

  const mediaPreview = MEDIA_PREVIEW_IDS.map((id) =>
    homelab?.mediaServices?.find((s) => s.id === id),
  ).filter((s): s is NonNullable<typeof s> => Boolean(s));

  const dateStr = now.toLocaleDateString(undefined, {
    weekday: compact ? "short" : "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="widget widget--at-a-glance">
      <header className="at-glance__header">
        <div>
          <p className="at-glance__eyebrow">{dateStr}</p>
          <h2 className="at-glance__title">{greetingForHour(now.getHours())}</h2>
        </div>
        <div className="at-glance__stats" aria-label="Day summary">
          <span>
            <strong>{openTasks.length}</strong> tasks
          </span>
          <span>
            <strong>{events.length}</strong> events
          </span>
          {homelab && !homelabLoading ? (
            <span>
              <strong>
                {homelab.mediaOk ?? 0}/{homelab.mediaTotal ?? 0}
              </strong>{" "}
              media
            </span>
          ) : null}
        </div>
      </header>

      <section className="at-glance__section" aria-labelledby="at-glance-tasks">
        <div className="at-glance__section-head" id="at-glance-tasks">
          <CheckSquare size={14} aria-hidden />
          <span>Tasks</span>
          <button type="button" className="at-glance__link" onClick={() => onNavigate("tasks")}>
            Open
          </button>
        </div>
        {boardTasksLoading ? (
          <p className="at-glance__muted">Loading tasks…</p>
        ) : previewTasks.length === 0 ? (
          <p className="at-glance__muted">Nothing open — add a task in Tasks.</p>
        ) : (
          <ul className="at-glance__list">
            {previewTasks.map((t, idx) => {
              if (!t) return null;
              return (
                <li key={t.id ?? `task-${idx}`} className="at-glance__row">
                  <span className={`at-glance__dot ${t.status === "IN_PROGRESS" ? "at-glance__dot--warn" : "at-glance__dot--unknown"}`} />
                  <span className="at-glance__row-title">{t.title ?? "Untitled task"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {!compact && (
        <section className="at-glance__section" aria-labelledby="at-glance-calendar">
          <div className="at-glance__section-head" id="at-glance-calendar">
            <Calendar size={14} aria-hidden />
            <span>Today</span>
            <button type="button" className="at-glance__link" onClick={() => onNavigate("calendar")}>
              Open
            </button>
          </div>
          {eventsLoading ? (
            <p className="at-glance__muted">Loading calendar…</p>
          ) : events.length === 0 ? (
            <p className="at-glance__muted">No events today.</p>
          ) : (
            <ul className="at-glance__list">
              {events.slice(0, eventLimit).map((ev, idx) => {
                if (!ev?.start) return null;
                const start = new Date(ev.start);
                if (Number.isNaN(start.getTime())) return null;
                const time = ev.allDay
                  ? "All day"
                  : start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                return (
                  <li key={ev.id ?? `ev-${idx}`} className="at-glance__row at-glance__row--calendar">
                    <span className="at-glance__time">{time}</span>
                    <span className="at-glance__row-title">{ev.title ?? "Event"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section className="at-glance__section" aria-labelledby="at-glance-homelab">
        <div className="at-glance__section-head" id="at-glance-homelab">
          <Server size={14} aria-hidden />
          <span>Homelab</span>
          <button type="button" className="at-glance__link" onClick={() => onNavigate("homelab")}>
            Open
          </button>
        </div>
        {homelabLoading ? (
          <p className="at-glance__muted">Checking services…</p>
        ) : homelab ? (
          <>
            <div className="at-glance__media-pills">
              {mediaPreview.map((s) =>
                s ? (
                  <span key={s.id} className="at-glance__pill" title={s.name}>
                    <span className={`at-glance__dot ${healthDot(s.health)}`} aria-hidden />
                    {s.name}
                  </span>
                ) : null,
              )}
            </div>
            <p className="at-glance__foot">
              {homelab.servicesOk ?? 0}/{homelab.servicesTotal ?? 0} services up
              {homelab.downloadHeadroomHuman ? ` · ${homelab.downloadHeadroomHuman} free` : ""}
            </p>
          </>
        ) : (
          <p className="at-glance__muted">Homelab status unavailable.</p>
        )}
      </section>

      <footer className="at-glance__chips">
        <button type="button" className="at-glance__chip" onClick={() => onNavigate("tasks")}>
          <CheckSquare size={12} aria-hidden />
          Tasks
        </button>
        <button type="button" className="at-glance__chip" onClick={() => onNavigate("calendar")}>
          <Calendar size={12} aria-hidden />
          Calendar
        </button>
        <button type="button" className="at-glance__chip" onClick={() => onNavigate("homelab")}>
          <LayoutDashboard size={12} aria-hidden />
          Homelab
        </button>
      </footer>
    </div>
  );
}
