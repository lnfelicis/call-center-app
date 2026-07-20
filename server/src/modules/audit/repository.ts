import type { Pool, RowDataPacket } from "mysql2/promise";
import type { AuditRecord, AuditSnapshot } from "./types.js";

export type AuditDatabase = Pick<Pool, "query">;

export class AuditRepository {
  constructor(private readonly database: AuditDatabase) {}

  async insert(record: AuditRecord) {
    await this.database.query(
      `INSERT INTO audit_logs
        (id, actor_user_id, action, entity_type, entity_id, entity_label, metadata, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.actorUserId,
        record.action,
        record.entityType,
        record.entityId,
        record.entityLabel,
        record.metadata,
        record.ipAddress,
        record.userAgent,
      ],
    );
  }

  async resolveSnapshot(
    entityType: string,
    entityId: string | null,
    roleId: string | null,
  ): Promise<AuditSnapshot> {
    if (!entityId && !roleId) {
      return { entityLabel: null, roleName: null };
    }

    const [rows] = await this.database.query<Array<RowDataPacket & {
      entity_label: string | null;
      role_name: string | null;
    }>>(
      `SELECT
        CASE
          WHEN ? = 'user' THEN (SELECT email FROM users WHERE id = ? LIMIT 1)
          WHEN ? = 'role' THEN (SELECT name FROM roles WHERE id = ? LIMIT 1)
          WHEN ? = 'call' THEN (SELECT record_number FROM call_records WHERE id = ? LIMIT 1)
          WHEN ? = 'call_form_option' THEN (SELECT label FROM call_form_options WHERE id = ? LIMIT 1)
          WHEN ? = 'notification' THEN (SELECT title FROM notifications WHERE id = ? LIMIT 1)
          ELSE NULL
        END AS entity_label,
        (SELECT name FROM roles WHERE id = ? LIMIT 1) AS role_name`,
      [
        entityType,
        entityId,
        entityType,
        entityId,
        entityType,
        entityId,
        entityType,
        entityId,
        entityType,
        entityId,
        roleId,
      ],
    );

    return {
      entityLabel: rows[0]?.entity_label ?? null,
      roleName: rows[0]?.role_name ?? null,
    };
  }
}
