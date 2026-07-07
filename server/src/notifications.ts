import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "./db.js";
import { readAppSetting } from "./settings.js";

type RecipientRow = RowDataPacket & {
  id: string;
};

type NotificationInput = {
  userIds: string[];
  title: string;
  message: string;
  type: string;
  entityType?: string | null;
  entityId?: string | null;
  dedupeKey?: string | null;
};

export async function getUsersWithAnyPermission(permissionIds: string[]) {
  if (permissionIds.length === 0) {
    return [];
  }

  const placeholders = permissionIds.map(() => "?").join(", ");
  const [rows] = await db.query<RecipientRow[]>(
    `SELECT DISTINCT users.id
    FROM users
    INNER JOIN roles ON roles.id = users.role_id
    INNER JOIN role_permissions ON role_permissions.role_id = roles.id
    WHERE users.status = 'active'
      AND roles.is_active = 1
      AND role_permissions.permission_id IN (${placeholders})`,
    permissionIds,
  );

  return rows.map((row) => row.id);
}

export async function createNotifications({
  userIds,
  title,
  message,
  type,
  entityType = null,
  entityId = null,
  dedupeKey = null,
}: NotificationInput) {
  const uniqueUserIds = [...new Set(userIds)].filter(Boolean);

  if (uniqueUserIds.length === 0) {
    return;
  }

  const settings = await readAppSetting("notification_settings");
  const channels = [
    settings.panelEnabled ? "panel" : null,
    settings.emailEnabled ? "email" : null,
  ].filter(Boolean) as Array<"panel" | "email">;

  if (channels.length === 0) {
    return;
  }

  for (const userId of uniqueUserIds) {
    for (const channel of channels) {
      const channelDedupeKey = dedupeKey ? `${dedupeKey}:${userId}:${channel}` : null;

      await db.query(
        `INSERT IGNORE INTO notifications
          (id, user_id, title, message, notification_type, channel, entity_type, entity_id, dedupe_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          userId,
          title,
          message,
          type,
          channel,
          entityType,
          entityId,
          channelDedupeKey,
        ],
      );
    }
  }
}

export async function notifyUsersWithAnyPermission(
  permissionIds: string[],
  notification: Omit<NotificationInput, "userIds">,
) {
  const userIds = await getUsersWithAnyPermission(permissionIds);
  await createNotifications({ ...notification, userIds });
}

export async function generateOperationalNotifications() {
  const settings = await readAppSetting("notification_settings");

  if (settings.followUpReminderEnabled) {
    const [followUpRows] = await db.query<Array<RowDataPacket & {
      id: string;
      record_number: string;
      opened_by_user_id: string;
      assigned_to_user_id: string | null;
    }>>(
      `SELECT id, record_number, opened_by_user_id, assigned_to_user_id
      FROM call_records
      WHERE needs_follow_up = 1
        AND follow_up_at IS NOT NULL
        AND follow_up_at <= NOW()
        AND status NOT IN ('resolved', 'closed', 'archived', 'cancelled')
      ORDER BY follow_up_at ASC
      LIMIT 50`,
    );

    for (const call of followUpRows) {
      await createNotifications({
        userIds: [call.opened_by_user_id, call.assigned_to_user_id].filter(Boolean) as string[],
        title: "Takip tarihi gelen çağrı",
        message: `${call.record_number} numaralı çağrı için takip zamanı geldi.`,
        type: "call.follow_up_due",
        entityType: "call",
        entityId: call.id,
        dedupeKey: `follow-up-due:${call.id}`,
      });
    }
  }

  if (settings.staleCallNotificationEnabled) {
    const [staleRows] = await db.query<Array<RowDataPacket & {
      id: string;
      record_number: string;
    }>>(
      `SELECT id, record_number
      FROM call_records
      WHERE created_at <= DATE_SUB(NOW(), INTERVAL ? HOUR)
        AND status NOT IN ('resolved', 'closed', 'archived', 'cancelled')
      ORDER BY created_at ASC
      LIMIT 50`,
      [settings.staleCallHours],
    );

    for (const call of staleRows) {
      await notifyUsersWithAnyPermission(["calls.view.all", "calls.resolve"], {
        title: "Çözüm bekleyen çağrı",
        message: `${call.record_number} numaralı çağrı belirlenen sürede çözülmedi.`,
        type: "call.stale",
        entityType: "call",
        entityId: call.id,
        dedupeKey: `stale-call:${call.id}:${settings.staleCallHours}`,
      });
    }
  }
}
