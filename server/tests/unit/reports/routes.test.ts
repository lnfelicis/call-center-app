import express, { type NextFunction, type Response } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedRequest } from "../../../src/modules/auth/types.js";
import { createReportRouter } from "../../../src/modules/reports/index.js";
import type {
  ReportDatabase,
  ReportFilterOptionRow,
} from "../../../src/modules/reports/types.js";

describe("report router factory", () => {
  it("runs injected auth and any-permission middleware before report data access", async () => {
    const order: string[] = [];
    const option = {
      id: "option-1",
      option_type: "status",
      label: "Açık",
      value: "open",
      color: "#16a34a",
      sort_order: 1,
    } as ReportFilterOptionRow;
    const query = vi.fn(async () => {
      order.push("query");
      return [[option], []];
    });
    const middleware = (label: string) => (
      req: AuthenticatedRequest,
      _res: Response,
      next: NextFunction,
    ) => {
      order.push(label);
      if (label === "auth") {
        req.user = {
          id: "user-1",
          username: "agent",
          fullName: "Agent One",
          email: "agent@example.com",
          roleId: "role-1",
          roleName: "Agent",
          permissions: ["reports.view"],
        };
      }
      next();
    };
    const requireAnyPermission = vi.fn(() => middleware("any-permission"));
    const app = express();
    app.use(createReportRouter({
      database: { query } as unknown as ReportDatabase,
      auditWriter: vi.fn(),
      requireAuth: middleware("auth"),
      requirePermission: vi.fn(() => middleware("permission")),
      requireAnyPermission,
    }));

    const response = await request(app).get("/reports/filters");

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      options: [{
        id: "option-1",
        type: "status",
        label: "Açık",
        value: "open",
        color: "#16a34a",
        isActive: true,
        sortOrder: 1,
      }],
    });
    expect(Object.keys(response.body)).toStrictEqual(["options"]);
    expect(requireAnyPermission).toHaveBeenCalledWith(["reports.view", "reports.export"]);
    expect(order).toStrictEqual(["auth", "any-permission", "query"]);
  });
});
