import type { Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedRequest } from "../../../src/auth.js";
import { createReportController } from "../../../src/modules/reports/controller.js";
import type { ReportService } from "../../../src/modules/reports/service.js";

function createResponse() {
  return { json: vi.fn() } as unknown as Response;
}

function createService() {
  return {
    getFilters: vi.fn().mockResolvedValue({ options: [] }),
    searchCalls: vi.fn().mockResolvedValue({ calls: [] }),
    getSummary: vi.fn().mockResolvedValue({ total: 1 }),
    getStaff: vi.fn().mockResolvedValue({ staff: [] }),
    getCategories: vi.fn().mockResolvedValue({ categories: [] }),
    exportReport: vi.fn().mockResolvedValue({ fileName: "report.xlsx" }),
  } as unknown as ReportService;
}

describe("report controller", () => {
  let service: ReportService;

  beforeEach(() => {
    service = createService();
  });

  it("returns filter, summary, staff and category service results directly", async () => {
    const controller = createReportController(service);
    const request = {} as AuthenticatedRequest;
    const filters = createResponse();
    const summary = createResponse();
    const staff = createResponse();
    const categories = createResponse();

    await controller.getFilters(request, filters);
    await controller.getSummary(request, summary);
    await controller.getStaff(request, staff);
    await controller.getCategories(request, categories);

    expect(filters.json).toHaveBeenCalledWith({ options: [] });
    expect(summary.json).toHaveBeenCalledWith({ total: 1 });
    expect(staff.json).toHaveBeenCalledWith({ staff: [] });
    expect(categories.json).toHaveBeenCalledWith({ categories: [] });
  });

  it("passes exact request context to search and export", async () => {
    const controller = createReportController(service);
    const user = {
      id: "user-1",
      username: "omer",
      fullName: "Ömer Test",
      email: "omer@example.test",
      roleId: "role-1",
      roleName: "Yönetici",
      permissions: ["reports.view", "reports.export"],
    };
    const query = { status: "open", format: "pdf" };
    const request = { query, user } as unknown as AuthenticatedRequest;
    const search = createResponse();
    const exportResponse = createResponse();

    await controller.searchCalls(request, search);
    await controller.exportReport(request, exportResponse);

    const context = { query, request, user };
    expect(service.searchCalls).toHaveBeenCalledWith(context);
    expect(service.exportReport).toHaveBeenCalledWith(context);
    expect(search.json).toHaveBeenCalledWith({ calls: [] });
    expect(exportResponse.json).toHaveBeenCalledWith({ fileName: "report.xlsx" });
  });
});
