import type { RequestHandler } from "express";
import { createReportController } from "./controller.js";
import { createExcel } from "./exporters/excel-exporter.js";
import { createPdf } from "./exporters/pdf-exporter.js";
import { createReportRepository } from "./repository.js";
import { createReportRoutes } from "./routes.js";
import { createReportService } from "./service.js";
import type {
  AuditWriter,
  Clock,
  ReportDatabase,
  ReportExporter,
} from "./types.js";

export type ReportModuleDependencies = {
  database: ReportDatabase;
  auditWriter: AuditWriter;
  requireAuth: RequestHandler;
  requirePermission: (permission: string) => RequestHandler;
  requireAnyPermission: (permissions: string[]) => RequestHandler;
  clock?: Clock;
  excelExporter?: ReportExporter;
  pdfExporter?: ReportExporter;
};

export function createReportRouter({
  database,
  auditWriter,
  requireAuth,
  requirePermission,
  requireAnyPermission,
  clock = () => new Date(),
  excelExporter = createExcel,
  pdfExporter = createPdf,
}: ReportModuleDependencies) {
  const repository = createReportRepository(database);
  const service = createReportService({
    repository,
    auditWriter,
    clock,
    excelExporter,
    pdfExporter,
  });
  const controller = createReportController(service);

  return createReportRoutes({
    controller,
    requireAuth,
    requirePermission,
    requireAnyPermission,
  });
}

export { createReportController } from "./controller.js";
export { createExcel } from "./exporters/excel-exporter.js";
export { createExportSummary, exportColumns, formatDateTime } from "./exporters/export-schema.js";
export { createPdf } from "./exporters/pdf-exporter.js";
export { createReportRepository } from "./repository.js";
export { createReportRoutes } from "./routes.js";
export { createReportService } from "./service.js";
