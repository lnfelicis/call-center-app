import { Router, type RequestHandler } from "express";
import type { LogController } from "./controller.js";

export type LogRoutesDependencies = {
  controller: LogController;
  requireAuth: RequestHandler;
  requirePermission: (permission: string) => RequestHandler;
};

export function createLogRoutes({
  controller,
  requireAuth,
  requirePermission,
}: LogRoutesDependencies) {
  const router = Router();

  router.use(requireAuth);
  router.get("/logs", requirePermission("logs.view"), controller.list);

  return router;
}
