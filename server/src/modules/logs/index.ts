import type { RequestHandler } from "express";
import type { Database } from "../../database/database.js";
import { LogController } from "./controller.js";
import { LogRepository } from "./repository.js";
import { createLogRoutes } from "./routes.js";
import { LogService } from "./service.js";

export type LogModuleDependencies = {
  database: Database;
  requireAuth: RequestHandler;
  requirePermission: (permission: string) => RequestHandler;
};

export function createLogRouter(dependencies: LogModuleDependencies) {
  const repository = new LogRepository(dependencies.database);
  const service = new LogService(repository);
  const controller = new LogController(service);

  return createLogRoutes({
    controller,
    requireAuth: dependencies.requireAuth,
    requirePermission: dependencies.requirePermission,
  });
}
