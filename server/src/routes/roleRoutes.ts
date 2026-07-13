import { randomUUID } from "node:crypto";
import { writeAuditLog } from "../audit.js";
import { requireAnyPermission, requireAuth, requirePermission } from "../auth.js";
import { db } from "../db.js";
import { RoleController } from "../modules/roles/controller.js";
import { RoleRepository } from "../modules/roles/repository.js";
import { createRoleRoutes } from "../modules/roles/routes.js";
import { RoleService } from "../modules/roles/service.js";

const repository = new RoleRepository(db);
const service = new RoleService({ repository, idGenerator: randomUUID, writeAuditLog });
const controller = new RoleController(service);

export const roleRoutes = createRoleRoutes({
  controller,
  requireAuth,
  requirePermission,
  requireAnyPermission,
});
