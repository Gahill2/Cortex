import { FormEvent, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../api/client";
import type { Project } from "../types";
import { PageHeader } from "../components/ui/PageHeader";

export const ProjectsPage = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/projects");
      setProjects(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await api.post("/projects", { name, description });
    setName("");
    setDescription("");
    await load();
  };

  return (
    <div className="page projects-page">
      <PageHeader
        title="Projects"
        subtitle="Manage your projects and track progress across teams."
        actions={
          <form
            className="page-actions"
            onSubmit={onSubmit}
            style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}
          >
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              required
              style={{ minWidth: 160 }}
            />
            <input
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              style={{ minWidth: 200 }}
            />
            <button type="submit" className="btn-primary btn-sm">
              <Plus size={14} aria-hidden />
              Add Project
            </button>
          </form>
        }
      />

      <div className="page-workbench">
        {loading ? (
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
            <p>Loading projects…</p>
          </div>
        ) : projects.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-2)",
              color: "var(--text-3)",
            }}
          >
            <p style={{ color: "var(--text-2)", fontWeight: 500 }}>No projects yet</p>
            <p>Create your first project using the form above.</p>
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: "var(--space-2)" }}>
            {projects.map((project) => (
              <li
                key={project.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "var(--space-3) var(--space-4)",
                  borderRadius: "var(--radius-sm)",
                  transition: "background 120ms",
                  cursor: "default",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <strong
                  style={{
                    fontWeight: 600,
                    color: "var(--text)",
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {project.name}
                </strong>
                <span
                  style={{
                    color: "var(--text-2)",
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {project.description}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
