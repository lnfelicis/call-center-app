import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { AdminController } from "../../../src/modules/admin/controller.js";
import { AdminRepository, type AdminDatabase } from "../../../src/modules/admin/repository.js";
import { AdminService } from "../../../src/modules/admin/service.js";

describe("admin layers", () => {
  it("runs all eight dashboard queries and returns their row groups", async () => {
    const responses = [
      [{ total: 10 }],
      [{ total: 4 }],
      [{ total: 2 }],
      [{ total: 6 }],
      [{ total: 3 }],
      [{ status: "open", total: 6 }],
      [{ id: "call-1" }],
      [{ id: "log-1" }],
    ];
    const database = {
      query: vi.fn().mockImplementation(async () => [responses.shift(), []]),
    } as unknown as AdminDatabase;

    const result = await new AdminRepository(database).getDashboardRows();

    expect(database.query).toHaveBeenCalledTimes(8);
    expect(result.callCounts).toStrictEqual([{ total: 10 }]);
    expect(result.recentLogs).toStrictEqual([{ id: "log-1" }]);
    expect(database.query).toHaveBeenNthCalledWith(
      8,
      expect.stringContaining("ORDER BY audit_logs.created_at DESC\n        LIMIT 8"),
    );
  });

  it("maps repository rows through the service", async () => {
    const repository = {
      getDashboardRows: vi.fn().mockResolvedValue({
        callCounts: [{ total: 1 }],
        userCounts: [{ total: 2 }],
        roleCounts: [{ total: 3 }],
        openCounts: [{ total: 4 }],
        followUpCounts: [{ total: 5 }],
        statusRows: [],
        recentCalls: [],
        recentLogs: [],
      }),
    } as unknown as AdminRepository;

    await expect(new AdminService(repository).getDashboard()).resolves.toStrictEqual({
      metrics: {
        totalCalls: 1,
        openCalls: 4,
        followUpCalls: 5,
        totalUsers: 2,
        activeRoles: 3,
      },
      callsByStatus: [],
      recentCalls: [],
      recentLogs: [],
    });
  });

  it("returns the service dashboard directly from the controller", async () => {
    const dashboard = { metrics: { totalCalls: 1 } };
    const service = { getDashboard: vi.fn().mockResolvedValue(dashboard) } as unknown as AdminService;
    const response = { json: vi.fn() } as unknown as Response;

    await new AdminController(service).dashboard({} as Request, response);

    expect(response.json).toHaveBeenCalledWith(dashboard);
  });
});
