import { describe, expect, it } from "vitest";
import {
  buildCallVisibilityScope,
  canViewCall,
  fieldAllowsEdit,
  fieldIsEnabled,
  fieldLabel,
  fieldRequiresValue,
  getNoteAccess,
  hasPermission,
  isValidPhoneNumber,
  isValidTurkishIdentityNumber,
  requiredFieldError,
  shouldMaskField,
} from "../../../src/modules/calls/call.policy.js";
import { createCallRequest, createCallRow, createField } from "./call-fixtures.js";

describe("call policy", () => {
  it("defaults missing users and user ids exactly as the legacy policy", () => {
    const requestWithoutUser = {} as ReturnType<typeof createCallRequest>;
    expect(hasPermission(requestWithoutUser, "calls.view.all")).toBe(false);
    expect(buildCallVisibilityScope(requestWithoutUser)).toStrictEqual({
      conditions: ["(call_records.assigned_to_user_id = ?)"],
      params: [""],
    });

    const requestWithoutId = createCallRequest(["calls.view.own"]);
    requestWithoutId.user!.id = undefined as unknown as string;
    expect(buildCallVisibilityScope(requestWithoutId)).toStrictEqual({
      conditions: [
        "(call_records.opened_by_user_id = ? OR call_records.assigned_to_user_id = ?)",
      ],
      params: ["", ""],
    });
  });

  it("preserves all, own and assigned call visibility branches", () => {
    const call = createCallRow();

    expect(canViewCall(createCallRequest(["calls.view.all"]), call)).toBe(true);
    expect(canViewCall(createCallRequest(["calls.view.own"], "owner-1"), call)).toBe(true);
    expect(canViewCall(createCallRequest([], "assigned-1"), call)).toBe(true);
    expect(canViewCall(createCallRequest(["calls.view.own"], "other-1"), call)).toBe(false);
  });

  it("builds scoped visibility SQL and params in the legacy order", () => {
    expect(buildCallVisibilityScope(createCallRequest(["calls.view.own"]))).toStrictEqual({
      conditions: [
        "(call_records.opened_by_user_id = ? OR call_records.assigned_to_user_id = ?)",
      ],
      params: ["user-1", "user-1"],
    });
    expect(buildCallVisibilityScope(createCallRequest([]))).toStrictEqual({
      conditions: ["(call_records.assigned_to_user_id = ?)"],
      params: ["user-1"],
    });
    expect(buildCallVisibilityScope(createCallRequest(["calls.view.all"]))).toStrictEqual({
      conditions: [],
      params: [],
    });
  });

  it("uses the first configured required field error and its configured label", () => {
    const fields = [
      createField("phoneNumber", { label: "Telefon", is_required: 1 }),
      createField("studentName", { label: "Öğrenci", is_required: 1 }),
    ];

    expect(requiredFieldError(fields, { phoneNumber: " ", studentName: "" }))
      .toBe("Telefon zorunludur.");
    expect(requiredFieldError(fields, { phoneNumber: "123", studentName: "Name" }))
      .toBeNull();
  });

  it("keeps missing-field defaults and active/visible/editable/masked gates", () => {
    const disabled = createField("phoneNumber", {
      is_active: 0,
      is_required: 1,
      is_editable: 1,
      is_masked: 1,
    });
    const req = createCallRequest([]);

    expect(fieldRequiresValue([], "phoneNumber")).toBe(false);
    expect(fieldIsEnabled([], "phoneNumber")).toBe(true);
    expect(fieldAllowsEdit([], "phoneNumber")).toBe(true);
    expect(fieldRequiresValue([disabled], "phoneNumber")).toBe(false);
    expect(fieldIsEnabled([disabled], "phoneNumber")).toBe(false);
    expect(fieldIsEnabled([createField("phoneNumber")], "phoneNumber")).toBe(true);
    expect(fieldIsEnabled([
      createField("phoneNumber", { is_visible: 0 }),
    ], "phoneNumber")).toBe(false);
    expect(fieldAllowsEdit([disabled], "phoneNumber")).toBe(false);
    expect(fieldLabel([], "phoneNumber")).toBe("phoneNumber");
    expect(shouldMaskField(req, [disabled], "phoneNumber")).toBe(true);
    expect(shouldMaskField(
      createCallRequest(["sensitive.view_unmasked"]),
      [disabled],
      "phoneNumber",
    )).toBe(false);
  });

  it("preserves note authorization for owner, assignee, manager and unrelated users", () => {
    const call = createCallRow();

    expect(getNoteAccess(createCallRequest(["calls.note.own"], "owner-1"), call).canAddNote)
      .toBe(true);
    expect(getNoteAccess(
      createCallRequest(["calls.note.assigned"], "assigned-1"),
      call,
    )).toMatchObject({ isAssigned: true, canAddNote: true });
    expect(getNoteAccess(createCallRequest(["calls.edit"], "other-1"), call))
      .toMatchObject({ canAddAsManager: true, canAddNote: true });
    expect(getNoteAccess(createCallRequest([], "other-1"), call).canAddNote).toBe(false);
  });

  it("validates phone and Turkish identity values with the existing rules", () => {
    expect(isValidPhoneNumber(null)).toBe(true);
    expect(isValidPhoneNumber("+90 (555) 123-45-67")).toBe(true);
    expect(isValidPhoneNumber("123")).toBe(false);
    expect(isValidPhoneNumber("0555.123.45.67")).toBe(false);
    expect(isValidTurkishIdentityNumber("10000000146")).toBe(true);
    expect(isValidTurkishIdentityNumber("00000000146")).toBe(false);
    expect(isValidTurkishIdentityNumber("10000000145")).toBe(false);
  });
});
