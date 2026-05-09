import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { HttpError } from "../../utils/http-error.js";

const updateOrgSchema = z.object({
  name: z.string().min(1)
});

export const organizationsRouter = Router();
organizationsRouter.use(requireAuth);

organizationsRouter.get("/me", async (req, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: req.auth!.organizationId },
    include: {
      users: { select: { id: true, email: true, fullName: true, createdAt: true } }
    }
  });

  if (!org) {
    throw new HttpError(404, "Organization not found");
  }

  res.json(org);
});

organizationsRouter.patch("/me", async (req, res) => {
  const input = updateOrgSchema.parse(req.body);
  const org = await prisma.organization.update({
    where: { id: req.auth!.organizationId },
    data: { name: input.name }
  });
  res.json(org);
});
