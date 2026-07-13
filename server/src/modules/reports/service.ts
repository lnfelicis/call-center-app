import { createExportSummary } from "./exporters/export-schema.js";
import {
  createReportOptionLabelMap,
  mapCategories,
  mapFilterOptions,
  mapStaff,
  mapSummary,
  serializeSearchRow,
} from "./mapper.js";
import { buildSearchQuery, normalizeText } from "./policy.js";
import type { ReportRepository } from "./repository.js";
import type {
  AuditWriter,
  Clock,
  ReportExporter,
  ReportRequestContext,
} from "./types.js";

export type ReportService = ReturnType<typeof createReportService>;

export type ReportServiceDependencies = {
  repository: ReportRepository;
  auditWriter: AuditWriter;
  clock: Clock;
  excelExporter: ReportExporter;
  pdfExporter: ReportExporter;
};

export function createReportService({
  repository,
  auditWriter,
  clock,
  excelExporter,
  pdfExporter,
}: ReportServiceDependencies) {
  return {
    async getFilters() {
      return mapFilterOptions(await repository.findFilterOptions());
    },

    async searchCalls(context: ReportRequestContext) {
      const rows = await repository.searchCalls(
        buildSearchQuery(context.query, context.user),
        200,
      );

      return {
        calls: rows.map((row) => serializeSearchRow(context.user, row)),
      };
    },

    async getSummary() {
      const [summaryRows, statusRows, priorityRows] = await Promise.all([
        repository.findSummary(),
        repository.findStatusBreakdown(),
        repository.findPriorityBreakdown(),
      ]);

      return mapSummary(summaryRows, statusRows, priorityRows);
    },

    async getStaff() {
      return mapStaff(await repository.findStaff());
    },

    async getCategories() {
      return mapCategories(await repository.findCategories());
    },

    async exportReport(context: ReportRequestContext) {
      const format = normalizeText(context.query.format) === "pdf" ? "pdf" : "excel";
      const searchRows = await repository.searchCalls(
        buildSearchQuery(context.query, context.user),
        1000,
      );
      const rows = searchRows.map((row) => serializeSearchRow(context.user, row));
      const labels = createReportOptionLabelMap(await repository.findReportOptionLabels());
      const createdAt = clock();
      const summary = createExportSummary(context.query, rows.length, createdAt, labels);
      const fileName = `cagri-raporu-${createdAt.toISOString().slice(0, 10)}.${format === "pdf" ? "pdf" : "xlsx"}`;
      const content = format === "pdf"
        ? await pdfExporter(rows, summary, labels)
        : await excelExporter(rows, summary, labels);

      await auditWriter({
        req: context.request,
        action: "reports.export",
        entityType: "report",
        metadata: { format, rowCount: rows.length },
      });

      return {
        fileName,
        mimeType: format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        content: content.toString("base64"),
      };
    },
  };
}
