import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional()
});

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional()
});

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get("/", async (req, res) => {
  const projects = await prisma.project.findMany({
    where: { organizationId: req.auth!.organizationId },
    orderBy: { createdAt: "desc" }
  });
  res.json(projects);
});

projectsRouter.post("/", async (req, res) => {
  const input = createProjectSchema.parse(req.body);
  const project = await prisma.project.create({
    data: {
      name: input.name,
      description: input.description,
      organizationId: req.auth!.organizationId
    }
  });
  res.status(201).json(project);
});

projectsRouter.patch("/:projectId", async (req, res) => {
  const input = updateProjectSchema.parse(req.body);
  const project = await prisma.project.update({
    where: { id: req.params.projectId, organizationId: req.auth!.organizationId },
    data: input
  });
  res.json(project);
});

projectsRouter.delete("/:projectId", async (req, res) => {
  await prisma.project.delete({
    where: { id: req.params.projectId, organizationId: req.auth!.organizationId }
  });
  res.status(204).send();
});
