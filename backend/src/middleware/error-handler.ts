import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/http-error.js";
import { logger } from "../utils/logger.js";

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

const isPrismaInitError = (error: unknown): boolean =>
  error instanceof Error && error.constructor.name === "PrismaClientInitializationError";

export const errorHandler = (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
  const userId = (req as Request & { user?: { id?: string } }).user?.id;

  if (error instanceof ZodError) {
    logger.error("Request validation failed", {
      path: req.path,
      method: req.method,
      userId: userId ?? null
    });
    sendError(res, 400, "VALIDATION_ERROR", "Request validation failed", req.path, error.flatten());
    return;
  }

  if (error instanceof HttpError) {
    if (error.statusCode >= 500) {
      logger.error("HTTP error", {
        status: error.statusCode,
        message: error.message,
        path: req.path,
        method: req.method,
        userId: userId ?? null
      });
    }
    sendError(res, error.statusCode, "HTTP_ERROR", error.message, req.path);
    return;
  }

  const userMessage = isPrismaInitError(error) ? "Database error" : "Unexpected server error";
  logger.error("Unhandled server error", {
    path: req.path,
    method: req.method,
    userId: userId ?? null,
    error: error instanceof Error ? error.message : String(error),
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {})
  });
  sendError(res, 500, "INTERNAL_SERVER_ERROR", userMessage, req.path);
};
