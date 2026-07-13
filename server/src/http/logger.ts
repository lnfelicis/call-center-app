import type { NextFunction, Request, Response } from "express";
import pino, { type Logger as PinoLogger } from "pino";

export type AppLogger = Pick<PinoLogger, "debug" | "info" | "warn" | "error">;

export function createLogger(level: string): PinoLogger {
  return pino({
    level,
    redact: {
      paths: ["authorization", "token", "password", "req.headers.authorization"],
      censor: "[REDACTED]",
    },
  });
}

export function createRequestLogger(logger: AppLogger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();

    res.once("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.info({
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
        ip: req.ip,
        userAgent: req.header("user-agent") ?? null,
      });
    });

    next();
  };
}
