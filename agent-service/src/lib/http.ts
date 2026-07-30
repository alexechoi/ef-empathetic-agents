import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodType } from "zod";
import { logger } from "./logger.js";

const log = logger.child({ module: "http" });

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

/** Wraps an async route so thrown/rejected errors reach the error middleware. */
export function asyncHandler(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}

/** Parses `data` with `schema`, throwing a tagged 400 on failure. */
export function parseOrThrow<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const err = new Error("Validation failed") as Error & {
      status?: number;
      issues?: unknown;
    };
    err.status = 400;
    err.issues = result.error.issues;
    throw err;
  }
  return result.data;
}

/** Central Express error handler. Always logs; never leaks stack traces. */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status =
    err instanceof ZodError
      ? 400
      : ((err as { status?: number })?.status ?? 500);
  const message = err instanceof Error ? err.message : "Unknown error";
  const issues =
    err instanceof ZodError ? err.issues : (err as { issues?: unknown })?.issues;

  log.error({ err, status }, "Request failed");
  res.status(status).json({ error: message, issues });
}
