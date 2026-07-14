import type { RequestHandler } from "express";
import type { Database } from "../../database/database.js";
import type { AuditWriter } from "../audit/types.js";
import { AuthController } from "./controller.js";
import { getClientIp, isClientIpAllowed } from "./request-ip.js";
import { AuthRepository } from "./repository.js";
import { createAuthRoutes } from "./routes.js";
import { signToken, verifyPassword } from "./security.js";
import { AuthService } from "./service.js";
import type { SecuritySettings } from "./types.js";

export type AuthModuleDependencies = {
  database: Database;
  requireAuth: RequestHandler;
  readSecuritySettings: () => Promise<SecuritySettings>;
  auditWriter: AuditWriter;
};

export function createAuthRouter(dependencies: AuthModuleDependencies) {
  const repository = new AuthRepository(dependencies.database);
  const service = new AuthService({
    repository,
    readSecuritySettings: dependencies.readSecuritySettings,
    getClientIp,
    isClientIpAllowed,
    verifyPassword,
    signToken,
    writeAuditLog: dependencies.auditWriter,
  });
  const controller = new AuthController(service);

  return createAuthRoutes({ controller, requireAuth: dependencies.requireAuth });
}
