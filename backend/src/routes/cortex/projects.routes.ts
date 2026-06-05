import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { sendSuccess } from "../../utils/api-response.js";
import { getOrCreateCortexUser } from "../../features/auth/cortex-db-user.js";

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional()
});

export const cortexProjectsRouter = Router();
cortexProjectsRouter.use(requireAuth);

// GET /api/projects
cortexProjectsRouter.get("/", routeRateLimit(60, 60_000), async (req, res) => {
  const { userId, email } = req.auth!;
  const { org } = await getOrCreateCortexUser(userId, email);

  const projects = await prisma.project.findMany({
    where: { organizationId: org.id },
    include: {
      _count: { select: { tasks: true } }
    },
    orderBy: { createdAt: "asc" }
  });

  sendSuccess(res, projects, "live");
});

// POST /api/projects
cortexProjectsRouter.post("/", routeRateLimit(10, 60_000), async (req, res) => {
  const { userId, email } = req.auth!;
  const { org } = await getOrCreateCortexUser(userId, email);
  const input = createProjectSchema.parse(req.body);

  const project = await prisma.project.create({
    data: {
      name: input.name,
      description: input.description,
      organizationId: org.id
    }
  });

  res.status(201);
  sendSuccess(res, project);
});
