import { Router, type RequestHandler } from "express";
import type { SettingsController } from "./controller.js";

export type SettingRoutesDependencies = {
  controller: SettingsController;
  authenticate: RequestHandler;
  authorize: (permission: string) => RequestHandler;
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
