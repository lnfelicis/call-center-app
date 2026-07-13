import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleRepository } from "../../../src/modules/roles/repository.js";
import { RoleService, type RoleServiceDependencies } from "../../../src/modules/roles/service.js";

const request = {} as Request;

function createRepositoryFake() {
  return {
    listPermissions: vi.fn().mockResolvedValue([]),
    listRoles: vi.fn().mockResolvedValue([]),
    permissionIdsExist: vi.fn().mockResolvedValue(true),
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(1),
    replacePermissions: vi.fn().mockResolvedValue(undefined),
  } as unknown as RoleRepository;
}

describe("role service", () => {
  let repository: RoleRepository;
  let dependencies: RoleServiceDependencies;

  beforeEach(() => {
    repository = createRepositoryFake();
    dependencies = {
      repository,
      idGenerator: vi.fn().mockReturnValue("role-1"),
      writeAuditLog: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("maps permission and role lists", async () => {
    vi.mocked(repository.listPermissions).mockResolvedValue([{
      id: "users.manage",
      group_name: "Kullanıcılar",
      label: "Yönetim",
      description: null,
    }] as never);
    vi.mocked(repository.listRoles).mockResolvedValue([{
      id: "role-1",
      name: "Yönetici",
      description: null,
      is_system: 1,
      is_active: 1,
      created_at: "2026-07-13 10:00:00",
      permission_id: "users.manage",
    }] as never);
    const service = new RoleService(dependencies);

    await expect(service.listPermissions()).resolves.toStrictEqual([{
      id: "users.manage",
      groupName: "Kullanıcılar",
      label: "Yönetim",
      description: null,
    }]);
    await expect(service.listRoles()).resolves.toStrictEqual([
      expect.objectContaining({ id: "role-1", permissions: ["users.manage"] }),
    ]);
  });

  it("throws the existing error before generating an id for invalid permissions", async () => {
    vi.mocked(repository.permissionIdsExist).mockResolvedValue(false);

    await expect(new RoleService(dependencies).create(request, {
      name: "Yönetici",
      description: null,
      permissionIds: ["invalid"],
    })).rejects.toThrow("Geçersiz izin seçimi var.");
    expect(dependencies.idGenerator).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("creates before audit and returns the generated id", async () => {
    const input = { name: "Yönetici", description: null, permissionIds: ["users.manage"] };
    await expect(new RoleService(dependencies).create(request, input)).resolves.toBe("role-1");
    expect(repository.create).toHaveBeenCalledWith("role-1", input);
    expect(dependencies.writeAuditLog).toHaveBeenCalledWith({
      req: request,
      action: "role.create",
      entityType: "role",
      entityId: "role-1",
      metadata: { name: "Yönetici", permissions: ["users.manage"] },
    });
  });

  it("returns false and skips audit when update affects no role", async () => {
    vi.mocked(repository.update).mockResolvedValue(0);
    const input = { roleId: "missing", name: "Rol", description: null, isActive: false };
    await expect(new RoleService(dependencies).update(request, input)).resolves.toBe(false);
    expect(dependencies.writeAuditLog).not.toHaveBeenCalled();
  });

  it("audits an affected role update", async () => {
    const input = { roleId: "role-1", name: "Rol", description: null, isActive: false };
    await expect(new RoleService(dependencies).update(request, input)).resolves.toBe(true);
    expect(dependencies.writeAuditLog).toHaveBeenCalledWith({
      req: request,
      action: "role.update",
      entityType: "role",
      entityId: "role-1",
      metadata: { name: "Rol", isActive: false },
    });
  });

  it("validates then replaces permissions before audit", async () => {
    await new RoleService(dependencies).replacePermissions(request, "role-1", ["logs.view"]);
    expect(repository.permissionIdsExist).toHaveBeenCalledWith(["logs.view"]);
    expect(repository.replacePermissions).toHaveBeenCalledWith("role-1", ["logs.view"]);
    expect(dependencies.writeAuditLog).toHaveBeenCalledWith({
      req: request,
      action: "role.permissions.update",
      entityType: "role",
      entityId: "role-1",
      metadata: { permissions: ["logs.view"] },
    });
  });
});
