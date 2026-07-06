import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { requireAnyPermission, requireAuth } from "../auth.js";
import { db } from "../db.js";

type CountRow = RowDataPacket & {
  total: number;
};

type StatusRow = RowDataPacket & {
  status: string;
  total: number;
};

type RecentCallRow = RowDataPacket & {
  id: string;
  record_number: string;
  status: string;
  priority: string;
  opened_by_name: string;
  resolved_at: string | null;
  created_at: string;
};

type RecentLogRow = RowDataPacket & {
  id: string;
  actor_username: string | null;
  action: string;
  entity_type: string;
  created_at: string;
};

export const adminRoutes = Router();

adminRoutes.use(requireAuth);

adminRoutes.get(
  "/admin/dashboard",
  requireAnyPermission(["calls.view.all", "users.manage", "logs.view"]),
  async (_req, res) => {
    const [
      [callCounts],
      [userCounts],
      [roleCounts],
      [openCounts],
      [followUpCounts],
      [statusRows],
      [recentCalls],
      [recentLogs],
    ] = await Promise.all([
      db.query<CountRow[]>("SELECT COUNT(*) AS total FROM call_records"),
      db.query<CountRow[]>("SELECT COUNT(*) AS total FROM users"),
      db.query<CountRow[]>("SELECT COUNT(*) AS total FROM roles WHERE is_active = 1"),
      db.query<CountRow[]>(
        "SELECT COUNT(*) AS total FROM call_records WHERE status NOT IN ('resolved', 'closed', 'archived', 'cancelled')",
      ),
      db.query<CountRow[]>(
        "SELECT COUNT(*) AS total FROM call_records WHERE needs_follow_up = 1 AND status NOT IN ('resolved', 'closed', 'archived', 'cancelled')",
      ),
      db.query<StatusRow[]>(
        `SELECT status, COUNT(*) AS total
        FROM call_records
        GROUP BY status
        ORDER BY total DESC`,
      ),
      db.query<RecentCallRow[]>(
        `SELECT
          call_records.id,
          call_records.record_number,
          call_records.status,
          call_records.priority,
          call_records.resolved_at,
          call_records.created_at,
          users.full_name AS opened_by_name
        FROM call_records
        INNER JOIN users ON users.id = call_records.opened_by_user_id
        ORDER BY call_records.created_at DESC
        LIMIT 8`,
      ),
      db.query<RecentLogRow[]>(
        `SELECT audit_logs.id, users.username AS actor_username, audit_logs.action, audit_logs.entity_type, audit_logs.created_at
        FROM audit_logs
        LEFT JOIN users ON users.id = audit_logs.actor_user_id
        ORDER BY audit_logs.created_at DESC
        LIMIT 8`,
      ),
    ]);

    res.json({
      metrics: {
        totalCalls: callCounts[0]?.total ?? 0,
        openCalls: openCounts[0]?.total ?? 0,
        followUpCalls: followUpCounts[0]?.total ?? 0,
        totalUsers: userCounts[0]?.total ?? 0,
        activeRoles: roleCounts[0]?.total ?? 0,
      },
      callsByStatus: statusRows.map((row) => ({
        status: row.status,
        total: row.total,
      })),
      recentCalls: recentCalls.map((call) => ({
        id: call.id,
        recordNumber: call.record_number,
        status: call.status,
        priority: call.priority,
        openedByName: call.opened_by_name,
        resolvedAt: call.resolved_at,
        createdAt: call.created_at,
      })),
      recentLogs: recentLogs.map((log) => ({
        id: log.id,
        actorUsername: log.actor_username,
        action: log.action,
        entityType: log.entity_type,
        createdAt: log.created_at,
      })),
    });
  },
);
