import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api } from "../api/client";
export const ProjectsPage = () => {
    const [projects, setProjects] = useState([]);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const load = () => api.get("/projects").then((r) => setProjects(r.data));
    useEffect(() => {
        void load();
    }, []);
    const onSubmit = async (event) => {
        event.preventDefault();
        await api.post("/projects", { name, description });
        setName("");
        setDescription("");
        await load();
    };
    return (_jsxs("section", { children: [_jsx("h1", { children: "Projects" }), _jsxs("form", { className: "inline-form", onSubmit: onSubmit, children: [_jsx("input", { value: name, onChange: (e) => setName(e.target.value), placeholder: "Project name", required: true }), _jsx("input", { value: description, onChange: (e) => setDescription(e.target.value), placeholder: "Description" }), _jsx("button", { type: "submit", children: "Add Project" })] }), _jsx("ul", { className: "list", children: projects.map((project) => (_jsxs("li", { children: [_jsx("strong", { children: project.name }), _jsx("span", { children: project.description })] }, project.id))) })] }));
};
