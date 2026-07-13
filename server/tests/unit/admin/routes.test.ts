import type { RequestHandler } from "express";
import { describe, expect, it, vi } from "vitest";
import type { AdminController } from "../../../src/modules/admin/controller.js";
import { createAdminRoutes } from "../../../src/modules/admin/routes.js";

describe("admin routes", () => {
  it("registers dashboard with auth and the existing OR permissions", () => {
    const middleware = vi.fn() as unknown as RequestHandler;
    const requireAnyPermission = vi.fn().mockReturnValue(middleware);
    const controller = { dashboard: vi.fn() } as unknown as AdminController;

    const router = createAdminRoutes({ controller, requireAuth: middleware, requireAnyPermission });

    expect(router).toBeDefined();
    expect(requireAnyPermission).toHaveBeenCalledWith([
      "calls.view.all",
      "users.manage",
      "logs.view",
    ]);
  });
});
