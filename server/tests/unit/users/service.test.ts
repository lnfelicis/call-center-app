import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SUPER_ADMIN_USER_ID } from "../../../src/database/system-identities.js";
import type { UserRepository } from "../../../src/modules/users/repository.js";
import { UserService, type UserServiceDependencies } from "../../../src/modules/users/service.js";

const request = {} as Request;
const createInput = {
  username: "omer",
  fullName: "Ömer Test",
  email: "omer@example.test",
  password: "ValidPass1!",
  roleId: "role-1",
  permissionOverrides: [{ permissionId: "logs.view", effect: "deny" as const }],
};

function createRepositoryFake() {
  return {
    listActive: vi.fn().mockResolvedValue([]),
    listAll: vi.fn().mockResolvedValue([]),
    permissionIdsExist: vi.fn().mockResolvedValue(true),
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue({ affectedRows: 1, roleChanged: false }),
  } as unknown as UserRepository;
}

describe("user service", () => {
  let repository: UserRepository;
  let dependencies: UserServiceDependencies;

  beforeEach(() => {
    repository = createRepositoryFake();
    dependencies = {
      repository,
      idGenerator: vi.fn().mockReturnValue("user-1"),
      hashPassword: vi.fn().mockResolvedValue("password-hash"),
      writeAuditLog: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("maps active and full user lists", async () => {
    const row = {
      id: "user-1",
      username: "omer",
      full_name: "Ömer Test",
      email: "omer@example.test",
      status: "active",
      role_id: "role-1",
      role_name: "Yönetici",
      created_at: "2026-07-13 10:00:00",
      last_login_at: null,
      permission_overrides: [],
      permissions: ["logs.view"],
    };
    vi.mocked(repository.listActive).mockResolvedValue([row] as never);
    vi.mocked(repository.listAll).mockResolvedValue([row] as never);
    const service = new UserService(dependencies);

    await expect(service.listActive()).resolves.toStrictEqual([
      expect.objectContaining({ id: "user-1", permissions: ["logs.view"] }),
    ]);
    await expect(service.listAll()).resolves.toStrictEqual([
      expect.objectContaining({ id: "user-1", roleName: "Yönetici" }),
    ]);
  });

  it("validates, hashes and inserts before writing create and override audits", async () => {
    const events: string[] = [];
    vi.mocked(repository.permissionIdsExist).mockImplementation(async () => {
      events.push("validate");
      return true;
    });
    vi.mocked(dependencies.hashPassword).mockImplementation(async () => {
      events.push("hash");
      return "password-hash";
    });
    vi.mocked(repository.create).mockImplementation(async () => {
      events.push("insert");
    });
    vi.mocked(dependencies.writeAuditLog).mockImplementation(async () => {
      events.push("audit");
    });

    await expect(new UserService(dependencies).create(request, createInput)).resolves.toBe("user-1");

    expect(events).toStrictEqual(["validate", "hash", "insert", "audit", "audit"]);
    expect(repository.create).toHaveBeenCalledWith("user-1", createInput, "password-hash");
    expect(dependencies.writeAuditLog).toHaveBeenLastCalledWith({
      req: request,
      action: "user.permission_overrides.update",
      entityType: "user",
      entityId: "user-1",
      metadata: {
        roleId: "role-1",
        grantedPermissions: [],
        deniedPermissions: ["logs.view"],
      },
    });
  });

  it("rejects unknown permission ids before hashing or writing", async () => {
    vi.mocked(repository.permissionIdsExist).mockResolvedValue(false);

    await expect(new UserService(dependencies).create(request, createInput)).rejects.toMatchObject({
      status: 400,
    });
    expect(dependencies.hashPassword).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("does not audit an update when no user row is affected", async () => {
    vi.mocked(repository.update).mockResolvedValue({ affectedRows: 0, roleChanged: false });

    await expect(new UserService(dependencies).update(request, {
      userId: "missing",
      fullName: "Ömer Test",
      email: "omer@example.test",
      roleId: "role-1",
      status: "active",
    })).resolves.toBe(false);
    expect(dependencies.writeAuditLog).not.toHaveBeenCalled();
  });

  it("audits replacement overrides after an affected update", async () => {
    const input = {
      userId: "user-1",
      fullName: "Ömer Test",
      email: "omer@example.test",
      roleId: "role-1",
      status: "active" as const,
      permissionOverrides: [{ permissionId: "reports.view", effect: "allow" as const }],
    };

    await expect(new UserService(dependencies).update(request, input)).resolves.toBe(true);
    expect(dependencies.writeAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({
      action: "user.permission_overrides.update",
      metadata: {
        roleId: "role-1",
        grantedPermissions: ["reports.view"],
        deniedPermissions: [],
      },
    }));
  });

  it("protects the seeded super admin from non-empty overrides", async () => {
    await expect(new UserService(dependencies).update(request, {
      userId: SUPER_ADMIN_USER_ID,
      fullName: "Süper Admin",
      email: "admin@example.test",
      roleId: "role-1",
      status: "active",
      permissionOverrides: [{ permissionId: "logs.view", effect: "deny" }],
    })).rejects.toMatchObject({ status: 400 });
    expect(repository.update).not.toHaveBeenCalled();
  });
});
