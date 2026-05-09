import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import { signAccessToken } from "../../utils/jwt.js";

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  organizationName: z.string().min(1)
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8)
});

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const input = registerSchema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new HttpError(409, "Email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const org = await prisma.organization.create({
    data: {
      name: input.organizationName,
      users: {
        create: {
          email: input.email,
          fullName: input.fullName,
          passwordHash
        }
      }
    },
    include: { users: true }
  });

  const user = org.users[0];
  const token = signAccessToken({
    userId: user.id,
    email: user.email,
    organizationId: org.id
  });

  res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      organizationId: org.id
    }
  });
});

authRouter.post("/login", async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new HttpError(401, "Invalid credentials");
  }

  const token = signAccessToken({
    userId: user.id,
    email: user.email,
    organizationId: user.organizationId
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      organizationId: user.organizationId
    }
  });
});
