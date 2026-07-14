import type { AuthUser } from "../auth/types.js";
import type { ReportQuery, SearchQuery } from "./types.js";

export function hasPermission(user: AuthUser | undefined, permission: string) {
  return user?.permissions.includes(permission) ?? false;
}

export function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeDate(value: unknown) {
  const text = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

export function normalizePhone(value: unknown) {
  return normalizeText(value).replace(/\D/g, "");
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

export function buildSearchQuery(
  query: ReportQuery,
  user: AuthUser | undefined,
): SearchQuery {
  const params: Array<string | number> = [];
  const conditions: string[] = [];

  if (!hasPermission(user, "calls.view.all")) {
    const scopedConditions: string[] = [];

    if (hasPermission(user, "calls.view.own")) {
      scopedConditions.push("call_records.opened_by_user_id = ?");
      params.push(user?.id ?? "");
    }

    scopedConditions.push("call_records.assigned_to_user_id = ?");
    params.push(user?.id ?? "");
    conditions.push(`(${scopedConditions.join(" OR ")})`);
  }

  const phone = normalizePhone(query.phoneNumber);
  const studentTc = normalizeText(query.studentTc);
  const studentName = normalizeText(query.studentName);
  const recordNumber = normalizeText(query.recordNumber);
  const category = normalizeText(query.category);
  const status = normalizeText(query.status);
  const priority = normalizeText(query.priority);
  const openedByUserId = normalizeText(query.openedByUserId);
  const assignedToUserId = normalizeText(query.assignedToUserId);
  const resolvedByUserId = normalizeText(query.resolvedByUserId);
  const dateFrom = normalizeDate(query.dateFrom);
  const dateTo = normalizeDate(query.dateTo);
  const followUpFrom = normalizeDate(query.followUpFrom);
  const followUpTo = normalizeDate(query.followUpTo);
  const slaStatus = normalizeText(query.slaStatus);

  if (phone) {
    conditions.push("REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(call_records.phone_number, ' ', ''), '+', ''), '-', ''), '(', ''), ')', '') LIKE ?");
    params.push(`%${phone}%`);
  }

  if (studentTc) {
    conditions.push("call_records.student_tc LIKE ?");
    params.push(`%${studentTc}%`);
  }

  if (studentName) {
    conditions.push("call_records.student_name LIKE ?");
    params.push(`%${studentName}%`);
  }

  if (recordNumber) {
    conditions.push("call_records.record_number LIKE ?");
    params.push(`%${recordNumber}%`);
  }

  if (category && category !== "all") {
    conditions.push("call_records.category = ?");
    params.push(category);
  }

  if (status && status !== "all") {
    conditions.push("call_records.status = ?");
    params.push(status);
  }

  if (priority && priority !== "all") {
    conditions.push("call_records.priority = ?");
    params.push(priority);
  }

  if (hasPermission(user, "calls.view.all")) {
    if (openedByUserId) {
      conditions.push("call_records.opened_by_user_id = ?");
      params.push(openedByUserId);
    }

    if (assignedToUserId) {
      conditions.push("call_records.assigned_to_user_id = ?");
      params.push(assignedToUserId);
    }

    if (resolvedByUserId) {
      conditions.push("call_records.resolved_by_user_id = ?");
      params.push(resolvedByUserId);
    }
  }

  if (dateFrom) {
    conditions.push("DATE(call_records.created_at) >= ?");
    params.push(dateFrom);
  }

  if (dateTo) {
    conditions.push("DATE(call_records.created_at) <= ?");
    params.push(dateTo);
  }

  if (followUpFrom) {
    conditions.push("DATE(call_records.follow_up_at) >= ?");
    params.push(followUpFrom);
  }

  if (followUpTo) {
    conditions.push("DATE(call_records.follow_up_at) <= ?");
    params.push(followUpTo);
  }

  if (slaStatus === "overdue") {
    conditions.push("call_records.follow_up_at IS NOT NULL AND call_records.follow_up_at < NOW() AND call_records.status NOT IN ('resolved', 'closed', 'archived', 'cancelled')");
  } else if (slaStatus === "resolved") {
    conditions.push("call_records.status IN ('resolved', 'closed')");
  } else if (slaStatus === "active") {
    conditions.push("call_records.status NOT IN ('resolved', 'closed', 'archived', 'cancelled')");
  }

  return {
    params,
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
  };
}
