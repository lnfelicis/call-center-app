import { randomUUID } from "node:crypto";
import { writeAuditLog } from "../audit.js";
import { requireAnyPermission, requireAuth, requirePermission } from "../auth.js";
import { db } from "../db.js";
import { getPasswordValidationErrors, hashPassword } from "../security.js";
import { UserController } from "../modules/users/controller.js";
import { UserRepository } from "../modules/users/repository.js";
import { createUserRoutes } from "../modules/users/routes.js";
import { UserService } from "../modules/users/service.js";

const repository = new UserRepository(db);
const service = new UserService({
  repository,
  idGenerator: randomUUID,
  hashPassword,
  writeAuditLog,
});
const controller = new UserController({ service, getPasswordValidationErrors });

export const userRoutes = createUserRoutes({
  controller,
  requireAuth,
  requirePermission,
  requireAnyPermission,
});
