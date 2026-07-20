import type { RowDataPacket } from "mysql2";

export type AuditLogRow = RowDataPacket & {
  id: string;
  actor_user_id: string | null;
  actor_username: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  metadata: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};
