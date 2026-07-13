import type { Request } from "express";
import type { AuthenticatedRequest } from "../auth/types.js";
import type { AuditRepository } from "./repository.js";
import type { AuditInput, AuditWriter } from "./types.js";

export type AuditServiceDependencies = {
  repository: Pick<AuditRepository, "insert">;
  idGenerator: () => string;
  getClientIp: (req: Request) => string | null;
};

export function createAuditWriter({
  repository,
  idGenerator,
  getClientIp,
}: AuditServiceDependencies): AuditWriter {
  return async ({
    req,
    action,
    entityType,
    entityId = null,
    metadata = {},
  }: AuditInput) => {
    const actorUserId = (req as AuthenticatedRequest).user?.id ?? null;

    await repository.insert({
      id: idGenerator(),
      actorUserId,
      action,
      entityType,
      entityId,
      metadata: JSON.stringify(metadata),
      ipAddress: getClientIp(req),
      userAgent: req.header("user-agent") ?? null,
    });
  };
}
