import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/http-error.js";

type ErrorBody = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    timestamp: string;
    path: string;
  };
};

const sendError = (
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  path: string,
  details?: unknown
): void => {
  const body: ErrorBody = {
    ok: false,
    error: {
      code,
      message,
      ...(details ? { details } : {})
    },
    meta: {
      timestamp: new Date().toISOString(),
      path
    }
  };
  res.status(statusCode).json(body);
};

export const notFoundHandler = (_req: Request, res: Response): void => {
  sendError(res, 404, "NOT_FOUND", "Route not found", _req.path);
};

const logError = (req: Request, statusCode: number, message: string, error: unknown): void => {
  const userId = (req as Request & { user?: { id?: string } }).user?.id;
  console.error(JSON.stringify({
    path: req.path,
    method: req.method,
    userId: userId ?? null,
    statusCode,
    message,
    stack: error instanceof Error ? error.stack : undefined
  }));
};

const isPrismaInitError = (error: unknown): boolean =>
  error instanceof Error && error.constructor.name === "PrismaClientInitializationError";

export const errorHandler = (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
  if (error instanceof ZodError) {
    logError(req, 400, "Request validation failed", error);
    sendError(res, 400, "VALIDATION_ERROR", "Request validation failed", req.path, error.flatten());
    return;
  }

  if (error instanceof HttpError) {
    logError(req, error.statusCode, error.message, error);
    sendError(res, error.statusCode, "HTTP_ERROR", error.message, req.path);
    return;
  }

  const userMessage = isPrismaInitError(error) ? "Database error" : "Unexpected server error";
  logError(req, 500, userMessage, error);
  sendError(res, 500, "INTERNAL_SERVER_ERROR", userMessage, req.path);
};
