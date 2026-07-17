import type { Pool } from "mysql2/promise";
import type {
  CountRow,
  DashboardRows,
  RecentCallRow,
  RecentLogRow,
  StatusRow,
} from "./types.js";

export type AdminDatabase = Pick<Pool, "query">;

export class AdminRepository {
  constructor(private readonly database: AdminDatabase) {}

  async getDashboardRows(): Promise<DashboardRows> {
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
      this.database.query<CountRow[]>("SELECT COUNT(*) AS total FROM call_records"),
      this.database.query<CountRow[]>(
        "SELECT COUNT(*) AS total FROM users WHERE archived_at IS NULL",
      ),
      this.database.query<CountRow[]>("SELECT COUNT(*) AS total FROM roles WHERE is_active = 1"),
      this.database.query<CountRow[]>(
        "SELECT COUNT(*) AS total FROM call_records WHERE status NOT IN ('resolved', 'closed', 'archived', 'cancelled')",
      ),
      this.database.query<CountRow[]>(
        "SELECT COUNT(*) AS total FROM call_records WHERE needs_follow_up = 1 AND status NOT IN ('resolved', 'closed', 'archived', 'cancelled')",
      ),
      this.database.query<StatusRow[]>(
        `SELECT status, COUNT(*) AS total
        FROM call_records
        GROUP BY status
        ORDER BY total DESC`,
      ),
      this.database.query<RecentCallRow[]>(
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
      this.database.query<RecentLogRow[]>(
        `SELECT audit_logs.id, users.username AS actor_username, audit_logs.action, audit_logs.entity_type, audit_logs.created_at
        FROM audit_logs
        LEFT JOIN users ON users.id = audit_logs.actor_user_id
        ORDER BY audit_logs.created_at DESC
        LIMIT 8`,
      ),
    ]);

    return {
      callCounts,
      userCounts,
      roleCounts,
      openCounts,
      followUpCounts,
      statusRows,
      recentCalls,
      recentLogs,
    };
  }
}
