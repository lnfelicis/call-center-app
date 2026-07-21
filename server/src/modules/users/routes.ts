import { Router, type RequestHandler } from "express";
import type { UserController } from "./controller.js";

type PermissionMiddlewareFactory = (permission: string) => RequestHandler;
type AnyPermissionMiddlewareFactory = (permissions: string[]) => RequestHandler;

export type UserRoutesDependencies = {
  controller: UserController;
  requireAuth: RequestHandler;
  requirePermission: PermissionMiddlewareFactory;
  requireAnyPermission: AnyPermissionMiddlewareFactory;
};

export function createUserRoutes({
  controller,
  requireAuth,
  requirePermission,
  requireAnyPermission,
}: UserRoutesDependencies) {
  const router = Router();

  router.use(requireAuth);
  router.get(
    "/users/options",
    requireAnyPermission(["reports.view", "reports.export", "users.manage"]),
    controller.options,
  );
  router.get("/users", requirePermission("users.manage"), controller.list);
  router.post("/users", requirePermission("users.manage"), controller.create);
  router.patch("/users/:id/password", controller.changePassword);
  router.patch("/users/:id", requirePermission("users.manage"), controller.update);
  router.delete("/users/:id", requirePermission("users.manage"), controller.archive);
  router.post("/users/:id/restore", requirePermission("users.manage"), controller.restore);

  return router;
}
