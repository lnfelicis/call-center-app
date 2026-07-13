import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReportRepository } from "../../../src/modules/reports/repository.js";
import { createReportService } from "../../../src/modules/reports/service.js";
import type {
  AuditWriter,
  ReportExporter,
  ReportFilterOptionRow,
} from "../../../src/modules/reports/types.js";
import {
  createCallSearchRow,
  createReportUser,
} from "./report-fixtures.js";

function createRepositoryFake() {
  return {
    findFilterOptions: vi.fn().mockResolvedValue([]),
    searchCalls: vi.fn().mockResolvedValue([]),
    findSummary: vi.fn().mockResolvedValue([]),
    findStatusBreakdown: vi.fn().mockResolvedValue([]),
    findPriorityBreakdown: vi.fn().mockResolvedValue([]),
    findStaff: vi.fn().mockResolvedValue([]),
    findCategories: vi.fn().mockResolvedValue([]),
    findReportOptionLabels: vi.fn().mockResolvedValue([]),
  } as unknown as ReportRepository;
}

describe("report service", () => {
  const createdAt = new Date("2026-07-13T10:20:30.000Z");
  let repository: ReportRepository;
  let auditWriter: ReturnType<typeof vi.fn<AuditWriter>>;
  let excelExporter: ReturnType<typeof vi.fn<ReportExporter>>;
  let pdfExporter: ReturnType<typeof vi.fn<ReportExporter>>;

  beforeEach(() => {
    repository = createRepositoryFake();
    auditWriter = vi.fn<AuditWriter>().mockResolvedValue(undefined);
    excelExporter = vi.fn<ReportExporter>().mockResolvedValue(Buffer.from("excel-content"));
    pdfExporter = vi.fn<ReportExporter>().mockResolvedValue(Buffer.from("pdf-content"));
  });

  function createService() {
    return createReportService({
      repository,
      auditWriter,
      clock: () => createdAt,
      excelExporter,
      pdfExporter,
    });
  }

  it("uses the scoped search query and the fixed 200 result limit", async () => {
    vi.mocked(repository.searchCalls).mockResolvedValue([createCallSearchRow()]);
    const request = {} as Request;

    const result = await createService().searchCalls({
      request,
      query: { status: "open" },
      user: createReportUser(["calls.view.own"]),
    });

    expect(repository.searchCalls).toHaveBeenCalledWith({
      params: ["user-1", "user-1", "open"],
      whereClause: "WHERE (call_records.opened_by_user_id = ? OR call_records.assigned_to_user_id = ?) AND call_records.status = ?",
    }, 200);
    expect(result.calls).toHaveLength(1);
    expect(result.calls[0]?.phoneNumber).toBe("0555 *** ** 67");
  });

  it("keeps summary, staff and category reports global", async () => {
    const service = createService();

    await service.getSummary();
    await service.getStaff();
    await service.getCategories();

    expect(repository.findSummary).toHaveBeenCalledWith();
    expect(repository.findStatusBreakdown).toHaveBeenCalledWith();
    expect(repository.findPriorityBreakdown).toHaveBeenCalledWith();
    expect(repository.findStaff).toHaveBeenCalledWith();
    expect(repository.findCategories).toHaveBeenCalledWith();
    expect(repository.searchCalls).not.toHaveBeenCalled();
  });

  it("exports PDF after scoped search and labels, then writes audit before returning", async () => {
    const events: string[] = [];
    vi.mocked(repository.searchCalls).mockImplementation(async () => {
      events.push("search");
      return [createCallSearchRow()];
    });
    vi.mocked(repository.findReportOptionLabels).mockImplementation(async () => {
      events.push("labels");
      return [
        {
          id: "status-1",
          option_type: "status",
          label: "Açık",
          value: "open",
          color: null,
          sort_order: 1,
        },
      ] as ReportFilterOptionRow[];
    });
    pdfExporter.mockImplementation(async () => {
      events.push("export");
      return Buffer.from("pdf-content");
    });
    auditWriter.mockImplementation(async () => {
      events.push("audit");
    });
    const request = {} as Request;

    const result = await createService().exportReport({
      request,
      query: { format: " pdf ", status: "open" },
      user: createReportUser(["calls.view.all"]),
    });

    expect(events).toStrictEqual(["search", "labels", "export", "audit"]);
    expect(repository.searchCalls).toHaveBeenCalledWith({
      params: ["open"],
      whereClause: "WHERE call_records.status = ?",
    }, 1000);
    expect(pdfExporter).toHaveBeenCalledOnce();
    expect(excelExporter).not.toHaveBeenCalled();
    expect(auditWriter).toHaveBeenCalledWith({
      req: request,
      action: "reports.export",
      entityType: "report",
      metadata: { format: "pdf", rowCount: 1 },
    });
    expect(result).toStrictEqual({
      fileName: "cagri-raporu-2026-07-13.pdf",
      mimeType: "application/pdf",
      content: Buffer.from("pdf-content").toString("base64"),
    });
    expect(Object.keys(result)).toStrictEqual(["fileName", "mimeType", "content"]);
  });

  it("falls back to Excel for every non-lowercase-pdf format", async () => {
    const result = await createService().exportReport({
      request: {} as Request,
      query: { format: "PDF" },
      user: createReportUser(["calls.view.all"]),
    });

    expect(excelExporter).toHaveBeenCalledOnce();
    expect(pdfExporter).not.toHaveBeenCalled();
    expect(result).toStrictEqual({
      fileName: "cagri-raporu-2026-07-13.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      content: Buffer.from("excel-content").toString("base64"),
    });
  });

  it("propagates audit failures after export generation", async () => {
    auditWriter.mockRejectedValue(new Error("audit failed"));

    await expect(createService().exportReport({
      request: {} as Request,
      query: {},
      user: createReportUser(["calls.view.all"]),
    })).rejects.toThrow("audit failed");

    expect(excelExporter).toHaveBeenCalledOnce();
    expect(auditWriter).toHaveBeenCalledOnce();
  });
});
