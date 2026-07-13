import type { Database } from "../../database/database.js";
import type { PreparedSettingsUpdate } from "./settings.policy.js";

export async function persistSettingsUpdate(
  database: Database,
  update: PreparedSettingsUpdate,
) {
  const connection = await database.getConnection();

  try {
    await connection.beginTransaction();

    for (const field of update.fields) {
      await connection.query(
        `UPDATE call_form_fields
        SET label = ?, is_active = ?, is_required = ?, is_visible = ?, is_editable = ?, is_masked = ?, sort_order = ?
        WHERE field_key = ?`,
        [
          field.label,
          field.isActive,
          field.isRequired,
          field.isVisible,
          field.isEditable,
          field.isMasked,
          field.sortOrder,
          field.key,
        ],
      );
    }

    for (const option of update.options) {
      await connection.query(
        `UPDATE call_form_options
        SET label = ?, value = ?, color = ?, is_active = ?, sort_order = ?
        WHERE id = ? AND option_type = ?`,
        [
          option.label,
          option.value,
          option.color,
          option.isActive,
          option.sortOrder,
          option.id,
          option.type,
        ],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
