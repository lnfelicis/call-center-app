import type { Request } from "express";
import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import type { AuthenticatedRequest } from "./auth.js";
import { getClientIp } from "./requestIp.js";

type AuditInput = {
  req: Request;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog({
  req,
  action,
  entityType,
  entityId = null,
  metadata = {},
}: AuditInput) {
  const actorUserId = (req as AuthenticatedRequest).user?.id ?? null;

  await db.query(
    `INSERT INTO audit_logs
      (id, actor_user_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      actorUserId,
      action,
      entityType,
      entityId,
      JSON.stringify(metadata),
      getClientIp(req),
      req.header("user-agent") ?? null,
    ],
  );
}
