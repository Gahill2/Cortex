import { useEffect, useState } from "react";
import { api } from "../api/client";

type DashboardStats = {
  projectsCount: number;
  tasksCount: number;
  taskStatus: {
    todoCount: number;
    inProgressCount: number;
    doneCount: number;
  };
};

export const DashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.get("/dashboard").then((response) => setStats(response.data));
  }, []);

  return (
    <div className="page dashboard-page">
      <div className="page-titlebar">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            At-a-glance overview of your projects, tasks, and progress.
          </p>
        </div>
      </div>

      <div className="page-workbench">
        {!stats ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-4)",
              color: "var(--text-3)",
            }}
          >
            <div className="page-loading-spinner" aria-hidden="true" />
            <p>Loading dashboard…</p>
          </div>
        ) : (
          <div style={{ padding: "var(--space-5)" }}>
            <div className="stats-row">
              <article className="stat-card">
                <p className="stat-value">{stats.projectsCount}</p>
                <p className="stat-label">Projects</p>
              </article>
              <article className="stat-card">
                <p className="stat-value">{stats.tasksCount}</p>
                <p className="stat-label">Tasks</p>
              </article>
              <article className="stat-card">
                <p className="stat-value">{stats.taskStatus.todoCount}</p>
                <p className="stat-label">Todo</p>
              </article>
              <article className="stat-card">
                <p className="stat-value">{stats.taskStatus.inProgressCount}</p>
                <p className="stat-label">In Progress</p>
              </article>
              <article className="stat-card">
                <p className="stat-value">{stats.taskStatus.doneCount}</p>
                <p className="stat-label">Done</p>
              </article>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
