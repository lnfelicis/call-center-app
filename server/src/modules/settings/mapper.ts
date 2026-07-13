import type { FieldRow, OptionRow } from "./types.js";

export function serializeOption(row: OptionRow) {
  return {
    id: row.id,
    type: row.option_type,
    label: row.label,
    value: row.value ?? row.label,
    color: row.color,
    isActive: row.is_active === 1,
    sortOrder: row.sort_order,
  };
}

export function serializeField(row: FieldRow) {
  return {
    key: row.field_key,
    label: row.label,
    isActive: row.is_active === 1,
    isRequired: row.is_required === 1,
    isVisible: row.is_visible === 1,
    isEditable: row.is_editable === 1,
    isMasked: row.is_masked === 1,
    sortOrder: row.sort_order,
  };
}
