import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../../src/database/database.js";

const mocks = vi.hoisted(() => {
  const auditWriter = vi.fn();
  const requireAuth = vi.fn();
  const requirePermission = vi.fn();
  const requireAnyPermission = vi.fn();
  const appSettingsRead = vi.fn();
  const notifyUsersWithAnyPermission = vi.fn();
  const createNotifications = vi.fn();

  return {
    auditWriter,
    requireAuth,
    requirePermission,
    requireAnyPermission,
    appSettingsRead,
    notifyUsersWithAnyPermission,
    createNotifications,
    appSettingsRepository: vi.fn(),
    appSettingsService: vi.fn(),
    auditRepository: vi.fn(),
    authRepository: vi.fn(),
    notificationRepository: vi.fn(),
    notificationService: vi.fn(),
    createAdminRouter: vi.fn(() => ({ feature: "admin" })),
    createAuthRouter: vi.fn(() => ({ feature: "auth" })),
    createCallRouter: vi.fn(() => ({ feature: "calls" })),
    createLogRouter: vi.fn(() => ({ feature: "logs" })),
    createNotificationRouter: vi.fn(() => ({ feature: "notifications" })),
    createReportRouter: vi.fn(() => ({ feature: "reports" })),
    createRoleRouter: vi.fn(() => ({ feature: "roles" })),
    createSettingsRouter: vi.fn(() => ({ feature: "settings" })),
    createUserRouter: vi.fn(() => ({ feature: "users" })),
  };
});

vi.mock("../../../src/modules/admin/index.js", () => ({
  createAdminRouter: mocks.createAdminRouter,
}));
vi.mock("../../../src/modules/auth/index.js", () => ({
  createAuthRouter: mocks.createAuthRouter,
}));
vi.mock("../../../src/modules/calls/index.js", () => ({
  createCallRouter: mocks.createCallRouter,
}));
vi.mock("../../../src/modules/logs/index.js", () => ({
  createLogRouter: mocks.createLogRouter,
}));
vi.mock("../../../src/modules/notifications/index.js", () => ({
  createNotificationRouter: mocks.createNotificationRouter,
}));
vi.mock("../../../src/modules/reports/index.js", () => ({
  createReportRouter: mocks.createReportRouter,
}));
vi.mock("../../../src/modules/roles/index.js", () => ({
  createRoleRouter: mocks.createRoleRouter,
}));
vi.mock("../../../src/modules/settings/index.js", () => ({
  createSettingsRouter: mocks.createSettingsRouter,
}));
vi.mock("../../../src/modules/users/index.js", () => ({
  createUserRouter: mocks.createUserRouter,
}));

vi.mock("../../../src/modules/settings/app-settings.repository.js", () => ({
  AppSettingsRepository: class {
    constructor(database: Database) {
      mocks.appSettingsRepository(database);
    }
  },
}));
vi.mock("../../../src/modules/settings/app-settings.service.js", () => ({
  AppSettingsService: class {
    read = mocks.appSettingsRead;
    write = vi.fn();

    constructor(repository: unknown) {
      mocks.appSettingsService(repository);
    }
  },
}));
vi.mock("../../../src/modules/audit/repository.js", () => ({
  AuditRepository: class {
    constructor(database: Database) {
      mocks.auditRepository(database);
    }
  },
}));
vi.mock("../../../src/modules/audit/service.js", () => ({
  createAuditWriter: vi.fn(() => mocks.auditWriter),
}));
vi.mock("../../../src/modules/auth/repository.js", () => ({
  AuthRepository: class {
    getUserWithPermissions = vi.fn();

    constructor(database: Database) {
      mocks.authRepository(database);
    }
  },
}));
vi.mock("../../../src/modules/auth/middleware.js", () => ({
  createRequireAuth: vi.fn(() => mocks.requireAuth),
  requirePermission: mocks.requirePermission,
  requireAnyPermission: mocks.requireAnyPermission,
}));
vi.mock("../../../src/modules/notifications/repository.js", () => ({
  NotificationRepository: class {
    constructor(database: Database) {
      mocks.notificationRepository(database);
    }
  },
}));
vi.mock("../../../src/modules/notifications/service.js", () => ({
  NotificationService: class {
    notifyUsersWithAnyPermission = mocks.notifyUsersWithAnyPermission;
    createNotifications = mocks.createNotifications;

    constructor(dependencies: unknown) {
      mocks.notificationService(dependencies);
    }
  },
}));

import { createAppRouters } from "../../../src/composition/app-routers.js";

describe("createAppRouters", () => {
  it("shares one database and the composed cross-cutting dependencies", () => {
    const database = {} as Database;
    const idGenerator = vi.fn(() => "generated-id");
    const clock = vi.fn(() => new Date("2026-01-01T00:00:00.000Z"));

    const routers = createAppRouters({ database, idGenerator, clock });

    expect(Object.keys(routers)).toEqual([
      "auth",
      "admin",
      "reports",
      "calls",
      "roles",
      "settings",
      "users",
      "logs",
      "notifications",
    ]);
    expect(mocks.appSettingsRepository).toHaveBeenCalledWith(database);
    expect(mocks.auditRepository).toHaveBeenCalledWith(database);
    expect(mocks.authRepository).toHaveBeenCalledWith(database);
    expect(mocks.notificationRepository).toHaveBeenCalledWith(database);

    for (const createFeatureRouter of [
      mocks.createAdminRouter,
      mocks.createAuthRouter,
      mocks.createCallRouter,
      mocks.createLogRouter,
      mocks.createReportRouter,
      mocks.createRoleRouter,
      mocks.createSettingsRouter,
      mocks.createUserRouter,
    ]) {
      expect(createFeatureRouter).toHaveBeenCalledWith(
        expect.objectContaining({ database }),
      );
    }

    expect(mocks.createNotificationRouter).toHaveBeenCalledWith(
      expect.objectContaining({
        auditWriter: mocks.auditWriter,
        requireAuth: mocks.requireAuth,
        requirePermission: mocks.requirePermission,
      }),
    );
    expect(mocks.createCallRouter).toHaveBeenCalledWith(
      expect.objectContaining({ idGenerator, clock, auditWriter: mocks.auditWriter }),
    );
  });
});
