import { requireAnyPermission, requireAuth, requirePermission } from "../auth.js";
import { writeAuditLog } from "../audit.js";
import { db } from "../db.js";
import { createReportRouter } from "../modules/reports/index.js";

export { createReportRouter } from "../modules/reports/index.js";

export const reportRoutes = createReportRouter({
  database: db,
  auditWriter: writeAuditLog,
  requireAuth,
  requirePermission,
  requireAnyPermission,
});
