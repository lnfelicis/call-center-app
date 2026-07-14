import type { AuthenticatedRequest } from "../auth/types.js";
import type {
  CallFormFieldRow,
  CallRow,
  CallVisibilityScope,
} from "./call.types.js";

export const nonEditableStatuses = ["resolved"] satisfies string[];
export const allowedNoteTypes = ["personnel", "follow_up", "assigned_personnel", "internal", "manager"];
export const allowedOptionTypes = [
  "interaction_type",
  "issue_category",
  "status",
  "priority",
  "resolution_category",
];

export function hasPermission(req: AuthenticatedRequest, permission: string) {
  return req.user?.permissions.includes(permission) ?? false;
}

export function canViewCall(req: AuthenticatedRequest, call: CallRow) {
  if (hasPermission(req, "calls.view.all")) {
    return true;
  }

  if (hasPermission(req, "calls.view.own") && call.opened_by_user_id === req.user?.id) {
    return true;
  }

  return call.assigned_to_user_id === req.user?.id;
}

export function getNoteAccess(req: AuthenticatedRequest, call: CallRow) {
  const isOwner = call.opened_by_user_id === req.user?.id;
  const isAssigned = call.assigned_to_user_id === req.user?.id;
  const canAddOwnNote = isOwner && hasPermission(req, "calls.note.own");
  const canAddAssignedNote = isAssigned && hasPermission(req, "calls.note.assigned");
  const canAddAsManager = hasPermission(req, "calls.edit");

  return {
    isAssigned,
    canAddAsManager,
    canAddNote: canAddOwnNote || canAddAssignedNote || canAddAsManager,
  };
}

export function buildCallVisibilityScope(req: AuthenticatedRequest): CallVisibilityScope {
  const params: string[] = [];
  const conditions: string[] = [];

  if (!hasPermission(req, "calls.view.all")) {
    const scopedConditions: string[] = [];

    if (hasPermission(req, "calls.view.own")) {
      scopedConditions.push("call_records.opened_by_user_id = ?");
      params.push(req.user?.id ?? "");
    }

    scopedConditions.push("call_records.assigned_to_user_id = ?");
    params.push(req.user?.id ?? "");
    conditions.push(`(${scopedConditions.join(" OR ")})`);
  }

  return { conditions, params };
}

export function getFieldSetting(fields: CallFormFieldRow[], key: string) {
  return fields.find((field) => field.field_key === key);
}

export function fieldRequiresValue(fields: CallFormFieldRow[], key: string) {
  const field = getFieldSetting(fields, key);

  if (!field) {
    return false;
  }

  return field.is_active === 1 && field.is_visible === 1 && field.is_required === 1;
}

export function fieldIsEnabled(fields: CallFormFieldRow[], key: string) {
  const field = getFieldSetting(fields, key);

  if (!field) {
    return true;
  }

  return field.is_active === 1 && field.is_visible === 1;
}

export function fieldLabel(fields: CallFormFieldRow[], key: string) {
  return getFieldSetting(fields, key)?.label ?? key;
}

export function requiredFieldError(fields: CallFormFieldRow[], values: Record<string, unknown>) {
  const requiredKeys = [
    "phoneNumber",
    "studentTc",
    "studentName",
    "interactionType",
    "category",
    "issue",
    "initialNote",
    "priority",
  ];

  for (const key of requiredKeys) {
    if (fieldRequiresValue(fields, key) && !String(values[key] ?? "").trim()) {
      return `${fieldLabel(fields, key)} zorunludur.`;
    }
  }

  return null;
}

export function fieldAllowsEdit(fields: CallFormFieldRow[], key: string) {
  const field = getFieldSetting(fields, key);

  if (!field) {
    return true;
  }

  return field.is_active === 1 && field.is_visible === 1 && field.is_editable === 1;
}

export function shouldMaskField(req: AuthenticatedRequest, fields: CallFormFieldRow[], key: string) {
  const field = getFieldSetting(fields, key);

  return field?.is_masked === 1 && !hasPermission(req, "sensitive.view_unmasked");
}

export function isValidTurkishIdentityNumber(value: string) {
  if (!/^[1-9]\d{10}$/.test(value)) {
    return false;
  }

  const digits = value.split("").map(Number);
  const oddSum = digits[0]! + digits[2]! + digits[4]! + digits[6]! + digits[8]!;
  const evenSum = digits[1]! + digits[3]! + digits[5]! + digits[7]!;
  const tenthDigit = ((oddSum * 7 - evenSum) % 10 + 10) % 10;
  const eleventhDigit = digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;

  return digits[9]! === tenthDigit && digits[10]! === eleventhDigit;
}

export function isValidPhoneNumber(value: string | null) {
  return !value || /^[0-9+ ()-]{7,20}$/.test(value);
}
