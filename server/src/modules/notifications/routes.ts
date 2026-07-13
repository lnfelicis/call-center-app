import { Router } from "express";
import type { requireAuth, requirePermission } from "../../auth.js";
import type { NotificationController } from "./controller.js";

export type NotificationRoutesDependencies = {
  controller: NotificationController;
  authenticate: typeof requireAuth;
  authorize: typeof requirePermission;
};

export function createNotificationRoutes(dependencies: NotificationRoutesDependencies) {
  const routes = Router();

  routes.use(dependencies.authenticate);
  routes.get(
    "/notifications",
    dependencies.authorize("notifications.view"),
    dependencies.controller.list,
  );
  routes.patch(
    "/notifications/:id/read",
    dependencies.authorize("notifications.view"),
    dependencies.controller.markRead,
  );

  return routes;
}
