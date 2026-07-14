import type { RequestHandler } from "express";
import type { Database } from "../../database/database.js";
import type { AuditWriter } from "../audit/types.js";
import { SettingsController } from "./controller.js";
import { SettingsRepository } from "./repository.js";
import { createSettingRoutes } from "./routes.js";
import { SettingsService } from "./service.js";
import type { AppSettingsService } from "./app-settings.service.js";

export type SettingsModuleDependencies = {
  database: Database;
  appSettings: AppSettingsService;
  auditWriter: AuditWriter;
  idGenerator: () => string;
  requireAuth: RequestHandler;
  requirePermission: (permission: string) => RequestHandler;
};

export function createSettingsRouter(dependencies: SettingsModuleDependencies) {
  const service = new SettingsService({
    repository: new SettingsRepository(dependencies.database),
    readSetting: dependencies.appSettings.read.bind(dependencies.appSettings),
    writeSetting: dependencies.appSettings.write.bind(dependencies.appSettings),
    audit: dependencies.auditWriter,
    generateId: dependencies.idGenerator,
  });
  const controller = new SettingsController(service);

  return createSettingRoutes({
    controller,
    authenticate: dependencies.requireAuth,
    authorize: dependencies.requirePermission,
  });
}
