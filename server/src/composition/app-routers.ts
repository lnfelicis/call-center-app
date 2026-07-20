import { randomUUID } from "node:crypto";
import type { Router } from "express";
import type { Database } from "../database/database.js";
import { createAdminRouter } from "../modules/admin/index.js";
import { AuditRepository } from "../modules/audit/repository.js";
import { createAuditWriter } from "../modules/audit/service.js";
import { createAuthRouter } from "../modules/auth/index.js";
import {
  createRequireAuth,
  requireAnyPermission,
  requirePermission,
} from "../modules/auth/middleware.js";
import { getClientIp, isSessionIpAllowed } from "../modules/auth/request-ip.js";
import { AuthRepository } from "../modules/auth/repository.js";
import { verifyToken } from "../modules/auth/security.js";
import { createCallRouter } from "../modules/calls/index.js";
import { createLogRouter } from "../modules/logs/index.js";
import { createNotificationRouter } from "../modules/notifications/index.js";
import { NotificationRepository } from "../modules/notifications/repository.js";
import { NotificationService } from "../modules/notifications/service.js";
import { createReportRouter } from "../modules/reports/index.js";
import { createRoleRouter } from "../modules/roles/index.js";
import { AppSettingsRepository } from "../modules/settings/app-settings.repository.js";
import { AppSettingsService } from "../modules/settings/app-settings.service.js";
import { createSettingsRouter } from "../modules/settings/index.js";
import { createUserRouter } from "../modules/users/index.js";

export type AppRouters = {
  auth: Router;
  admin: Router;
  reports: Router;
  calls: Router;
  roles: Router;
  settings: Router;
  users: Router;
  logs: Router;
  notifications: Router;
};

export type AppRouterCompositionDependencies = {
  database: Database;
  idGenerator?: () => string;
  clock?: () => Date;
};

export function createAppRouters({
  database,
  idGenerator = randomUUID,
  clock = () => new Date(),
}: AppRouterCompositionDependencies): AppRouters {
  const appSettings = new AppSettingsService(new AppSettingsRepository(database));
  const auditWriter = createAuditWriter({
    repository: new AuditRepository(database),
    idGenerator,
    getClientIp,
  });
  const authRepository = new AuthRepository(database);
  const requireAuth = createRequireAuth({
    verifyToken,
    readSecuritySettings: () => appSettings.read("security_settings"),
    isSessionIpAllowed,
    getUserWithPermissions: (userId) => authRepository.getUserWithPermissions(userId),
  });
  const notificationService = new NotificationService({
    repository: new NotificationRepository(database),
    readNotificationSettings: () => appSettings.read("notification_settings"),
    generateId: idGenerator,
  });

  return {
    auth: createAuthRouter({
      database,
      requireAuth,
      readSecuritySettings: () => appSettings.read("security_settings"),
      auditWriter,
    }),
    admin: createAdminRouter({ database, requireAuth, requireAnyPermission }),
    reports: createReportRouter({
      database,
      auditWriter,
      requireAuth,
      requirePermission,
      requireAnyPermission,
      clock,
    }),
    calls: createCallRouter({
      database,
      auditWriter,
      notifyUsersWithAnyPermission:
        notificationService.notifyUsersWithAnyPermission.bind(notificationService),
      createNotifications: notificationService.createNotifications.bind(notificationService),
      readNotificationSettings: () => appSettings.read("notification_settings"),
      idGenerator,
      clock,
      requireAuth,
      requireAnyPermission,
      requirePermission,
    }),
    roles: createRoleRouter({
      database,
      auditWriter,
      idGenerator,
      requireAuth,
      requirePermission,
      requireAnyPermission,
    }),
    settings: createSettingsRouter({
      database,
      appSettings,
      auditWriter,
      idGenerator,
      requireAuth,
      requirePermission,
    }),
    users: createUserRouter({
      database,
      auditWriter,
      idGenerator,
      requireAuth,
      requirePermission,
      requireAnyPermission,
    }),
    logs: createLogRouter({ database, requireAuth, requirePermission }),
    notifications: createNotificationRouter({
      service: notificationService,
      auditWriter,
      requireAuth,
      requirePermission,
    }),
  };
}
