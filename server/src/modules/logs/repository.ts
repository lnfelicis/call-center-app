import type { Pool } from "mysql2/promise";
import type { AuditLogRow } from "./types.js";

export type LogDatabase = Pick<Pool, "query">;

export class LogRepository {
  constructor(private readonly database: LogDatabase) {}

  async listRecent() {
    const [rows] = await this.database.query<AuditLogRow[]>(
      `SELECT
        audit_logs.id,
        audit_logs.actor_user_id,
        users.username AS actor_username,
        audit_logs.action,
        audit_logs.entity_type,
        audit_logs.entity_id,
        audit_logs.entity_label,
        audit_logs.metadata,
        audit_logs.ip_address,
        audit_logs.user_agent,
        audit_logs.created_at
      FROM audit_logs
      LEFT JOIN users ON users.id = audit_logs.actor_user_id
      ORDER BY audit_logs.created_at DESC
      LIMIT 100`,
    );
    return rows;
  }
}
