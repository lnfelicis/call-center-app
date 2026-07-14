import type { RequestHandler } from "express";
import type { Database } from "../../database/database.js";
import type { AuditWriter } from "../audit/types.js";
import { RoleController } from "./controller.js";
import { RoleRepository } from "./repository.js";
import { createRoleRoutes } from "./routes.js";
import { RoleService } from "./service.js";

export type RoleModuleDependencies = {
  database: Database;
  auditWriter: AuditWriter;
  idGenerator: () => string;
  requireAuth: RequestHandler;
  requirePermission: (permission: string) => RequestHandler;
  requireAnyPermission: (permissions: string[]) => RequestHandler;
};

export function createRoleRouter(dependencies: RoleModuleDependencies) {
  const repository = new RoleRepository(dependencies.database);
  const service = new RoleService({
    repository,
    idGenerator: dependencies.idGenerator,
    writeAuditLog: dependencies.auditWriter,
  });
  const controller = new RoleController(service);

  return createRoleRoutes({
    controller,
    requireAuth: dependencies.requireAuth,
    requirePermission: dependencies.requirePermission,
    requireAnyPermission: dependencies.requireAnyPermission,
  });
}
