import type { RequestHandler } from "express";
import { describe, expect, it, vi } from "vitest";
import type { UserController } from "../../../src/modules/users/controller.js";
import { createUserRoutes } from "../../../src/modules/users/routes.js";

describe("user routes", () => {
  it("registers the existing permission combinations", () => {
    const middleware = vi.fn() as unknown as RequestHandler;
    const requirePermission = vi.fn().mockReturnValue(middleware);
    const requireAnyPermission = vi.fn().mockReturnValue(middleware);
    const controller = {
      options: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      changePassword: vi.fn(),
      archive: vi.fn(),
      restore: vi.fn(),
    } as unknown as UserController;

    const router = createUserRoutes({
      controller,
      requireAuth: middleware,
      requirePermission,
      requireAnyPermission,
    });

    expect(router).toBeDefined();
    expect(requireAnyPermission).toHaveBeenCalledWith([
      "reports.view",
      "reports.export",
      "users.manage",
    ]);
    expect(requirePermission).toHaveBeenCalledTimes(5);
  });
});
