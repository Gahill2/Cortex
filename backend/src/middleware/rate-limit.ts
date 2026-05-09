import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http-error.js";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

const pruneExpiredBuckets = (now: number): void => {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
};

export const routeRateLimit = (limit: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const identifier = req.auth?.userId ?? req.ip ?? "anonymous";
    const key = `${req.method}:${req.path}:${identifier}`;
    const now = Date.now();
    pruneExpiredBuckets(now);
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader("X-RateLimit-Limit", String(limit));
      res.setHeader("X-RateLimit-Remaining", String(limit - 1));
      next();
      return;
    }

    if (current.count >= limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      throw new HttpError(429, "Rate limit exceeded");
    }

    current.count += 1;
    buckets.set(key, current);
    res.setHeader("X-RateLimit-Limit", String(limit));
    res.setHeader("X-RateLimit-Remaining", String(limit - current.count));
    next();
  };
};

export const resetRateLimitBuckets = (): void => {
  buckets.clear();
};
