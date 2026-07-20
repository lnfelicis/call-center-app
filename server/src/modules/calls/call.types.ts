import type { Request } from "express";
import type { RowDataPacket } from "mysql2/promise";
import type { Database } from "../../database/database.js";
import type { AuthenticatedRequest } from "../auth/types.js";

export type CallPriority = string;
export type CallStatus = string;

export type CallOptionType =
  | "interaction_type"
  | "issue_category"
  | "issue_sub_category"
  | "status"
  | "priority"
  | "resolution_category";

export type CallRow = RowDataPacket & {
  id: string;
  record_number: string;
  phone_number: string;
  student_tc: string | null;
  student_name: string | null;
  interaction_type: string;
  category: string;
  sub_category: string | null;
  issue: string;
  initial_note: string | null;
  priority: CallPriority;
  status: CallStatus;
  needs_follow_up: 0 | 1;
  follow_up_at: string | null;
  opened_by_user_id: string;
  opened_by_name: string;
  assigned_to_user_id: string | null;
  assigned_to_name: string | null;
  resolved_by_user_id: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  resolution_description: string | null;
  resolution_category: string | null;
  is_locked: 0 | 1;
  created_at: string;
  updated_at: string;
};

export type NoteRow = RowDataPacket & {
  id: string;
  call_id: string;
  author_user_id: string;
  author_name: string;
  note_type: string;
  content: string;
  created_at: string;
};

export type EventRow = RowDataPacket & {
  id: string;
  call_id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  event_type: string;
  description: string;
  metadata: unknown;
  created_at: string;
};

export type UserOptionRow = RowDataPacket & {
  id: string;
  full_name: string;
  username: string;
};

export type CallOptionRow = RowDataPacket & {
  id: string;
  option_type: CallOptionType;
  label: string;
  value: string | null;
  color: string | null;
  is_active: 0 | 1;
  sort_order: number;
};

export type CallFormFieldRow = RowDataPacket & {
  field_key: string;
  label: string;
  is_active: 0 | 1;
  is_required: 0 | 1;
  is_visible: 0 | 1;
  is_editable: 0 | 1;
  is_masked: 0 | 1;
  sort_order: number;
};

export type CallDatabase = Pick<Database, "query" | "getConnection">;
export type IdGenerator = () => string;
export type Clock = () => Date;

export type AuditWriter = (input: {
  req: Request;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) => Promise<void>;

export type NotificationPublisher = (
  permissionIds: string[],
  notification: {
    title: string;
    message: string;
    type: string;
    entityType?: string | null;
    entityId?: string | null;
    entityLabel?: string | null;
    dedupeKey?: string | null;
  },
) => Promise<void>;

export type DirectNotificationPublisher = (notification: {
  userIds: string[];
  title: string;
  message: string;
  type: string;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  dedupeKey?: string | null;
}) => Promise<void>;

export type NotificationSettingsReader = (key: "notification_settings") => Promise<{
  urgentNotificationEnabled: boolean;
}>;

export type ClientIpReader = (req: AuthenticatedRequest) => string | null;

export type CallVisibilityScope = {
  conditions: string[];
  params: string[];
};
