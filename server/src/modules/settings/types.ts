import type { RowDataPacket } from "mysql2";
import type { OptionType } from "./settings.policy.js";

export type OptionRow = RowDataPacket & {
  id: string;
  option_type: OptionType;
  label: string;
  value: string | null;
  color: string | null;
  is_active: 0 | 1;
  sort_order: number;
};

export type FieldRow = RowDataPacket & {
  field_key: string;
  label: string;
  is_active: 0 | 1;
  is_required: 0 | 1;
  is_visible: 0 | 1;
  is_editable: 0 | 1;
  is_masked: 0 | 1;
  sort_order: number;
};
