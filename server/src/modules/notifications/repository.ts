import type { ResultSetHeader } from "mysql2";
import type { Database } from "../../database/database.js";
import type {
  FollowUpCallRow,
  NotificationRow,
  RecipientRow,
  StaleCallRow,
  StoredNotificationInput,
  UnreadNotificationCountRow,
} from "./types.js";

export class NotificationRepository {
  constructor(private readonly database: Database) {}

  async getUsersWithAnyPermission(permissionIds: string[]) {
    if (permissionIds.length === 0) {
      return [];
    }

    const placeholders = permissionIds.map(() => "?").join(", ");
    const [rows] = await this.database.query<RecipientRow[]>(
      `SELECT DISTINCT users.id
      FROM users
      INNER JOIN roles ON roles.id = users.role_id
      INNER JOIN effective_user_permissions ON effective_user_permissions.user_id = users.id
      WHERE users.status = 'active'
        AND users.archived_at IS NULL
        AND roles.is_active = 1
        AND effective_user_permissions.permission_id IN (${placeholders})`,
      permissionIds,
    );

    return rows.map((row) => row.id);
  }

  async insertNotification(input: StoredNotificationInput) {
    await this.database.query(
      `INSERT IGNORE INTO notifications
        (id, user_id, title, message, notification_type, channel, entity_type, entity_id, entity_label, dedupe_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.userId,
        input.title,
        input.message,
        input.type,
        input.channel,
        input.entityType,
        input.entityId,
        input.entityLabel,
        input.dedupeKey,
      ],
    );
  }

  async findDueFollowUps() {
    const [rows] = await this.database.query<FollowUpCallRow[]>(
      `SELECT id, record_number, opened_by_user_id, assigned_to_user_id
      FROM call_records
      WHERE needs_follow_up = 1
        AND follow_up_at IS NOT NULL
        AND follow_up_at <= NOW()
        AND status NOT IN ('resolved', 'closed', 'archived', 'cancelled')
      ORDER BY follow_up_at ASC
      LIMIT 50`,
    );

    return rows;
  }

  async findStaleCalls(staleCallHours: number) {
    const [rows] = await this.database.query<StaleCallRow[]>(
      `SELECT id, record_number
      FROM call_records
      WHERE created_at <= DATE_SUB(NOW(), INTERVAL ? HOUR)
        AND status NOT IN ('resolved', 'closed', 'archived', 'cancelled')
      ORDER BY created_at ASC
      LIMIT 50`,
      [staleCallHours],
    );

    return rows;
  }

  async listPanelNotifications(userId: string | undefined, limit = 100) {
    const [rows] = await this.database.query<NotificationRow[]>(
      `SELECT id, title, message, notification_type, channel, entity_type, entity_id, entity_label, is_read, read_at, created_at
      FROM notifications
      WHERE user_id = ? AND channel = 'panel'
      ORDER BY is_read ASC, created_at DESC
      LIMIT ?`,
      [userId, limit],
    );

    return rows;
  }

  async listRecentPanelNotifications(userId: string | undefined, limit = 5) {
    const [rows] = await this.database.query<NotificationRow[]>(
      `SELECT id, title, message, notification_type, channel, entity_type, entity_id, entity_label, is_read, read_at, created_at
      FROM notifications
      WHERE user_id = ? AND channel = 'panel'
      ORDER BY created_at DESC
      LIMIT ?`,
      [userId, limit],
    );

    return rows;
  }

  async countUnreadPanelNotifications(userId: string | undefined) {
    const [rows] = await this.database.query<UnreadNotificationCountRow[]>(
      `SELECT COUNT(*) AS total
      FROM notifications
      WHERE user_id = ? AND channel = 'panel' AND is_read = 0`,
      [userId],
    );

    return Number(rows[0]?.total ?? 0);
  }

  async markRead(notificationId: string, userId: string | undefined) {
    const [result] = await this.database.query<ResultSetHeader>(
      `UPDATE notifications
      SET is_read = 1, read_at = NOW()
      WHERE id = ? AND user_id = ?`,
      [notificationId, userId],
    );

    return result.affectedRows;
  }
}
