import type { ResultSetHeader } from "mysql2";
import type { Database } from "../../database/database.js";
import type { OptionType, PreparedSettingsUpdate } from "./settings.policy.js";
import { persistSettingsUpdate } from "./settings.service.js";
import type { FieldRow, OptionRow } from "./types.js";

export class SettingsRepository {
  constructor(private readonly database: Database) {}

  async readOptions() {
    const [rows] = await this.database.query<OptionRow[]>(
      `SELECT id, option_type, label, value, color, is_active, sort_order
      FROM call_form_options
      WHERE option_type <> 'issue_sub_category'
      ORDER BY option_type ASC, sort_order ASC, label ASC`,
    );
    return rows;
  }

  async readFields() {
    const [rows] = await this.database.query<FieldRow[]>(
      `SELECT field_key, label, is_active, is_required, is_visible, is_editable, is_masked, sort_order
      FROM call_form_fields
      ORDER BY sort_order ASC, field_key ASC`,
    );
    return rows;
  }

  async readOptionsByType(type: OptionType) {
    const [rows] = await this.database.query<OptionRow[]>(
      `SELECT id, option_type, label, value, color, is_active, sort_order
      FROM call_form_options
      WHERE option_type = ?
      ORDER BY sort_order ASC, label ASC`,
      [type],
    );
    return rows;
  }

  async createOption(input: {
    id: string;
    type: OptionType;
    label: string;
    value: string;
    color: string | null;
    sortOrder: number;
  }) {
    await this.database.query(
      `INSERT INTO call_form_options (id, option_type, label, value, color, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?, 1, ?)`,
      [input.id, input.type, input.label, input.value, input.color, input.sortOrder],
    );
  }

  async updateOption(input: {
    id: string;
    type: OptionType;
    label: string;
    value: string;
    color: string | null;
    isActive: 0 | 1;
    sortOrder: number;
  }) {
    const [result] = await this.database.query<ResultSetHeader>(
      `UPDATE call_form_options
      SET label = ?, value = ?, color = ?, is_active = ?, sort_order = ?
      WHERE id = ? AND option_type = ?`,
      [
        input.label,
        input.value,
        input.color,
        input.isActive,
        input.sortOrder,
        input.id,
        input.type,
      ],
    );
    return result.affectedRows;
  }

  persist(update: PreparedSettingsUpdate) {
    return persistSettingsUpdate(this.database, update);
  }
}
