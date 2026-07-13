import { randomUUID } from "node:crypto";
import { writeAuditLog } from "../audit.js";
import { requireAuth, requirePermission } from "../auth.js";
import { db } from "../db.js";
import { SettingsController } from "../modules/settings/controller.js";
import { SettingsRepository } from "../modules/settings/repository.js";
import { createSettingRoutes } from "../modules/settings/routes.js";
import { SettingsService } from "../modules/settings/service.js";
import { readAppSetting, writeAppSetting } from "../settings.js";

export { createSettingRoutes } from "../modules/settings/routes.js";
export type { SettingRoutesDependencies } from "../modules/settings/routes.js";

const service = new SettingsService({
  repository: new SettingsRepository(db),
  readSetting: readAppSetting,
  writeSetting: writeAppSetting,
  audit: writeAuditLog,
  generateId: randomUUID,
});
const controller = new SettingsController(service);

export const settingRoutes = createSettingRoutes({
  controller,
  authenticate: requireAuth,
  authorize: requirePermission,
});
