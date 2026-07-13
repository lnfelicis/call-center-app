import type { RequestHandler } from "express";
import { describe, expect, it, vi } from "vitest";
import type { RoleController } from "../../../src/modules/roles/controller.js";
import { createRoleRoutes } from "../../../src/modules/roles/routes.js";

describe("role routes", () => {
  it("registers the existing role and permission guards", () => {
    const middleware = vi.fn() as unknown as RequestHandler;
    const requirePermission = vi.fn().mockReturnValue(middleware);
    const requireAnyPermission = vi.fn().mockReturnValue(middleware);
    const controller = {
      permissions: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      replacePermissions: vi.fn(),
    } as unknown as RoleController;

    const router = createRoleRoutes({
      controller,
      requireAuth: middleware,
      requirePermission,
      requireAnyPermission,
    });

    expect(router).toBeDefined();
    expect(requireAnyPermission).toHaveBeenCalledWith(["roles.manage", "users.manage"]);
    expect(requirePermission).toHaveBeenCalledTimes(4);
  });
});
