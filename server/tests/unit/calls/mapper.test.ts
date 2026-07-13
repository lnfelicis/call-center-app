import { describe, expect, it } from "vitest";
import {
  maskPhone,
  maskTc,
  serializeCall,
  serializeField,
  serializeOption,
} from "../../../src/modules/calls/call.mapper.js";
import type { CallOptionRow } from "../../../src/modules/calls/call.types.js";
import { createCallRequest, createCallRow, createField } from "./call-fixtures.js";

describe("call mapper", () => {
  it("keeps legacy phone and identity masking", () => {
    expect(maskPhone("12345")).toBe("***");
    expect(maskPhone("05551234567")).toBe("0555 *** ** 67");
    expect(maskTc(null)).toBeNull();
    expect(maskTc("10000000146")).toBe("100******46");
  });

  it("masks only fields configured as masked for users without unmasked permission", () => {
    const call = createCallRow();
    const fields = [
      createField("phoneNumber", { is_masked: 1 }),
      createField("studentTc", { is_masked: 1 }),
    ];

    const masked = serializeCall(createCallRequest([]), call, fields);
    const unmasked = serializeCall(
      createCallRequest(["sensitive.view_unmasked"]),
      call,
      fields,
    );

    expect(masked.phoneNumber).toBe("0555 *** ** 67");
    expect(masked.studentTc).toBe("100******46");
    expect(unmasked.phoneNumber).toBe("05551234567");
    expect(unmasked.studentTc).toBe("10000000146");
  });

  it("preserves call response key order and boolean conversion", () => {
    const result = serializeCall(createCallRequest([]), createCallRow({
      needs_follow_up: 1,
      is_locked: 1,
    }));

    expect(Object.keys(result)).toStrictEqual([
      "id",
      "recordNumber",
      "phoneNumber",
      "studentTc",
      "studentName",
      "interactionType",
      "category",
      "subCategory",
      "issue",
      "initialNote",
      "priority",
      "status",
      "needsFollowUp",
      "followUpAt",
      "openedByUserId",
      "openedByName",
      "assignedToUserId",
      "assignedToName",
      "resolvedByUserId",
      "resolvedByName",
      "resolvedAt",
      "resolutionDescription",
      "resolutionCategory",
      "isLocked",
      "createdAt",
      "updatedAt",
    ]);
    expect(result.needsFollowUp).toBe(true);
    expect(result.isLocked).toBe(true);
  });

  it("preserves option fallback and field response shapes", () => {
    const option = {
      id: "option-1",
      option_type: "priority",
      label: "Normal",
      value: null,
      color: "#ffffff",
      is_active: 1,
      sort_order: 2,
    } as CallOptionRow;
    const field = createField("phoneNumber", {
      label: "Telefon",
      is_required: 1,
      is_masked: 1,
      sort_order: 3,
    });

    expect(serializeOption(option)).toStrictEqual({
      id: "option-1",
      type: "priority",
      label: "Normal",
      value: "Normal",
      color: "#ffffff",
      isActive: true,
      sortOrder: 2,
    });
    expect(serializeField(field)).toStrictEqual({
      key: "phoneNumber",
      label: "Telefon",
      isActive: true,
      isRequired: true,
      isVisible: true,
      isEditable: true,
      isMasked: true,
      sortOrder: 3,
    });
  });
});
