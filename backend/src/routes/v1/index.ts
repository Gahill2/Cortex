import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { organizationsRouter } from "./organizations.routes.js";
import { projectsRouter } from "./projects.routes.js";
import { tasksRouter } from "./tasks.routes.js";
import { requireAuth } from "../../middleware/auth.js";
import { prisma } from "../../db/prisma.js";

export const v1Router = Router();

v1Router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "launchpad-api", version: "v1" });
});

v1Router.get("/dashboard", requireAuth, async (req, res) => {
  const [projectsCount, tasksCount, todoCount, inProgressCount, doneCount] = await Promise.all([
    prisma.project.count({ where: { organizationId: req.auth!.organizationId } }),
    prisma.task.count({ where: { organizationId: req.auth!.organizationId } }),
    prisma.task.count({ where: { organizationId: req.auth!.organizationId, status: "TODO" } }),
    prisma.task.count({ where: { organizationId: req.auth!.organizationId, status: "IN_PROGRESS" } }),
    prisma.task.count({ where: { organizationId: req.auth!.organizationId, status: "DONE" } })
  ]);

  res.json({
    projectsCount,
    tasksCount,
    taskStatus: { todoCount, inProgressCount, doneCount }
  });
});

v1Router.use("/auth", authRouter);
v1Router.use("/organizations", organizationsRouter);
v1Router.use("/projects", projectsRouter);
v1Router.use("/tasks", tasksRouter);
