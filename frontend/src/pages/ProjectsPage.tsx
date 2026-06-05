import { FormEvent, useRef, useEffect, useState } from "react";
import { Folder, Plus } from "lucide-react";
import { api } from "../api/client";
import type { Project } from "../types";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { useToastStore } from "../stores/toastStore";
import { FormField } from "../components/ui/FormField";

export const ProjectsPage = () => {
  const pushToast = useToastStore((s) => s.push);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();

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

  const validate = (): boolean => {
    if (!name.trim()) {
      setNameError("Project name is required.");
      return false;
    }
    setNameError(undefined);
    return true;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await api.post("/projects", { name: name.trim(), description: description.trim() });
      pushToast({ title: "Project created", message: name.trim(), tone: "success" });
      setName("");
      setDescription("");
      setNameError(undefined);
      await load();
    } catch {
      pushToast({ title: "Failed to create project", tone: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page projects-page">
      <PageHeader
        title="Projects"
        subtitle="Manage your projects and track progress across teams."
        actions={
          <form
            className="page-actions"
            onSubmit={(e) => void onSubmit(e)}
            style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-start", flexWrap: "wrap" }}
          >
            <FormField label="Project name" required error={nameError}>
              <input
                ref={nameInputRef}
                className="form-input"
                value={name}
                onChange={(e) => { setName(e.target.value); if (nameError) setNameError(undefined); }}
                placeholder="Project name"
                style={{ minWidth: 160 }}
              />
            </FormField>
            <FormField label="Description">
              <input
                className="form-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                style={{ minWidth: 200 }}
              />
            </FormField>
            <button
              type="submit"
              className="btn-primary btn-sm"
              disabled={isSubmitting}
              style={{ marginTop: 22 }}
            >
              {isSubmitting ? (
                <><span className="btn-spinner" aria-hidden="true" />Adding…</>
              ) : (
                <><Plus size={14} aria-hidden />Add Project</>
              )}
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
          <EmptyState
            icon={Folder}
            title="No projects yet"
            message="Organize your work into projects to track progress and collaborate."
            action={{
              label: "Create your first project",
              onClick: () => nameInputRef.current?.focus(),
            }}
          />
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
