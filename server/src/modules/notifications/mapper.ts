import type { NotificationRow } from "./types.js";

export function serializeNotification(row: NotificationRow) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.notification_type,
    channel: row.channel,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityLabel: row.entity_label ?? null,
    isRead: row.is_read === 1,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}
