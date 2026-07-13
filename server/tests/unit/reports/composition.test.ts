import type { RequestHandler } from "express";
import { describe, expect, it, vi } from "vitest";
import { createReportRouter } from "../../../src/modules/reports/index.js";
import type {
  ReportDatabase,
  ReportExporter,
} from "../../../src/modules/reports/types.js";

describe("report module composition", () => {
  it("accepts explicit clock and exporters while preserving all route guards", () => {
    const middleware = vi.fn() as unknown as RequestHandler;
    const requirePermission = vi.fn().mockReturnValue(middleware);
    const requireAnyPermission = vi.fn().mockReturnValue(middleware);
    const clock = vi.fn(() => new Date("2026-07-13T10:00:00.000Z"));
    const excelExporter = vi.fn<ReportExporter>();
    const pdfExporter = vi.fn<ReportExporter>();

    const router = createReportRouter({
      database: { query: vi.fn() } as unknown as ReportDatabase,
      auditWriter: vi.fn(),
      requireAuth: middleware,
      requirePermission,
      requireAnyPermission,
      clock,
      excelExporter,
      pdfExporter,
    });

    expect(router).toBeDefined();
    expect(requireAnyPermission).toHaveBeenNthCalledWith(1, ["reports.view", "reports.export"]);
    expect(requireAnyPermission).toHaveBeenNthCalledWith(2, ["calls.view.own", "calls.view.all"]);
    expect(requirePermission).toHaveBeenNthCalledWith(1, "reports.view");
    expect(requirePermission).toHaveBeenNthCalledWith(2, "reports.view");
    expect(requirePermission).toHaveBeenNthCalledWith(3, "reports.view");
    expect(requirePermission).toHaveBeenNthCalledWith(4, "reports.export");
  });
});
