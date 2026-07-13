import express, { type NextFunction, type Response } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedRequest } from "../../../src/auth.js";
import {
  createCallRoutes,
  type CallRoutesDependencies,
} from "../../../src/modules/calls/call.routes.js";
import type { CallRepository } from "../../../src/modules/calls/call.repository.js";
import type {
  CallDatabase,
  CallOptionRow,
} from "../../../src/modules/calls/call.types.js";
import { createField } from "./call-fixtures.js";

describe("call routes factory", () => {
  it("runs injected auth and permission middleware before injected data access", async () => {
    const order: string[] = [];
    const option = {
      id: "option-1",
      option_type: "priority",
      label: "Normal",
      value: "normal",
      color: "#ffffff",
      is_active: 1,
      sort_order: 1,
    } as CallOptionRow;
    const query = vi.fn(async () => {
      order.push("query");
      return [[option], []];
    });
    const repository = {
      database: {
        query,
        getConnection: vi.fn(),
      } as unknown as CallDatabase,
      getFieldSettings: vi.fn(async () => {
        order.push("fields");
        return [createField("phoneNumber")];
      }),
      getCallById: vi.fn(),
      getActiveOptionValues: vi.fn(),
      writeCallEvent: vi.fn(),
    } as unknown as CallRepository;
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
          permissions: ["calls.create"],
        };
      }
      next();
    };
    const dependencies = {
      repository,
      auditWriter: vi.fn(),
      notificationPublisher: vi.fn(),
      notificationSettingsReader: vi.fn(),
      clientIpReader: vi.fn(),
      idGenerator: () => "id-1",
      clock: () => new Date(0),
      requireAuth: middleware("auth"),
      requireAnyPermission: vi.fn(() => middleware("any-permission")),
      requirePermission: vi.fn(() => middleware("permission")),
    } as unknown as CallRoutesDependencies;
    const app = express();
    app.use(createCallRoutes(dependencies));

    const response = await request(app).get("/call-options");

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      options: [{
        id: "option-1",
        type: "priority",
        label: "Normal",
        value: "normal",
        color: "#ffffff",
        isActive: true,
        sortOrder: 1,
      }],
      fields: [{
        key: "phoneNumber",
        label: "phoneNumber",
        isActive: true,
        isRequired: false,
        isVisible: true,
        isEditable: true,
        isMasked: false,
        sortOrder: 0,
      }],
    });
    expect(Object.keys(response.body)).toStrictEqual(["options", "fields"]);
    expect(order).toStrictEqual(["auth", "any-permission", "query", "fields"]);
  });
});
