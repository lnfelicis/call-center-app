import { Router } from "express";
import type { requireAuth, requirePermission } from "../../auth.js";
import type { SettingsController } from "./controller.js";

export type SettingRoutesDependencies = {
  controller: SettingsController;
  authenticate: typeof requireAuth;
  authorize: typeof requirePermission;
};

export function createSettingRoutes(dependencies: SettingRoutesDependencies) {
  const routes = Router();
  routes.use(dependencies.authenticate);
  routes.get(
    "/settings",
    dependencies.authorize("settings.manage"),
    dependencies.controller.getSettings,
  );
  routes.get(
    "/settings/security",
    dependencies.authorize("settings.manage"),
    dependencies.controller.getSecurity,
  );
  routes.patch(
    "/settings/security",
    dependencies.authorize("settings.manage"),
    dependencies.controller.updateSecurity,
  );
  routes.patch(
    "/settings",
    dependencies.authorize("settings.manage"),
    dependencies.controller.updateSettings,
  );
  routes.get(
    "/settings/options/:type",
    dependencies.authorize("settings.manage"),
    dependencies.controller.getOptions,
  );
  routes.post(
    "/settings/options/:type",
    dependencies.authorize("settings.manage"),
    dependencies.controller.createOption,
  );
  routes.patch(
    "/settings/options/:type/:id",
    dependencies.authorize("settings.manage"),
    dependencies.controller.updateOption,
  );
  return routes;
}
