import { Router, type RequestHandler } from "express";
import type { ReportController } from "./controller.js";

export type ReportRouteDependencies = {
  controller: ReportController;
  requireAuth: RequestHandler;
  requirePermission: (permission: string) => RequestHandler;
  requireAnyPermission: (permissions: string[]) => RequestHandler;
};

export function createReportRoutes({
  controller,
  requireAuth,
  requirePermission,
  requireAnyPermission,
}: ReportRouteDependencies) {
  const router = Router();

  router.use(requireAuth);
  router.get(
    "/reports/filters",
    requireAnyPermission(["reports.view", "reports.export"]),
    controller.getFilters,
  );
  router.get(
    "/calls/search",
    requireAnyPermission(["calls.view.own", "calls.view.all"]),
    controller.searchCalls,
  );
  router.get(
    "/reports/summary",
    requirePermission("reports.view"),
    controller.getSummary,
  );
  router.get(
    "/reports/staff",
    requirePermission("reports.view"),
    controller.getStaff,
  );
  router.get(
    "/reports/categories",
    requirePermission("reports.view"),
    controller.getCategories,
  );
  router.get(
    "/reports/export",
    requirePermission("reports.export"),
    controller.exportReport,
  );

  return router;
}
