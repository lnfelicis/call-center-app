import { requireAnyPermission, requireAuth } from "../auth.js";
import { db } from "../db.js";
import { AdminController } from "../modules/admin/controller.js";
import { AdminRepository } from "../modules/admin/repository.js";
import { createAdminRoutes } from "../modules/admin/routes.js";
import { AdminService } from "../modules/admin/service.js";

const repository = new AdminRepository(db);
const service = new AdminService(repository);
const controller = new AdminController(service);

export const adminRoutes = createAdminRoutes({ controller, requireAuth, requireAnyPermission });
