import { describe, expect, it } from "vitest";
import { serializeField, serializeOption } from "../../../src/modules/settings/mapper.js";
import type { FieldRow, OptionRow } from "../../../src/modules/settings/types.js";

describe("settings mappers", () => {
  it("keeps option fallback and key order", () => {
    const result = serializeOption({
      id: "id",
      option_type: "status",
      label: "Açık",
      value: null,
      color: null,
      is_active: 1,
      sort_order: 1,
    } as OptionRow);

    expect(result).toStrictEqual({
      id: "id",
      type: "status",
      label: "Açık",
      value: "Açık",
      color: null,
      isActive: true,
      sortOrder: 1,
    });
  });

  it("uses strict numeric boolean conversion for fields", () => {
    const result = serializeField({
      field_key: "phone",
      label: "Telefon",
      is_active: 0,
      is_required: 1,
      is_visible: 1,
      is_editable: 0,
      is_masked: 1,
      sort_order: 2,
    } as FieldRow);

    expect(result).toStrictEqual({
      key: "phone",
      label: "Telefon",
      isActive: false,
      isRequired: true,
      isVisible: true,
      isEditable: false,
      isMasked: true,
      sortOrder: 2,
    });
  });
});
