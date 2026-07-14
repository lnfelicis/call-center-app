import type { RowDataPacket } from "mysql2";
import type { AuthenticatedRequest } from "../auth/types.js";
import type {
  CallDatabase,
  CallFormFieldRow,
  CallRow,
  IdGenerator,
} from "./call.types.js";

export interface CallRepository {
  readonly database: CallDatabase;
  getFieldSettings(): Promise<CallFormFieldRow[]>;
  getCallById(callId: string): Promise<CallRow | null>;
  getActiveOptionValues(type: "priority" | "status"): Promise<string[]>;
  writeCallEvent(
    req: AuthenticatedRequest,
    callId: string,
    eventType: string,
    description: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
}

export function createMySqlCallRepository(
  database: CallDatabase,
  idGenerator: IdGenerator,
): CallRepository {
  return {
    database,

    async getFieldSettings() {
      const [rows] = await database.query<CallFormFieldRow[]>(
        `SELECT field_key, label, is_active, is_required, is_visible, is_editable, is_masked, sort_order
        FROM call_form_fields
        ORDER BY sort_order ASC, field_key ASC`,
      );

      return rows;
    },

    async getCallById(callId) {
      const [rows] = await database.query<CallRow[]>(
        `SELECT
          call_records.*,
          opened_by.full_name AS opened_by_name,
          assigned_to.full_name AS assigned_to_name,
          resolved_by.full_name AS resolved_by_name
        FROM call_records
        INNER JOIN users opened_by ON opened_by.id = call_records.opened_by_user_id
        LEFT JOIN users assigned_to ON assigned_to.id = call_records.assigned_to_user_id
        LEFT JOIN users resolved_by ON resolved_by.id = call_records.resolved_by_user_id
        WHERE call_records.id = ?
        LIMIT 1`,
        [callId],
      );

      return rows[0] ?? null;
    },

    async getActiveOptionValues(type) {
      const [rows] = await database.query<Array<RowDataPacket & { value: string | null; label: string }>>(
        `SELECT value, label
        FROM call_form_options
        WHERE option_type = ? AND is_active = 1`,
        [type],
      );

      return rows.map((row) => row.value ?? row.label);
    },

    async writeCallEvent(req, callId, eventType, description, metadata = {}) {
      await database.query(
        `INSERT INTO call_events
          (id, call_id, actor_user_id, event_type, description, metadata)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [idGenerator(), callId, req.user?.id ?? null, eventType, description, JSON.stringify(metadata)],
      );
    },
  };
}
