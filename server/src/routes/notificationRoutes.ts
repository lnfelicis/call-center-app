import { writeAuditLog } from "../audit.js";
import { requireAuth, requirePermission } from "../auth.js";
import { NotificationController } from "../modules/notifications/controller.js";
import { createNotificationRoutes } from "../modules/notifications/routes.js";
import { notificationService } from "../notifications.js";

export { createNotificationRoutes } from "../modules/notifications/routes.js";
export type { NotificationRoutesDependencies } from "../modules/notifications/routes.js";

const controller = new NotificationController(notificationService, writeAuditLog);

export const notificationRoutes = createNotificationRoutes({
  controller,
  authenticate: requireAuth,
  authorize: requirePermission,
});
