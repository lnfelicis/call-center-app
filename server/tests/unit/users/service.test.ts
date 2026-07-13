import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRepository } from "../../../src/modules/users/repository.js";
import { UserService, type UserServiceDependencies } from "../../../src/modules/users/service.js";

const request = {} as Request;
const createInput = {
  username: "omer",
  fullName: "Ömer Test",
  email: "omer@example.test",
  password: "ValidPass1!",
  roleId: "role-1",
};

function createRepositoryFake() {
  return {
    listActive: vi.fn().mockResolvedValue([]),
    listAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(1),
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
    };
    vi.mocked(repository.listActive).mockResolvedValue([row] as never);
    vi.mocked(repository.listAll).mockResolvedValue([row] as never);
    const service = new UserService(dependencies);

    await expect(service.listActive()).resolves.toStrictEqual([
      expect.objectContaining({ id: "user-1", fullName: "Ömer Test" }),
    ]);
    await expect(service.listAll()).resolves.toStrictEqual([
      expect.objectContaining({ id: "user-1", roleName: "Yönetici" }),
    ]);
  });

  it("hashes and inserts before writing the create audit", async () => {
    const events: string[] = [];
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

    expect(events).toStrictEqual(["hash", "insert", "audit"]);
    expect(repository.create).toHaveBeenCalledWith("user-1", createInput, "password-hash");
    expect(dependencies.writeAuditLog).toHaveBeenCalledWith({
      req: request,
      action: "user.create",
      entityType: "user",
      entityId: "user-1",
      metadata: { username: "omer", email: "omer@example.test", roleId: "role-1" },
    });
  });

  it("propagates audit failure after the user insert", async () => {
    vi.mocked(dependencies.writeAuditLog).mockRejectedValue(new Error("audit failed"));

    await expect(new UserService(dependencies).create(request, createInput)).rejects.toThrow(
      "audit failed",
    );
    expect(repository.create).toHaveBeenCalledOnce();
  });

  it("does not audit an update when no user row is affected", async () => {
    vi.mocked(repository.update).mockResolvedValue(0);

    await expect(
      new UserService(dependencies).update(request, {
        userId: "missing",
        fullName: "Ömer Test",
        email: "omer@example.test",
        roleId: "role-1",
        status: "active",
      }),
    ).resolves.toBe(false);
    expect(dependencies.writeAuditLog).not.toHaveBeenCalled();
  });

  it("audits an affected update and returns true", async () => {
    const input = {
      userId: "user-1",
      fullName: "Ömer Test",
      email: "omer@example.test",
      roleId: "role-1",
      status: "passive" as const,
    };

    await expect(new UserService(dependencies).update(request, input)).resolves.toBe(true);
    expect(dependencies.writeAuditLog).toHaveBeenCalledWith({
      req: request,
      action: "user.update",
      entityType: "user",
      entityId: "user-1",
      metadata: { email: "omer@example.test", roleId: "role-1", status: "passive" },
    });
  });
});
