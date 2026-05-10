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

export const errorHandler = (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
  if (error instanceof ZodError) {
    sendError(res, 400, "VALIDATION_ERROR", "Request validation failed", req.path, error.flatten());
    return;
  }

  if (error instanceof HttpError) {
    sendError(res, error.statusCode, "HTTP_ERROR", error.message, req.path);
    return;
  }

  console.error("[error]", req.method, req.path, error);
  sendError(res, 500, "INTERNAL_SERVER_ERROR", "Unexpected server error", req.path);
};
