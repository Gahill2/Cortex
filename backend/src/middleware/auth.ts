import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { HttpError } from "../utils/http-error.js";
import { sessionLockStore } from "../features/auth/session-lock-store.js";

declare module "express-serve-static-core" {
  interface Request {
    auth?: {
      userId: string;
      email: string;
      organizationId?: string;
    };
  }
}

function authenticateRequest(req: Request): string {
  const authHeader = req.header("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing bearer token");
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new HttpError(401, "Missing bearer token");
  }

  try {
    req.auth = verifyAccessToken(token);
  } catch {
    throw new HttpError(401, "Invalid or expired session token");
  }
  return token;
}

export const requireValidSession = (req: Request, _res: Response, next: NextFunction): void => {
  authenticateRequest(req);
  next();
};

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const token = authenticateRequest(req);
  if (sessionLockStore.isLocked(token)) {
    throw new HttpError(423, "Session locked");
  }
  next();
};
