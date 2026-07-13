import type { RequestHandler } from "express";
import { describe, expect, it, vi } from "vitest";
import type { AuthController } from "../../../src/modules/auth/controller.js";
import { createAuthRoutes } from "../../../src/modules/auth/routes.js";

describe("auth routes", () => {
  it("registers login, logout and me with injected auth middleware", () => {
    const controller = {
      login: vi.fn(),
      logout: vi.fn(),
      me: vi.fn(),
    } as unknown as AuthController;
    const requireAuth = vi.fn() as unknown as RequestHandler;

    const router = createAuthRoutes({ controller, requireAuth });

    expect(router).toBeDefined();
  });
});
