import type { Request, RequestHandler } from "express";
import type { Database } from "../../database/database.js";
import type { AuditWriter } from "../audit/types.js";
import { getClientIp } from "../auth/request-ip.js";
import type { NotificationInput } from "../notifications/types.js";
import type { NotificationSettings } from "../settings/app-settings.types.js";
import { createMySqlCallRepository } from "./call.repository.js";
import { createCallRoutes } from "./call.routes.js";
import type { Clock, IdGenerator } from "./call.types.js";

export type CallModuleDependencies = {
  database: Database;
  auditWriter: AuditWriter;
  notifyUsersWithAnyPermission: (
    permissionIds: string[],
    notification: Omit<NotificationInput, "userIds">,
  ) => Promise<void>;
  readNotificationSettings: () => Promise<NotificationSettings>;
  idGenerator: IdGenerator;
  clock: Clock;
  requireAuth: RequestHandler;
  requireAnyPermission: (permissions: string[]) => RequestHandler;
  requirePermission: (permission: string) => RequestHandler;
};

export function createCallRouter(dependencies: CallModuleDependencies) {
  return createCallRoutes({
    repository: createMySqlCallRepository(dependencies.database, dependencies.idGenerator),
    auditWriter: dependencies.auditWriter,
    notificationPublisher: dependencies.notifyUsersWithAnyPermission,
    notificationSettingsReader: () => dependencies.readNotificationSettings(),
    clientIpReader: (request: Request) => getClientIp(request),
    idGenerator: dependencies.idGenerator,
    clock: dependencies.clock,
    requireAuth: dependencies.requireAuth,
    requireAnyPermission: dependencies.requireAnyPermission,
    requirePermission: dependencies.requirePermission,
  });
}
