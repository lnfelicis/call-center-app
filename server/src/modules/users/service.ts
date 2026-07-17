import type { Request } from "express";
import { SUPER_ADMIN_USER_ID } from "../../database/system-identities.js";
import { HttpError } from "../../http/errors.js";
import type { AuditWriter } from "../audit/types.js";
import { mapUserRow } from "./mapper.js";
import type { UserRepository } from "./repository.js";
import type {
  CreateUserInput,
  PermissionOverride,
  UpdateUserInput,
  UserListScope,
} from "./types.js";

export type UserServiceDependencies = {
  repository: Pick<
    UserRepository,
    | "listActive"
    | "listAll"
    | "permissionIdsExist"
    | "create"
    | "update"
    | "archive"
    | "restore"
  >;
  idGenerator: () => string;
  hashPassword: (password: string) => Promise<string>;
  writeAuditLog: AuditWriter;
};

export class UserService {
  constructor(private readonly dependencies: UserServiceDependencies) {}

  async listActive() {
    return (await this.dependencies.repository.listActive()).map(mapUserRow);
  }

  async listAll(scope: UserListScope = "current") {
    return (await this.dependencies.repository.listAll(scope)).map(mapUserRow);
  }

  async create(req: Request, input: CreateUserInput) {
    await this.assertPermissionIdsExist(input.permissionOverrides);
    const userId = this.dependencies.idGenerator();
    const passwordHash = await this.dependencies.hashPassword(input.password);

    await this.dependencies.repository.create(userId, input, passwordHash);
    await this.dependencies.writeAuditLog({
      req,
      action: "user.create",
      entityType: "user",
      entityId: userId,
      metadata: {
        username: input.username,
        email: input.email,
        roleId: input.roleId,
        permissionOverrides: input.permissionOverrides,
      },
    });

    if (input.permissionOverrides.length > 0) {
      await this.writePermissionOverrideAudit(req, userId, input.roleId, input.permissionOverrides);
    }

    return userId;
  }

  async update(req: Request, input: UpdateUserInput) {
    if (input.userId === SUPER_ADMIN_USER_ID && (input.permissionOverrides?.length ?? 0) > 0) {
      throw new HttpError(400, {
        message: "Ana Süper Admin hesabının izinleri özelleştirilemez.",
      });
    }

    if (input.permissionOverrides !== undefined) {
      await this.assertPermissionIdsExist(input.permissionOverrides);
    }

    const result = await this.dependencies.repository.update(input);

    if (result.affectedRows === 0) {
      return false;
    }

    await this.dependencies.writeAuditLog({
      req,
      action: "user.update",
      entityType: "user",
      entityId: input.userId,
      metadata: { email: input.email, roleId: input.roleId, status: input.status },
    });

    if (input.permissionOverrides !== undefined || result.roleChanged) {
      await this.writePermissionOverrideAudit(
        req,
        input.userId,
        input.roleId,
        input.permissionOverrides ?? [],
      );
    }

    return true;
  }

  async archive(req: Request, userId: string) {
    if (userId === SUPER_ADMIN_USER_ID) {
      throw new HttpError(400, { message: "Ana Süper Admin hesabı silinemez." });
    }

    if (userId === req.user?.id) {
      throw new HttpError(400, { message: "Oturum açtığınız hesabı silemezsiniz." });
    }

    const affectedRows = await this.dependencies.repository.archive(userId);
    if (affectedRows === 0) {
      return false;
    }

    await this.dependencies.writeAuditLog({
      req,
      action: "user.archive",
      entityType: "user",
      entityId: userId,
      metadata: {},
    });
    return true;
  }

  async restore(req: Request, userId: string) {
    const affectedRows = await this.dependencies.repository.restore(userId);
    if (affectedRows === 0) {
      return false;
    }

    await this.dependencies.writeAuditLog({
      req,
      action: "user.restore",
      entityType: "user",
      entityId: userId,
      metadata: {},
    });
    return true;
  }

  private async assertPermissionIdsExist(overrides: PermissionOverride[]) {
    const permissionIds = overrides.map(({ permissionId }) => permissionId);
    if (!(await this.dependencies.repository.permissionIdsExist(permissionIds))) {
      throw new HttpError(400, { message: "Geçersiz izin kimliği gönderildi." });
    }
  }

  private async writePermissionOverrideAudit(
    req: Request,
    userId: string,
    roleId: string,
    overrides: PermissionOverride[],
  ) {
    await this.dependencies.writeAuditLog({
      req,
      action: "user.permission_overrides.update",
      entityType: "user",
      entityId: userId,
      metadata: {
        roleId,
        grantedPermissions: overrides
          .filter(({ effect }) => effect === "allow")
          .map(({ permissionId }) => permissionId),
        deniedPermissions: overrides
          .filter(({ effect }) => effect === "deny")
          .map(({ permissionId }) => permissionId),
      },
    });
  }
}
