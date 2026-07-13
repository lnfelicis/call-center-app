import type { RequestHandler } from "express";
import { describe, expect, it, vi } from "vitest";
import type { LogController } from "../../../src/modules/logs/controller.js";
import { createLogRoutes } from "../../../src/modules/logs/routes.js";

describe("log routes", () => {
  it("registers logs with auth and logs.view", () => {
    const middleware = vi.fn() as unknown as RequestHandler;
    const requirePermission = vi.fn().mockReturnValue(middleware);
    const controller = { list: vi.fn() } as unknown as LogController;

    const router = createLogRoutes({ controller, requireAuth: middleware, requirePermission });

    expect(router).toBeDefined();
    expect(requirePermission).toHaveBeenCalledWith("logs.view");
  });
});
