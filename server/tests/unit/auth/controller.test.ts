import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { AuthController } from "../../../src/modules/auth/controller.js";
import type { AuthService, LoginResult } from "../../../src/modules/auth/service.js";
import type { AuthenticatedRequest, AuthUser } from "../../../src/modules/auth/types.js";

function createResponse() {
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  return response as unknown as Response;
}

const user: AuthUser = {
  id: "user-1",
  username: "omer",
  fullName: "Ömer Test",
  email: "omer@example.test",
  roleId: "role-1",
  roleName: "Yönetici",
  permissions: ["users.manage"],
};

function createService(result: LoginResult = { type: "success", token: "token", user }) {
  return {
    login: vi.fn().mockResolvedValue(result),
    logout: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthService;
}

describe("auth controller", () => {
  it("validates coerced login fields before calling the service", async () => {
    const service = createService();
    const response = createResponse();

    await new AuthController(service).login(
      { body: { username: "  ", password: null } } as Request,
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: "Kullanıcı adı ve şifre zorunludur.",
    });
    expect(service.login).not.toHaveBeenCalled();
  });

  it.each<[LoginResult, number, object]>([
    [{ type: "ip-not-allowed" }, 403, { message: "Bu IP adresinden girişe izin verilmiyor." }],
    [{ type: "invalid-credentials" }, 401, { message: "Kullanıcı adı veya şifre hatalı." }],
    [{ type: "blocked" }, 423, {
      message: "Hatalı giriş limiti aşıldı. Yönetici ile iletişime geçin.",
    }],
    [{ type: "inactive-role" }, 401, { message: "Kullanıcı rolü aktif değil." }],
  ])("maps %s to its exact HTTP response", async (result, status, body) => {
    const service = createService(result);
    const response = createResponse();
    const request = { body: { username: " omer ", password: 123 } } as unknown as Request;

    await new AuthController(service).login(request, response);

    expect(service.login).toHaveBeenCalledWith(request, "omer", "123");
    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.json).toHaveBeenCalledWith(body);
  });

  it("keeps the successful login response shape and key order", async () => {
    const service = createService();
    const response = createResponse();

    await new AuthController(service).login(
      { body: { username: "omer", password: "password" } } as Request,
      response,
    );

    const body = vi.mocked(response.json).mock.calls[0]![0];
    expect(body).toStrictEqual({ token: "token", user });
    expect(Object.keys(body)).toStrictEqual(["token", "user"]);
  });

  it("audits logout through the service and returns ok", async () => {
    const service = createService();
    const response = createResponse();
    const request = { user } as AuthenticatedRequest;

    await new AuthController(service).logout(request, response);

    expect(service.logout).toHaveBeenCalledWith(request, "user-1");
    expect(response.json).toHaveBeenCalledWith({ ok: true });
  });

  it("returns the request user from me", () => {
    const response = createResponse();
    new AuthController(createService()).me({ user } as AuthenticatedRequest, response);
    expect(response.json).toHaveBeenCalledWith({ user });
  });
});
