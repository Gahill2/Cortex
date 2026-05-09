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

  if (!stats) return <p>Loading dashboard...</p>;

  return (
    <section>
      <h1>Dashboard</h1>
      <div className="stats-grid">
        <article><h3>Projects</h3><p>{stats.projectsCount}</p></article>
        <article><h3>Tasks</h3><p>{stats.tasksCount}</p></article>
        <article><h3>Todo</h3><p>{stats.taskStatus.todoCount}</p></article>
        <article><h3>In Progress</h3><p>{stats.taskStatus.inProgressCount}</p></article>
        <article><h3>Done</h3><p>{stats.taskStatus.doneCount}</p></article>
      </div>
    </section>
  );
};
