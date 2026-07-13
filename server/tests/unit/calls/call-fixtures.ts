import type { AuthenticatedRequest } from "../../../src/auth.js";
import type {
  CallFormFieldRow,
  CallRow,
} from "../../../src/modules/calls/call.types.js";

type CallRowField =
  | "id"
  | "record_number"
  | "phone_number"
  | "student_tc"
  | "student_name"
  | "interaction_type"
  | "category"
  | "sub_category"
  | "issue"
  | "initial_note"
  | "priority"
  | "status"
  | "needs_follow_up"
  | "follow_up_at"
  | "opened_by_user_id"
  | "opened_by_name"
  | "assigned_to_user_id"
  | "assigned_to_name"
  | "resolved_by_user_id"
  | "resolved_by_name"
  | "resolved_at"
  | "resolution_description"
  | "resolution_category"
  | "is_locked"
  | "created_at"
  | "updated_at";

type CallFieldSettingKey =
  | "field_key"
  | "label"
  | "is_active"
  | "is_required"
  | "is_visible"
  | "is_editable"
  | "is_masked"
  | "sort_order";

export function createCallRequest(
  permissions: string[],
  id = "user-1",
) {
  return {
    user: {
      id,
      username: "agent",
      fullName: "Agent One",
      email: "agent@example.com",
      roleId: "role-1",
      roleName: "Agent",
      permissions,
    },
  } as AuthenticatedRequest;
}

export function createCallRow(
  overrides: Partial<Pick<CallRow, CallRowField>> = {},
) {
  return {
    id: "call-1",
    record_number: "CAG-20260713-090807-ABCDEF",
    phone_number: "05551234567",
    student_tc: "10000000146",
    student_name: "Student One",
    interaction_type: "phone",
    category: "registration",
    sub_category: null,
    issue: "Issue",
    initial_note: "Initial note",
    priority: "normal",
    status: "open",
    needs_follow_up: 0,
    follow_up_at: null,
    opened_by_user_id: "owner-1",
    opened_by_name: "Owner One",
    assigned_to_user_id: "assigned-1",
    assigned_to_name: "Assigned One",
    resolved_by_user_id: null,
    resolved_by_name: null,
    resolved_at: null,
    resolution_description: null,
    resolution_category: null,
    is_locked: 0,
    created_at: "2026-07-13 09:08:07",
    updated_at: "2026-07-13 09:08:07",
    ...overrides,
  } as CallRow;
}

export function createField(
  fieldKey: string,
  overrides: Partial<Pick<CallFormFieldRow, CallFieldSettingKey>> = {},
) {
  return {
    field_key: fieldKey,
    label: fieldKey,
    is_active: 1,
    is_required: 0,
    is_visible: 1,
    is_editable: 1,
    is_masked: 0,
    sort_order: 0,
    ...overrides,
  } as CallFormFieldRow;
}
