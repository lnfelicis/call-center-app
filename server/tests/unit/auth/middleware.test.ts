import type { NextFunction, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRequireAuth,
  requireAnyPermission,
  requirePermission,
} from "../../../src/modules/auth/middleware.js";
import type { AuthenticatedRequest, AuthUser } from "../../../src/modules/auth/types.js";

function createResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response as unknown as Response;
}

function createRequest(authorization?: string) {
  return {
    header: vi.fn((name: string) => (name === "authorization" ? authorization : undefined)),
    socket: {},
  } as unknown as AuthenticatedRequest;
}

const authUser: AuthUser = {
  id: "user-1",
  username: "omer",
  fullName: "Ömer Test",
  email: "omer@example.test",
  roleId: "role-1",
  roleName: "Yönetici",
  permissions: ["users.manage", "logs.view"],
};

describe("auth middleware", () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it("requires the exact Bearer prefix", async () => {
    const verifyToken = vi.fn();
    const middleware = createRequireAuth({
      verifyToken,
      readSecuritySettings: vi.fn(),
      isSessionIpAllowed: vi.fn(),
      getUserWithPermissions: vi.fn(),
    });
    const response = createResponse();

    await middleware(createRequest("bearer token"), response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: "Oturum gerekli." });
    expect(verifyToken).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("returns the existing invalid-token response before reading settings", async () => {
    const readSecuritySettings = vi.fn();
    const middleware = createRequireAuth({
      verifyToken: vi.fn().mockReturnValue(null),
      readSecuritySettings,
      isSessionIpAllowed: vi.fn(),
      getUserWithPermissions: vi.fn(),
    });
    const response = createResponse();

    await middleware(createRequest("Bearer invalid"), response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      message: "Oturum geçersiz veya süresi dolmuş.",
    });
    expect(readSecuritySettings).not.toHaveBeenCalled();
  });

  it("keeps the IP rejection code and body", async () => {
    const getUserWithPermissions = vi.fn();
    const middleware = createRequireAuth({
      verifyToken: vi.fn().mockReturnValue({ sub: "user-1", exp: 1, loginIp: "10.0.0.1" }),
      readSecuritySettings: vi.fn().mockResolvedValue({
        failedLoginLimit: 5,
        sessionDurationMinutes: 480,
        ipAllowlist: ["10.0.0.1"],
      }),
      isSessionIpAllowed: vi.fn().mockReturnValue(false),
      getUserWithPermissions,
    });
    const response = createResponse();

    await middleware(createRequest("Bearer token"), response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      code: "IP_NOT_ALLOWED",
      message: "Bu IP adresinden oturuma izin verilmiyor.",
    });
    expect(getUserWithPermissions).not.toHaveBeenCalled();
  });

  it("rejects inactive users after token, settings and IP checks", async () => {
    const middleware = createRequireAuth({
      verifyToken: vi.fn().mockReturnValue({ sub: "user-1", exp: 1 }),
      readSecuritySettings: vi.fn().mockResolvedValue({
        failedLoginLimit: 5,
        sessionDurationMinutes: 480,
        ipAllowlist: [],
      }),
      isSessionIpAllowed: vi.fn().mockReturnValue(true),
      getUserWithPermissions: vi.fn().mockResolvedValue(null),
    });
    const response = createResponse();

    await middleware(createRequest("Bearer token"), response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      message: "Kullanıcı aktif değil veya bulunamadı.",
    });
  });

  it("attaches the current database user and continues", async () => {
    const middleware = createRequireAuth({
      verifyToken: vi.fn().mockReturnValue({ sub: "user-1", exp: 1 }),
      readSecuritySettings: vi.fn().mockResolvedValue({
        failedLoginLimit: 5,
        sessionDurationMinutes: 480,
        ipAllowlist: [],
      }),
      isSessionIpAllowed: vi.fn().mockReturnValue(true),
      getUserWithPermissions: vi.fn().mockResolvedValue(authUser),
    });
    const request = createRequest("Bearer token");
    const response = createResponse();

    await middleware(request, response, next);

    expect(request.user).toBe(authUser);
    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });

  it("keeps exact 403 behavior for single and OR permission middleware", () => {
    const request = { user: authUser } as AuthenticatedRequest;
    const response = createResponse();

    requirePermission("roles.manage")(request, response, next);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ message: "Bu işlem için yetkiniz yok." });

    vi.clearAllMocks();
    requireAnyPermission(["reports.view", "logs.view"])(request, response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });

  it("continues when a single permission exists and rejects a failed OR check", () => {
    const request = { user: authUser } as AuthenticatedRequest;
    const response = createResponse();

    requirePermission("users.manage")(request, response, next);
    expect(next).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    requireAnyPermission(["reports.view", "reports.export"])(request, response, next);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ message: "Bu işlem için yetkiniz yok." });
    expect(next).not.toHaveBeenCalled();
  });
});
