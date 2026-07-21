import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthRepository } from "../../../src/modules/auth/repository.js";
import { AuthService, type AuthServiceDependencies } from "../../../src/modules/auth/service.js";
import type { AuthSessionUser } from "../../../src/modules/auth/types.js";

const request = {} as Request;
const authUser: AuthSessionUser = {
  id: "user-1",
  username: "omer",
  fullName: "Ömer Test",
  email: "omer@example.test",
  roleId: "role-1",
  roleName: "Yönetici",
  permissions: ["users.manage"],
  sessionVersion: 4,
};

function createRepositoryFake() {
  return {
    findLoginUser: vi.fn().mockResolvedValue({
      id: "user-1",
      passwordHash: "stored-hash",
      status: "active",
      failedLoginAttempts: 0,
    }),
    incrementFailedLoginAttempts: vi.fn().mockResolvedValue(undefined),
    recordSuccessfulLogin: vi.fn().mockResolvedValue(undefined),
    getUserWithPermissions: vi.fn().mockResolvedValue(authUser),
  } as unknown as AuthRepository;
}

describe("auth service", () => {
  let repository: AuthRepository;
  let dependencies: AuthServiceDependencies;

  beforeEach(() => {
    repository = createRepositoryFake();
    dependencies = {
      repository,
      readSecuritySettings: vi.fn().mockResolvedValue({
        failedLoginLimit: 5,
        sessionDurationMinutes: 480,
        ipAllowlist: [],
      }),
      getClientIp: vi.fn().mockReturnValue("10.0.0.8"),
      isClientIpAllowed: vi.fn().mockReturnValue(true),
      verifyPassword: vi.fn().mockResolvedValue(true),
      signToken: vi.fn().mockReturnValue("signed-token"),
      writeAuditLog: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("denies an IP before querying the user", async () => {
    vi.mocked(dependencies.isClientIpAllowed).mockReturnValue(false);

    await expect(new AuthService(dependencies).login(request, "omer", "password")).resolves.toStrictEqual({
      type: "ip-not-allowed",
    });

    expect(repository.findLoginUser).not.toHaveBeenCalled();
  });

  it("keeps inactive and missing users indistinguishable", async () => {
    vi.mocked(repository.findLoginUser).mockResolvedValue(null);

    await expect(new AuthService(dependencies).login(request, "omer", "password")).resolves.toStrictEqual({
      type: "invalid-credentials",
    });
    expect(dependencies.verifyPassword).not.toHaveBeenCalled();
  });

  it("audits a blocked login before returning 423 state", async () => {
    vi.mocked(repository.findLoginUser).mockResolvedValue({
      id: "user-1",
      passwordHash: "stored-hash",
      status: "active",
      failedLoginAttempts: 5,
    });

    const result = await new AuthService(dependencies).login(request, "omer", "password");

    expect(result).toStrictEqual({ type: "blocked" });
    expect(dependencies.writeAuditLog).toHaveBeenCalledWith({
      req: request,
      action: "auth.login.blocked",
      entityType: "user",
      entityId: "user-1",
      metadata: { reason: "failed_login_limit" },
    });
    expect(dependencies.verifyPassword).not.toHaveBeenCalled();
  });

  it("increments the counter without auditing a wrong password", async () => {
    vi.mocked(dependencies.verifyPassword).mockResolvedValue(false);

    const result = await new AuthService(dependencies).login(request, "omer", "wrong");

    expect(result).toStrictEqual({ type: "invalid-credentials" });
    expect(repository.incrementFailedLoginAttempts).toHaveBeenCalledWith("user-1");
    expect(dependencies.writeAuditLog).not.toHaveBeenCalled();
  });

  it("keeps successful login orchestration order and token inputs", async () => {
    const events: string[] = [];
    vi.mocked(dependencies.readSecuritySettings).mockImplementation(async () => {
      events.push("settings");
      return { failedLoginLimit: 5, sessionDurationMinutes: 37, ipAllowlist: [] };
    });
    vi.mocked(dependencies.getClientIp).mockImplementation(() => {
      events.push("request-ip");
      return "10.0.0.8";
    });
    vi.mocked(dependencies.isClientIpAllowed).mockImplementation(() => {
      events.push("ip-policy");
      return true;
    });
    vi.mocked(repository.findLoginUser).mockImplementation(async () => {
      events.push("find-login-user");
      return { id: "user-1", passwordHash: "stored-hash", status: "active", failedLoginAttempts: 0 };
    });
    vi.mocked(dependencies.verifyPassword).mockImplementation(async () => {
      events.push("password");
      return true;
    });
    vi.mocked(repository.recordSuccessfulLogin).mockImplementation(async () => {
      events.push("record-login");
    });
    vi.mocked(repository.getUserWithPermissions).mockImplementation(async () => {
      events.push("permissions");
      return authUser;
    });
    vi.mocked(dependencies.writeAuditLog).mockImplementation(async () => {
      events.push("audit");
    });
    vi.mocked(dependencies.signToken).mockImplementation(() => {
      events.push("token");
      return "signed-token";
    });

    const result = await new AuthService(dependencies).login(request, "omer", "password");

    expect(events).toStrictEqual([
      "settings",
      "request-ip",
      "ip-policy",
      "find-login-user",
      "password",
      "record-login",
      "permissions",
      "audit",
      "token",
    ]);
    expect(dependencies.signToken).toHaveBeenCalledWith("user-1", 37, "10.0.0.8", 4);
    expect(result).toStrictEqual({
      type: "success",
      token: "signed-token",
      user: {
        id: "user-1",
        username: "omer",
        fullName: "Ömer Test",
        email: "omer@example.test",
        roleId: "role-1",
        roleName: "Yönetici",
        permissions: ["users.manage"],
      },
    });
  });

  it("does not audit or sign when the role becomes inactive", async () => {
    vi.mocked(repository.getUserWithPermissions).mockResolvedValue(null);

    const result = await new AuthService(dependencies).login(request, "omer", "password");

    expect(result).toStrictEqual({ type: "inactive-role" });
    expect(repository.recordSuccessfulLogin).toHaveBeenCalledWith("user-1");
    expect(dependencies.writeAuditLog).not.toHaveBeenCalled();
    expect(dependencies.signToken).not.toHaveBeenCalled();
  });

  it("writes the logout audit with the optional user id", async () => {
    await new AuthService(dependencies).logout(request, undefined);

    expect(dependencies.writeAuditLog).toHaveBeenCalledWith({
      req: request,
      action: "auth.logout",
      entityType: "user",
      entityId: undefined,
    });
  });
});
