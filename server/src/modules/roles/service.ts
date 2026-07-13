import type { Request } from "express";
import type { AuditWriter } from "../audit/types.js";
import { mapPermissionRow, mapRoleRows } from "./mapper.js";
import type { RoleRepository } from "./repository.js";
import type { CreateRoleInput, UpdateRoleInput } from "./types.js";

export type RoleServiceDependencies = {
  repository: Pick<
    RoleRepository,
    "listPermissions" | "listRoles" | "permissionIdsExist" | "create" | "update" | "replacePermissions"
  >;
  idGenerator: () => string;
  writeAuditLog: AuditWriter;
};

export class RoleService {
  constructor(private readonly dependencies: RoleServiceDependencies) {}

  async listPermissions() {
    return (await this.dependencies.repository.listPermissions()).map(mapPermissionRow);
  }

  async listRoles() {
    return mapRoleRows(await this.dependencies.repository.listRoles());
  }

  async create(req: Request, input: CreateRoleInput) {
    await this.assertPermissionIdsExist(input.permissionIds);

    const roleId = this.dependencies.idGenerator();
    await this.dependencies.repository.create(roleId, input);
    await this.dependencies.writeAuditLog({
      req,
      action: "role.create",
      entityType: "role",
      entityId: roleId,
      metadata: { name: input.name, permissions: input.permissionIds },
    });

    return roleId;
  }

  async update(req: Request, input: UpdateRoleInput) {
    const affectedRows = await this.dependencies.repository.update(input);

    if (affectedRows === 0) {
      return false;
    }

    await this.dependencies.writeAuditLog({
      req,
      action: "role.update",
      entityType: "role",
      entityId: input.roleId,
      metadata: { name: input.name, isActive: input.isActive },
    });

    return true;
  }

  async replacePermissions(req: Request, roleId: string, permissionIds: string[]) {
    await this.assertPermissionIdsExist(permissionIds);
    await this.dependencies.repository.replacePermissions(roleId, permissionIds);
    await this.dependencies.writeAuditLog({
      req,
      action: "role.permissions.update",
      entityType: "role",
      entityId: roleId,
      metadata: { permissions: permissionIds },
    });
  }

  private async assertPermissionIdsExist(permissionIds: string[]) {
    if (!(await this.dependencies.repository.permissionIdsExist(permissionIds))) {
      throw new Error("Geçersiz izin seçimi var.");
    }
  }
}
