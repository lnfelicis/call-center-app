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
    getPasswordCredential: vi.fn().mockResolvedValue({ passwordHash: "stored-hash" }),
    updatePassword: vi.fn().mockResolvedValue(1),
    archive: vi.fn().mockResolvedValue(1),
    restore: vi.fn().mockResolvedValue(1),
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
      verifyPassword: vi.fn().mockResolvedValue(false),
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
      archived_at: null,
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

  it("changes the current user's password after verifying the existing password", async () => {
    const passwordRequest = {
      user: { id: "user-1", permissions: [] },
    } as unknown as Request;
    vi.mocked(dependencies.verifyPassword)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await new UserService(dependencies).changePassword(passwordRequest, {
      userId: "user-1",
      currentPassword: "OldPass1!",
      newPassword: "NewValidPass1!",
    });

    expect(dependencies.verifyPassword).toHaveBeenNthCalledWith(1, "OldPass1!", "stored-hash");
    expect(dependencies.verifyPassword).toHaveBeenNthCalledWith(2, "NewValidPass1!", "stored-hash");
    expect(repository.updatePassword).toHaveBeenCalledWith("user-1", "password-hash");
    expect(dependencies.writeAuditLog).toHaveBeenCalledWith({
      req: passwordRequest,
      action: "user.password.change",
      entityType: "user",
      entityId: "user-1",
      metadata: {},
    });
  });

  it("rejects a wrong current password without updating", async () => {
    const passwordRequest = {
      user: { id: "user-1", permissions: [] },
    } as unknown as Request;

    await expect(new UserService(dependencies).changePassword(passwordRequest, {
      userId: "user-1",
      currentPassword: "WrongPass1!",
      newPassword: "NewValidPass1!",
    })).rejects.toMatchObject({
      status: 400,
      body: { message: "Mevcut şifre hatalı.", field: "currentPassword" },
    });
    expect(repository.updatePassword).not.toHaveBeenCalled();
  });

  it("lets users.manage reset another user and writes a reset audit", async () => {
    const passwordRequest = {
      user: { id: "manager-1", permissions: ["users.manage"] },
    } as unknown as Request;

    await new UserService(dependencies).changePassword(passwordRequest, {
      userId: "user-1",
      currentPassword: "",
      newPassword: "NewValidPass1!",
    });

    expect(dependencies.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "user.password.reset",
      entityId: "user-1",
    }));
  });

  it("rejects unauthorized resets, super admin resets and reused passwords", async () => {
    const service = new UserService(dependencies);
    const regularRequest = {
      user: { id: "actor-1", permissions: [] },
    } as unknown as Request;
    const managerRequest = {
      user: { id: "manager-1", permissions: ["users.manage"] },
    } as unknown as Request;

    await expect(service.changePassword(regularRequest, {
      userId: "user-1",
      currentPassword: "",
      newPassword: "NewValidPass1!",
    })).rejects.toMatchObject({ status: 403 });
    await expect(service.changePassword(managerRequest, {
      userId: SUPER_ADMIN_USER_ID,
      currentPassword: "",
      newPassword: "NewValidPass1!",
    })).rejects.toMatchObject({ status: 403 });

    vi.mocked(dependencies.verifyPassword).mockResolvedValue(true);
    await expect(service.changePassword(managerRequest, {
      userId: "user-1",
      currentPassword: "",
      newPassword: "CurrentValid1!",
    })).rejects.toMatchObject({
      status: 400,
      body: { message: "Yeni şifre mevcut şifreyle aynı olamaz.", field: "newPassword" },
    });
    expect(repository.updatePassword).not.toHaveBeenCalled();
  });

  it("archives a user and writes an audit entry", async () => {
    const archiveRequest = { user: { id: "actor-1" } } as Request;

    await expect(new UserService(dependencies).archive(archiveRequest, "user-1")).resolves.toBe(true);
    expect(repository.archive).toHaveBeenCalledWith("user-1");
    expect(dependencies.writeAuditLog).toHaveBeenCalledWith({
      req: archiveRequest,
      action: "user.archive",
      entityType: "user",
      entityId: "user-1",
      metadata: {},
    });
  });

  it("protects the current user and seeded super admin from archiving", async () => {
    const service = new UserService(dependencies);
    const archiveRequest = { user: { id: "user-1" } } as Request;

    await expect(service.archive(archiveRequest, "user-1")).rejects.toMatchObject({ status: 400 });
    await expect(service.archive(archiveRequest, SUPER_ADMIN_USER_ID)).rejects.toMatchObject({ status: 400 });
    expect(repository.archive).not.toHaveBeenCalled();
  });

  it("restores a user and writes an audit entry", async () => {
    await expect(new UserService(dependencies).restore(request, "user-1")).resolves.toBe(true);
    expect(repository.restore).toHaveBeenCalledWith("user-1");
    expect(dependencies.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "user.restore",
      entityId: "user-1",
    }));
  });
});
