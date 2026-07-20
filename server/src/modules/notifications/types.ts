import type { RowDataPacket } from "mysql2";

export type RecipientRow = RowDataPacket & {
  id: string;
};

export type NotificationInput = {
  userIds: string[];
  title: string;
  message: string;
  type: string;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  dedupeKey?: string | null;
};

export type StoredNotificationInput = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  channel: "panel" | "email";
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
  dedupeKey: string | null;
};

export type FollowUpCallRow = RowDataPacket & {
  id: string;
  record_number: string;
  opened_by_user_id: string;
  assigned_to_user_id: string | null;
};

export type StaleCallRow = RowDataPacket & {
  id: string;
  record_number: string;
};

export type NotificationRow = RowDataPacket & {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  channel: "panel" | "email";
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  is_read: 0 | 1;
  read_at: string | null;
  created_at: string;
};

export type UnreadNotificationCountRow = RowDataPacket & {
  total: number;
};
