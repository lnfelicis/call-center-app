import { describe, expect, it } from "vitest";
import {
  createOptionValue,
  normalizeColor,
  normalizeOptionType,
  prepareSettingsUpdate,
} from "../../../src/modules/settings/settings.policy.js";

describe("settings policy", () => {
  it("keeps option type, color, and Turkish system-value normalization", () => {
    expect(normalizeOptionType("status")).toBe("status");
    expect(normalizeOptionType("issue_sub_category")).toBeNull();
    expect(normalizeColor("status", " #AABBCC ")).toBe("#aabbcc");
    expect(normalizeColor("priority", "blue")).toBe("");
    expect(normalizeColor("issue_category", "#ffffff")).toBeNull();
    expect(createOptionValue("status", " Çözüm Bekliyor ")).toBe("cozum_bekliyor");
    expect(createOptionValue("issue_category", " Teknik ")).toBe(" Teknik ");
  });

  it("validates every field before option validation", () => {
    const result = prepareSettingsUpdate(
      [{ key: "", label: "" }],
      [{ id: "option", type: "status", label: "A", color: "invalid" }],
    );

    expect(result).toStrictEqual({ error: "Form alanı ayarlarında geçersiz kayıt var." });
  });

  it("keeps invalid-color priority over the generic option error", () => {
    const result = prepareSettingsUpdate([], [
      { id: "", type: "status", label: "", color: "invalid" },
    ]);

    expect(result).toStrictEqual({ error: "Renk değeri #RRGGBB formatında olmalıdır." });
  });

  it("prepares the exact SQL coercion values before opening a transaction", () => {
    const result = prepareSettingsUpdate(
      [
        {
          key: " phone ",
          label: " Telefon ",
          isActive: true,
          isRequired: "true",
          isVisible: false,
          isEditable: true,
          isMasked: true,
          sortOrder: "7",
        },
      ],
      [
        {
          id: 123,
          type: "priority",
          label: " Yüksek ",
          value: "",
          color: "#EA580C",
          isActive: "true",
          sortOrder: "4",
        },
      ],
    );

    expect(result).toStrictEqual({
      value: {
        fields: [
          {
            key: "phone",
            label: "Telefon",
            isActive: 1,
            isRequired: 0,
            isVisible: 0,
            isEditable: 1,
            isMasked: 1,
            sortOrder: 7,
          },
        ],
        options: [
          {
            id: "123",
            type: "priority",
            label: "Yüksek",
            value: "yuksek",
            color: "#ea580c",
            isActive: 0,
            sortOrder: 4,
          },
        ],
      },
    });
  });
});
