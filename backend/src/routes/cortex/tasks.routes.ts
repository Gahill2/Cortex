import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HttpError } from "../../utils/http-error.js";
import { getOrCreateCortexUser } from "../../features/auth/cortex-db-user.js";
type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  projectId: z.string().min(1),
  assigneeId: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional().default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().default("MEDIUM"),
  dueDate: z.string().optional().nullable(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  dueDate: z.string().optional().nullable(),
  assigneeId: z.string().nullable().optional(),
});

export const cortexTasksRouter = Router();
cortexTasksRouter.use(requireAuth);

// GET /api/tasks
cortexTasksRouter.get("/", routeRateLimit(60, 60_000), async (req, res) => {
  const { userId, email } = req.auth!;
  const { org } = await getOrCreateCortexUser(userId, email);
  const status = req.query["status"] as TaskStatus | undefined;

  const tasks = await prisma.task.findMany({
    where: {
      organizationId: org.id,
      ...(status ? { status } : {})
    },
    include: {
      project: { select: { id: true, name: true } },
      assignee: { select: { id: true, email: true, fullName: true } },
      createdBy: { select: { id: true, email: true, fullName: true } }
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { createdAt: "desc" }]
  });

  sendSuccess(res, tasks);
});

// POST /api/tasks
cortexTasksRouter.post("/", routeRateLimit(30, 60_000), async (req, res) => {
  const { userId, email } = req.auth!;
  const { org, user } = await getOrCreateCortexUser(userId, email);
  const input = createTaskSchema.parse(req.body);

  // Verify project belongs to org
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, organizationId: org.id }
  });
  if (!project) throw new HttpError(404, "Project not found");

  const task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      organizationId: org.id,
      projectId: project.id,
      createdById: user.id,
      assigneeId: input.assigneeId ?? user.id
    },
    include: {
      project: { select: { id: true, name: true } },
      assignee: { select: { id: true, email: true, fullName: true } }
    }
  });

  res.status(201);
  sendSuccess(res, task);
});

// PATCH /api/tasks/:id
cortexTasksRouter.patch("/:id", routeRateLimit(60, 60_000), async (req, res) => {
  const { userId, email } = req.auth!;
  const { org } = await getOrCreateCortexUser(userId, email);
  const input = updateTaskSchema.parse(req.body);

  const task = await prisma.task.findFirst({
    where: { id: String(req.params["id"]), organizationId: org.id }
  });
  if (!task) throw new HttpError(404, "Task not found");

  const updated = await prisma.task.update({
    where: { id: task.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? new Date(input.dueDate) : null } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {})
    },
    include: {
      project: { select: { id: true, name: true } }
    }
  });

  sendSuccess(res, updated);
});

// DELETE /api/tasks/:id
cortexTasksRouter.delete("/:id", routeRateLimit(30, 60_000), async (req, res) => {
  const { userId, email } = req.auth!;
  const { org } = await getOrCreateCortexUser(userId, email);

  const task = await prisma.task.findFirst({
    where: { id: String(req.params["id"]), organizationId: org.id }
  });
  if (!task) throw new HttpError(404, "Task not found");

  await prisma.task.delete({ where: { id: task.id } });
  sendSuccess(res, { deleted: true });
});
