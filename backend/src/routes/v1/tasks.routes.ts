import { Router } from "express";
import { TaskStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { HttpError } from "../../utils/http-error.js";

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  projectId: z.string().cuid(),
  assigneeId: z.string().cuid().optional()
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(TaskStatus),
  assigneeId: z.string().cuid().nullable().optional()
}).partial();

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

tasksRouter.get("/", async (req, res) => {
  const projectId = req.query.projectId?.toString();
  const tasks = await prisma.task.findMany({
    where: {
      organizationId: req.auth!.organizationId,
      ...(projectId ? { projectId } : {})
    },
    include: {
      assignee: { select: { id: true, fullName: true, email: true } },
      project: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json(tasks);
});

tasksRouter.post("/", async (req, res) => {
  const input = createTaskSchema.parse(req.body);

  const project = await prisma.project.findUnique({ where: { id: input.projectId } });
  if (!project || project.organizationId !== req.auth!.organizationId) {
    throw new HttpError(400, "Project does not belong to your organization");
  }

  const task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description,
      projectId: input.projectId,
      assigneeId: input.assigneeId,
      organizationId: req.auth!.organizationId,
      createdById: req.auth!.userId
    }
  });
  res.status(201).json(task);
});

tasksRouter.patch("/:taskId", async (req, res) => {
  const input = updateTaskSchema.parse(req.body);
  const existing = await prisma.task.findUnique({ where: { id: req.params.taskId } });
  if (!existing || existing.organizationId !== req.auth!.organizationId) {
    throw new HttpError(404, "Task not found");
  }

  const updated = await prisma.task.update({
    where: { id: req.params.taskId },
    data: input
  });
  res.json(updated);
});

tasksRouter.delete("/:taskId", async (req, res) => {
  const existing = await prisma.task.findUnique({ where: { id: req.params.taskId } });
  if (!existing || existing.organizationId !== req.auth!.organizationId) {
    throw new HttpError(404, "Task not found");
  }

  await prisma.task.delete({ where: { id: req.params.taskId } });
  res.status(204).send();
});
