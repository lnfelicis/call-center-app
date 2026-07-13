import type { Request } from "express";
import type { AuditWriter } from "../audit/types.js";
import { mapUserRow } from "./mapper.js";
import type { UserRepository } from "./repository.js";
import type { CreateUserInput, UpdateUserInput } from "./types.js";

export type UserServiceDependencies = {
  repository: Pick<UserRepository, "listActive" | "listAll" | "create" | "update">;
  idGenerator: () => string;
  hashPassword: (password: string) => Promise<string>;
  writeAuditLog: AuditWriter;
};

export class UserService {
  constructor(private readonly dependencies: UserServiceDependencies) {}

  async listActive() {
    return (await this.dependencies.repository.listActive()).map(mapUserRow);
  }

  async listAll() {
    return (await this.dependencies.repository.listAll()).map(mapUserRow);
  }

  async create(req: Request, input: CreateUserInput) {
    const userId = this.dependencies.idGenerator();
    const passwordHash = await this.dependencies.hashPassword(input.password);

    await this.dependencies.repository.create(userId, input, passwordHash);
    await this.dependencies.writeAuditLog({
      req,
      action: "user.create",
      entityType: "user",
      entityId: userId,
      metadata: { username: input.username, email: input.email, roleId: input.roleId },
    });

    return userId;
  }

  async update(req: Request, input: UpdateUserInput) {
    const affectedRows = await this.dependencies.repository.update(input);

    if (affectedRows === 0) {
      return false;
    }

    await this.dependencies.writeAuditLog({
      req,
      action: "user.update",
      entityType: "user",
      entityId: input.userId,
      metadata: { email: input.email, roleId: input.roleId, status: input.status },
    });

    return true;
  }
}
