import { Router, type RequestHandler } from "express";
import type { NotificationController } from "./controller.js";

export type NotificationRoutesDependencies = {
  controller: NotificationController;
  authenticate: RequestHandler;
  authorize: (permission: string) => RequestHandler;
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
