import type { ReactNode } from "react";
import type { Tab } from "../../App";
import type { HomeBoardTask } from "./HomeDashboardTop";
import { HomeNotionHero } from "./HomeNotionHero";

type Props = {
  onNavigate: (t: Tab) => void;
  isNarrow: boolean;
  greeting: string;
  themeName?: string;
  tasks: HomeBoardTask[];
  projectsCount: number;
  loading: boolean;
  widgets: {
    weather: ReactNode;
    tasks: ReactNode;
    mail: ReactNode;
    spotify: ReactNode;
    ai: ReactNode;
  };
};

function openTaskCount(tasks: HomeBoardTask[]) {
  return tasks.filter((t) => t.status === "TODO" || t.status === "IN_PROGRESS").length;
}

/** Notion-style personal home + live service widgets (Gmail, Spotify, …). */
export function HomeProduction({
  onNavigate,
  isNarrow,
  greeting,
  themeName,
  tasks,
  projectsCount,
  loading,
  widgets,
}: Props) {
  const openTasks = openTaskCount(tasks);

  return (
    <div className={`page home-prod home-prod--notion${isNarrow ? " home-prod--mobile" : ""}`}>
      <HomeNotionHero onNavigate={onNavigate} />

      <section className="home-prod-live" aria-labelledby="home-prod-live-title">
        <div className="home-prod-live-head">
          <div>
            <p className="home-prod-greeting">{greeting}</p>
            <h2 id="home-prod-live-title" className="home-prod-section__title">
              Live glance
            </h2>
            {themeName ? <p className="home-prod-theme">Theme · {themeName}</p> : null}
          </div>
          <div className="home-prod-kpis home-prod-kpis--inline" aria-label="Overview">
            <button type="button" className="home-prod-kpi" onClick={() => onNavigate("tasks")}>
              <span className="home-prod-kpi__value">{loading ? "—" : openTasks}</span>
              <span className="home-prod-kpi__label">Open tasks</span>
            </button>
            <button type="button" className="home-prod-kpi" onClick={() => onNavigate("mail")}>
              <span className="home-prod-kpi__value">Mail</span>
              <span className="home-prod-kpi__label">Inbox</span>
            </button>
            <button type="button" className="home-prod-kpi" onClick={() => onNavigate("tasks")}>
              <span className="home-prod-kpi__value">{loading ? "—" : projectsCount}</span>
              <span className="home-prod-kpi__label">Projects</span>
            </button>
          </div>
        </div>

        <div className="home-prod-glance-row home-prod-glance-row--compact" aria-label="Weather">
          <div className="home-prod-card home-prod-card--weather">{widgets.weather}</div>
        </div>

        <div className="home-prod-bento">
          <div className="home-prod-card home-prod-card--tasks">{widgets.tasks}</div>
          <div className="home-prod-card home-prod-card--mail">{widgets.mail}</div>
          <div className="home-prod-card home-prod-card--spotify">{widgets.spotify}</div>
          <div className="home-prod-card home-prod-card--ai">{widgets.ai}</div>
        </div>
      </section>
    </div>
  );
}
