import { describe, expect, it, vi } from "vitest";
import type { CallRepository } from "../../../src/modules/calls/call.repository.js";
import {
  buildPhoneMatchFilter,
  createOptionValue,
  createSystemValue,
  editableOptionalValue,
  generateRecordNumber,
  normalizeBoolean,
  normalizeOptionColor,
  normalizeOptionValue,
  normalizeOptionalString,
  normalizePhoneForMatch,
  normalizeRequiredString,
} from "../../../src/modules/calls/call.service.js";
import { createField } from "./call-fixtures.js";

describe("call service helpers", () => {
  it("keeps string, phone and boolean coercion semantics", () => {
    expect(normalizeOptionalString(undefined)).toBeNull();
    expect(normalizeOptionalString("  value  ")).toBe("value");
    expect(normalizeRequiredString(null)).toBe("");
    expect(normalizeRequiredString(42)).toBe("42");
    expect(normalizePhoneForMatch(" +90 (555) 12-34 ")).toBe("905551234");
    expect([true, "true", 1, "1"].map(normalizeBoolean)).toStrictEqual([
      true,
      true,
      true,
      true,
    ]);
    expect([false, "false", 0, "0", null].map(normalizeBoolean)).toStrictEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("normalizes option colors only for status and priority", () => {
    expect(normalizeOptionColor("issue_category", "#ABCDEF")).toBeNull();
    expect(normalizeOptionColor("status", "")).toBeNull();
    expect(normalizeOptionColor("priority", "#ABCDEF")).toBe("#abcdef");
    expect(normalizeOptionColor("status", "red")).toBe("");
  });

  it("preserves Turkish system value and option value generation", () => {
    expect(createSystemValue("  ÇAĞRI ÜŞİÖ / Test  ")).toBe("cagri_usio_test");
    expect(createSystemValue("---")).toBe("");
    expect(createOptionValue("priority", " Çok Acil ")).toBe("cok_acil");
    expect(createOptionValue("issue_category", " Kayıt ")).toBe(" Kayıt ");
    expect(createOptionValue("status", "---")).toBe("---");
  });

  it("uses the injected clock and id generator for record numbers", () => {
    const clock = () => ({
      toISOString: () => "2026-07-13T06:08:07.000Z",
      toTimeString: () => "09:08:07 GMT+0300",
    }) as Date;

    expect(generateRecordNumber(clock, () => "abcdef12-0000-0000-0000-000000000000"))
      .toBe("CAG-20260713-090807-ABCDEF");
  });

  it("accepts configured option values and falls back for empty or unknown values", async () => {
    const getActiveOptionValues = vi.fn().mockResolvedValue(["normal", "urgent"]);
    const repository = { getActiveOptionValues } as unknown as CallRepository;

    await expect(normalizeOptionValue(repository, "priority", " urgent ", "normal"))
      .resolves.toBe("urgent");
    await expect(normalizeOptionValue(repository, "priority", "invalid", "normal"))
      .resolves.toBe("normal");
    await expect(normalizeOptionValue(repository, "priority", " ", "normal"))
      .resolves.toBe("normal");
    expect(getActiveOptionValues).toHaveBeenCalledTimes(2);
    expect(getActiveOptionValues).toHaveBeenNthCalledWith(1, "priority");
  });

  it("preserves editable-field and own-property semantics", () => {
    const editable = createField("phoneNumber");
    const readOnly = createField("studentTc", { is_editable: 0 });

    expect(editableOptionalValue([editable], { phoneNumber: " 123 " }, "phoneNumber", " 123 ", "old"))
      .toBe("123");
    expect(editableOptionalValue([editable], { phoneNumber: " " }, "phoneNumber", " ", "old"))
      .toBeNull();
    expect(editableOptionalValue([editable], {}, "phoneNumber", undefined, "old"))
      .toBe("old");
    expect(editableOptionalValue([readOnly], { studentTc: "new" }, "studentTc", "new", "old"))
      .toBe("old");
  });

  it("builds exact and last-ten-digit phone match params in order", () => {
    const short = buildPhoneMatchFilter("call_records.phone_number", "5551234");
    const long = buildPhoneMatchFilter("call_records.phone_number", "905551234567");

    expect(short.params).toStrictEqual(["5551234"]);
    expect(short.conditions).toHaveLength(1);
    expect(long.params).toStrictEqual(["905551234567", "5551234567"]);
    expect(long.conditions[0]).toContain("call_records.phone_number");
    expect(long.conditions[1]).toBe(`RIGHT(${long.conditions[0]!.slice(0, -4)}, 10) = ?`);
  });
});
