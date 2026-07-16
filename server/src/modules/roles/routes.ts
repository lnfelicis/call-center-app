import { Router, type RequestHandler } from "express";
import type { RoleController } from "./controller.js";

type PermissionMiddlewareFactory = (permission: string) => RequestHandler;
type AnyPermissionMiddlewareFactory = (permissions: string[]) => RequestHandler;

export type RoleRoutesDependencies = {
  controller: RoleController;
  requireAuth: RequestHandler;
  requirePermission: PermissionMiddlewareFactory;
  requireAnyPermission: AnyPermissionMiddlewareFactory;
};

export function createRoleRoutes({
  controller,
  requireAuth,
  requirePermission,
  requireAnyPermission,
}: RoleRoutesDependencies) {
  const router = Router();

  router.use(requireAuth);
  router.get(
    "/permissions",
    requireAnyPermission(["roles.manage", "users.manage"]),
    controller.permissions,
  );
  router.get(
    "/roles",
    requireAnyPermission(["roles.manage", "users.manage"]),
    controller.list,
  );
  router.post("/roles", requirePermission("roles.manage"), controller.create);
  router.patch("/roles/:id", requirePermission("roles.manage"), controller.update);
  router.patch(
    "/roles/:id/permissions",
    requirePermission("roles.manage"),
    controller.replacePermissions,
  );

  return router;
}
