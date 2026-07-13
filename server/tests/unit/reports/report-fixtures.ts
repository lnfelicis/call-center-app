import type { AuthUser } from "../../../src/auth.js";
import type {
  CallSearchRow,
  ReportCall,
  ReportOptionLabelMap,
} from "../../../src/modules/reports/types.js";

export function createReportUser(
  permissions: string[] = [],
): AuthUser {
  return {
    id: "user-1",
    username: "operator",
    fullName: "Test Operatör",
    email: "operator@example.com",
    roleId: "role-1",
    roleName: "Operatör",
    permissions,
  };
}

export function createCallSearchRow(): CallSearchRow {
  return {
    id: "call-1",
    record_number: "CALL-2026-0001",
    phone_number: "05551234567",
    student_tc: "12345678901",
    student_name: "Ayşe Yılmaz",
    interaction_type: "incoming",
    category: "registration",
    priority: "urgent",
    status: "open",
    needs_follow_up: 1,
    follow_up_at: "2026-07-14T09:00:00.000Z",
    opened_by_user_id: "user-1",
    opened_by_name: "Test Operatör",
    assigned_to_user_id: "user-2",
    assigned_to_name: "Atanan Kullanıcı",
    resolved_by_user_id: null,
    resolved_by_name: null,
    resolved_at: null,
    created_at: "2026-07-13T08:30:00.000Z",
    updated_at: "2026-07-13T08:45:00.000Z",
  } as CallSearchRow;
}

export function createReportCall(): ReportCall {
  return {
    id: "call-1",
    recordNumber: "CALL-2026-0001",
    phoneNumber: "0555 *** ** 67",
    studentTc: "123******01",
    studentName: "Ayşe Yılmaz",
    interactionType: "incoming",
    category: "registration",
    priority: "urgent",
    status: "open",
    needsFollowUp: true,
    followUpAt: "2026-07-14T09:00:00.000Z",
    openedByUserId: "user-1",
    openedByName: "Test Operatör",
    assignedToUserId: "user-2",
    assignedToName: "Atanan Kullanıcı",
    resolvedByUserId: null,
    resolvedByName: null,
    resolvedAt: null,
    createdAt: "2026-07-13T08:30:00.000Z",
    updatedAt: "2026-07-13T08:45:00.000Z",
  };
}

export function createLabelMap(): ReportOptionLabelMap {
  return {
    priority: new Map([["urgent", "Acil"]]),
    status: new Map([["open", "Açık"]]),
  };
}
