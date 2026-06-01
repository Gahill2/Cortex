import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HttpError } from "../../utils/http-error.js";
import { getOrCreateCortexUser } from "../../features/auth/cortex-db-user.js";
import { taskStatusQuerySchema } from "../../schemas/query-schemas.js";
import {
  progressForStatus,
  removeTaskFromGoogleCalendar,
  statusForProgress,
  syncTaskToGoogleCalendar,
} from "../../features/calendar/task-calendar-sync.js";

const progressSchema = z.number().int().min(0).max(100);

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  projectId: z.string().min(1),
  assigneeId: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional().default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().default("MEDIUM"),
  progressPercent: progressSchema.optional(),
  dueDate: z.string().optional().nullable(),
  planStart: z.string().optional().nullable(),
  planEnd: z.string().optional().nullable(),
  syncToCalendar: z.boolean().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  progressPercent: progressSchema.optional(),
  dueDate: z.string().optional().nullable(),
  planStart: z.string().optional().nullable(),
  planEnd: z.string().optional().nullable(),
  syncToCalendar: z.boolean().optional(),
  assigneeId: z.string().nullable().optional(),
  projectId: z.string().min(1).optional(),
});

function parseOptionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, "invalid_date");
  return d;
}

async function applyCalendarSync(
  userId: string,
  task: Awaited<ReturnType<typeof prisma.task.update>>,
  timeZone?: string
): Promise<{ task: typeof task; calendarSync?: { ok: boolean; error?: string; needsReconnect?: boolean } }> {
  if (!task.dueDate || !task.syncToCalendar) {
    if (task.googleEventId) {
      await removeTaskFromGoogleCalendar(userId, task);
      const cleared = await prisma.task.update({
        where: { id: task.id },
        data: { googleEventId: null, googleCalendarId: null },
        include: { project: { select: { id: true, name: true } } },
      });
      return { task: cleared };
    }
    return { task };
  }

  const sync = await syncTaskToGoogleCalendar(userId, task, timeZone?.trim() || "UTC");
  if (!sync.ok) {
    return {
      task,
      calendarSync: {
        ok: false,
        error: sync.error,
        needsReconnect: sync.needsReconnect,
      },
    };
  }

  const linked = await prisma.task.update({
    where: { id: task.id },
    data: {
      googleEventId: sync.googleEventId,
      googleCalendarId: sync.googleCalendarId,
    },
    include: { project: { select: { id: true, name: true } } },
  });
  return { task: linked, calendarSync: { ok: true } };
}

export const cortexTasksRouter = Router();
cortexTasksRouter.use(requireAuth);

// GET /api/tasks
cortexTasksRouter.get("/", routeRateLimit(60, 60_000), async (req, res) => {
  const { userId, email } = req.auth!;
  const { org } = await getOrCreateCortexUser(userId, email);
  const { status } = taskStatusQuerySchema.parse(req.query);

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

  sendSuccess(res, tasks, "live");
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

  const progress =
    input.progressPercent ??
    (input.status ? progressForStatus(input.status) : 0);
  const status = input.status ?? statusForProgress(progress);

  const task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description,
      status,
      priority: input.priority,
      progressPercent: progress,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      planStart: input.planStart ? new Date(input.planStart) : null,
      planEnd: input.planEnd ? new Date(input.planEnd) : null,
      syncToCalendar: input.syncToCalendar ?? true,
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

  const tz = typeof req.headers["x-timezone"] === "string" ? req.headers["x-timezone"] : undefined;
  const { task: saved, calendarSync } = await applyCalendarSync(userId, task, tz);

  res.status(201);
  sendSuccess(res, { ...saved, calendarSync }, "live");
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

  if (input.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, organizationId: org.id }
    });
    if (!project) throw new HttpError(404, "Project not found");
  }

  let progress = input.progressPercent;
  let status = input.status;
  if (progress !== undefined && status === undefined) {
    status = statusForProgress(progress);
  } else if (status !== undefined && progress === undefined) {
    progress = progressForStatus(status);
  }

  const updated = await prisma.task.update({
    where: { id: task.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(progress !== undefined ? { progressPercent: progress } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.dueDate !== undefined ? { dueDate: parseOptionalDate(input.dueDate) } : {}),
      ...(input.planStart !== undefined ? { planStart: parseOptionalDate(input.planStart) } : {}),
      ...(input.planEnd !== undefined ? { planEnd: parseOptionalDate(input.planEnd) } : {}),
      ...(input.syncToCalendar !== undefined ? { syncToCalendar: input.syncToCalendar } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {})
    },
    include: {
      project: { select: { id: true, name: true } }
    }
  });

  const tz = typeof req.headers["x-timezone"] === "string" ? req.headers["x-timezone"] : undefined;
  const { task: saved, calendarSync } = await applyCalendarSync(userId, updated, tz);

  sendSuccess(res, { ...saved, calendarSync }, "live");
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
  sendSuccess(res, { deleted: true }, "live");
});
