import type { RequestHandler } from "express";
import type { AuditWriter } from "../audit/types.js";
import { NotificationController } from "./controller.js";
import { createNotificationRoutes } from "./routes.js";
import type { NotificationService } from "./service.js";

export type NotificationModuleDependencies = {
  service: NotificationService;
  auditWriter: AuditWriter;
  requireAuth: RequestHandler;
  requirePermission: (permission: string) => RequestHandler;
};

export function createNotificationRouter(dependencies: NotificationModuleDependencies) {
  const controller = new NotificationController(
    dependencies.service,
    dependencies.auditWriter,
  );

  return createNotificationRoutes({
    controller,
    authenticate: dependencies.requireAuth,
    authorize: dependencies.requirePermission,
  });
}
