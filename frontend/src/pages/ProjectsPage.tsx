import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Project } from "../types";

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
    <section>
      <h1>Projects</h1>
      <form className="inline-form" onSubmit={onSubmit}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" required />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
        <button type="submit">Add Project</button>
      </form>
      {loading ? (
        <p className="widget-empty">Loading projects…</p>
      ) : (
      <ul className="list">
        {projects.map((project) => (
          <li key={project.id}>
            <strong>{project.name}</strong>
            <span>{project.description}</span>
          </li>
        ))}
      </ul>
      )}
    </section>
  );
};
