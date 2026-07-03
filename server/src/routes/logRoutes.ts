import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { requireAuth, requirePermission } from "../auth.js";
import { db } from "../db.js";

type AuditLogRow = RowDataPacket & {
  id: string;
  actor_user_id: string | null;
  actor_username: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export const logRoutes = Router();

logRoutes.use(requireAuth);

logRoutes.get("/logs", requirePermission("logs.view"), async (_req, res) => {
  const [rows] = await db.query<AuditLogRow[]>(
    `SELECT
      audit_logs.id,
      audit_logs.actor_user_id,
      users.username AS actor_username,
      audit_logs.action,
      audit_logs.entity_type,
      audit_logs.entity_id,
      audit_logs.metadata,
      audit_logs.ip_address,
      audit_logs.user_agent,
      audit_logs.created_at
    FROM audit_logs
    LEFT JOIN users ON users.id = audit_logs.actor_user_id
    ORDER BY audit_logs.created_at DESC
    LIMIT 100`,
  );

  res.json({
    logs: rows.map((row) => ({
      id: row.id,
      actorUserId: row.actor_user_id,
      actorUsername: row.actor_username,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: row.metadata,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    })),
  });
});
