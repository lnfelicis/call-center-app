import type { AuthenticatedRequest } from "../auth/types.js";
import { hasPermission, shouldMaskField } from "./call.policy.js";
import type {
  CallFormFieldRow,
  CallOptionRow,
  CallRow,
  EventRow,
  NoteRow,
  UserOptionRow,
} from "./call.types.js";

export function serializeOption(row: CallOptionRow) {
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

export function serializeField(row: CallFormFieldRow) {
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

export function maskPhone(phone: string) {
  if (phone.length < 6) {
    return "***";
  }

  return `${phone.slice(0, 4)} *** ** ${phone.slice(-2)}`;
}

export function maskTc(tc: string | null) {
  if (!tc) {
    return null;
  }

  return `${tc.slice(0, 3)}******${tc.slice(-2)}`;
}

export function serializeCall(req: AuthenticatedRequest, call: CallRow, fields: CallFormFieldRow[] = []) {
  const canViewSensitive = hasPermission(req, "sensitive.view_unmasked");
  const maskPhoneNumber = !canViewSensitive && shouldMaskField(req, fields, "phoneNumber");
  const maskStudentTc = !canViewSensitive && shouldMaskField(req, fields, "studentTc");

  return {
    id: call.id,
    recordNumber: call.record_number,
    phoneNumber: maskPhoneNumber ? maskPhone(call.phone_number) : call.phone_number,
    studentTc: maskStudentTc ? maskTc(call.student_tc) : call.student_tc,
    studentName: call.student_name,
    interactionType: call.interaction_type,
    category: call.category,
    subCategory: call.sub_category,
    issue: call.issue,
    initialNote: call.initial_note,
    priority: call.priority,
    status: call.status,
    needsFollowUp: call.needs_follow_up === 1,
    followUpAt: call.follow_up_at,
    openedByUserId: call.opened_by_user_id,
    openedByName: call.opened_by_name,
    assignedToUserId: call.assigned_to_user_id,
    assignedToName: call.assigned_to_name,
    resolvedByUserId: call.resolved_by_user_id,
    resolvedByName: call.resolved_by_name,
    resolvedAt: call.resolved_at,
    resolutionDescription: call.resolution_description,
    resolutionCategory: call.resolution_category,
    isLocked: call.is_locked === 1,
    createdAt: call.created_at,
    updatedAt: call.updated_at,
  };
}

export function serializeNote(note: NoteRow) {
  return {
    id: note.id,
    callId: note.call_id,
    authorUserId: note.author_user_id,
    authorName: note.author_name,
    noteType: note.note_type,
    content: note.content,
    createdAt: note.created_at,
  };
}

export function serializeEvent(event: EventRow) {
  return {
    id: event.id,
    callId: event.call_id,
    actorUserId: event.actor_user_id,
    actorName: event.actor_name,
    eventType: event.event_type,
    description: event.description,
    metadata: event.metadata,
    createdAt: event.created_at,
  };
}

export function serializeUserOption(row: UserOptionRow) {
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
  };
}
