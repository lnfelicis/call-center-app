import type { RequestHandler } from "express";
import type { Database } from "../../database/database.js";
import { AdminController } from "./controller.js";
import { AdminRepository } from "./repository.js";
import { createAdminRoutes } from "./routes.js";
import { AdminService } from "./service.js";

export type AdminModuleDependencies = {
  database: Database;
  requireAuth: RequestHandler;
  requireAnyPermission: (permissions: string[]) => RequestHandler;
};

export function createAdminRouter(dependencies: AdminModuleDependencies) {
  const repository = new AdminRepository(dependencies.database);
  const service = new AdminService(repository);
  const controller = new AdminController(service);

  return createAdminRoutes({
    controller,
    requireAuth: dependencies.requireAuth,
    requireAnyPermission: dependencies.requireAnyPermission,
  });
}
