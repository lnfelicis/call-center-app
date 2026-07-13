import type { Pool } from "mysql2/promise";
import type { AuditRecord } from "./types.js";

export type AuditDatabase = Pick<Pool, "query">;

export class AuditRepository {
  constructor(private readonly database: AuditDatabase) {}

  async insert(record: AuditRecord) {
    await this.database.query(
      `INSERT INTO audit_logs
        (id, actor_user_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.actorUserId,
        record.action,
        record.entityType,
        record.entityId,
        record.metadata,
        record.ipAddress,
        record.userAgent,
      ],
    );
  }
}
