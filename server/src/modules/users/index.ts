import type { RequestHandler } from "express";
import type { Database } from "../../database/database.js";
import type { AuditWriter } from "../audit/types.js";
import { getPasswordValidationErrors, hashPassword } from "../auth/security.js";
import { UserController } from "./controller.js";
import { UserRepository } from "./repository.js";
import { createUserRoutes } from "./routes.js";
import { UserService } from "./service.js";

export type UserModuleDependencies = {
  database: Database;
  auditWriter: AuditWriter;
  idGenerator: () => string;
  requireAuth: RequestHandler;
  requirePermission: (permission: string) => RequestHandler;
  requireAnyPermission: (permissions: string[]) => RequestHandler;
};

export function createUserRouter(dependencies: UserModuleDependencies) {
  const repository = new UserRepository(dependencies.database);
  const service = new UserService({
    repository,
    idGenerator: dependencies.idGenerator,
    hashPassword,
    writeAuditLog: dependencies.auditWriter,
  });
  const controller = new UserController({ service, getPasswordValidationErrors });

  return createUserRoutes({
    controller,
    requireAuth: dependencies.requireAuth,
    requirePermission: dependencies.requirePermission,
    requireAnyPermission: dependencies.requireAnyPermission,
  });
}
