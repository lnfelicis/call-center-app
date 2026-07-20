import type { Request } from "express";
import type { AuthenticatedRequest } from "../auth/types.js";
import type { AuditRepository } from "./repository.js";
import type { AuditInput, AuditWriter } from "./types.js";

export type AuditServiceDependencies = {
  repository: Pick<AuditRepository, "insert" | "resolveSnapshot">;
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
    entityLabel = null,
    metadata = {},
  }: AuditInput) => {
    const actorUserId = (req as AuthenticatedRequest).user?.id ?? null;
    const roleId = typeof metadata.roleId === "string" ? metadata.roleId : null;
    const snapshot = await repository.resolveSnapshot(entityType, entityId, roleId);
    const enrichedMetadata = enrichMetadata(metadata, snapshot.roleName);

    await repository.insert({
      id: idGenerator(),
      actorUserId,
      action,
      entityType,
      entityId,
      entityLabel: entityLabel ?? inferEntityLabel(enrichedMetadata) ?? snapshot.entityLabel,
      metadata: JSON.stringify(enrichedMetadata),
      ipAddress: getClientIp(req),
      userAgent: req.header("user-agent") ?? null,
    });
  };
}

function enrichMetadata(metadata: Record<string, unknown>, roleName: string | null) {
  const enriched = { ...metadata };

  if (roleName && typeof enriched.roleName !== "string") {
    enriched.roleName = roleName;
  }

  addArrayCount(enriched, "permissionOverrides", "permissionOverrideCount");
  addArrayCount(enriched, "grantedPermissions", "grantedPermissionCount");
  addArrayCount(enriched, "deniedPermissions", "deniedPermissionCount");
  addArrayCount(enriched, "permissions", "permissionCount");

  return enriched;
}

function addArrayCount(metadata: Record<string, unknown>, source: string, target: string) {
  const value = metadata[source];
  if (Array.isArray(value) && typeof metadata[target] !== "number") {
    metadata[target] = value.length;
  }
}

function inferEntityLabel(metadata: Record<string, unknown>) {
  for (const key of ["email", "name", "recordNumber", "label"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
}
