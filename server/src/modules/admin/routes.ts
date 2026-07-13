import { Router, type RequestHandler } from "express";
import type { AdminController } from "./controller.js";

export type AdminRoutesDependencies = {
  controller: AdminController;
  requireAuth: RequestHandler;
  requireAnyPermission: (permissions: string[]) => RequestHandler;
};

export function createAdminRoutes({
  controller,
  requireAuth,
  requireAnyPermission,
}: AdminRoutesDependencies) {
  const router = Router();

  router.use(requireAuth);
  router.get(
    "/admin/dashboard",
    requireAnyPermission(["calls.view.all", "users.manage", "logs.view"]),
    controller.dashboard,
  );

  return router;
}
