import { requireAuth, requirePermission } from "../auth.js";
import { db } from "../db.js";
import { LogController } from "../modules/logs/controller.js";
import { LogRepository } from "../modules/logs/repository.js";
import { createLogRoutes } from "../modules/logs/routes.js";
import { LogService } from "../modules/logs/service.js";

const repository = new LogRepository(db);
const service = new LogService(repository);
const controller = new LogController(service);

export const logRoutes = createLogRoutes({ controller, requireAuth, requirePermission });
