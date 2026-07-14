import type { AuthUser } from "../auth/types.js";
import { hasPermission, maskPhone, maskTc } from "./policy.js";
import type {
  BreakdownRow,
  CallSearchRow,
  CategoryRow,
  ReportCall,
  ReportFilterOptionRow,
  ReportOptionLabelMap,
  StaffRow,
  SummaryRow,
} from "./types.js";

export function serializeSearchRow(
  user: AuthUser | undefined,
  row: CallSearchRow,
): ReportCall {
  const canViewSensitive = hasPermission(user, "sensitive.view_unmasked");

  return {
    id: row.id,
    recordNumber: row.record_number,
    phoneNumber: canViewSensitive ? row.phone_number : maskPhone(row.phone_number),
    studentTc: canViewSensitive ? row.student_tc : maskTc(row.student_tc),
    studentName: row.student_name,
    interactionType: row.interaction_type,
    category: row.category,
    priority: row.priority,
    status: row.status,
    needsFollowUp: row.needs_follow_up === 1,
    followUpAt: row.follow_up_at,
    openedByUserId: row.opened_by_user_id,
    openedByName: row.opened_by_name,
    assignedToUserId: row.assigned_to_user_id,
    assignedToName: row.assigned_to_name,
    resolvedByUserId: row.resolved_by_user_id,
    resolvedByName: row.resolved_by_name,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapFilterOptions(rows: ReportFilterOptionRow[]) {
  return {
    options: rows.map((row) => ({
      id: row.id,
      type: row.option_type,
      label: row.label,
      value: row.value ?? row.label,
      color: row.color,
      isActive: true,
      sortOrder: row.sort_order,
    })),
  };
}

export function mapSummary(
  summaryRows: SummaryRow[],
  statusRows: BreakdownRow[],
  priorityRows: BreakdownRow[],
) {
  const summary = summaryRows[0] ?? {
    total: 0,
    open_total: 0,
    resolved_total: 0,
    follow_up_total: 0,
    urgent_total: 0,
  };

  return {
    summary: {
      total: Number(summary.total ?? 0),
      open: Number(summary.open_total ?? 0),
      resolved: Number(summary.resolved_total ?? 0),
      followUp: Number(summary.follow_up_total ?? 0),
      urgent: Number(summary.urgent_total ?? 0),
    },
    byStatus: statusRows,
    byPriority: priorityRows,
  };
}

export function mapStaff(rows: StaffRow[]) {
  return {
    staff: rows.map((row) => ({
      userId: row.user_id,
      fullName: row.full_name,
      openedTotal: Number(row.opened_total ?? 0),
      resolvedTotal: Number(row.resolved_total ?? 0),
    })),
  };
}

export function mapCategories(rows: CategoryRow[]) {
  return {
    categories: rows.map((row) => ({
      category: row.category,
      total: Number(row.total ?? 0),
      openTotal: Number(row.open_total ?? 0),
      resolvedTotal: Number(row.resolved_total ?? 0),
    })),
  };
}

export function createReportOptionLabelMap(
  rows: ReportFilterOptionRow[],
): ReportOptionLabelMap {
  const labels: ReportOptionLabelMap = {
    priority: new Map<string, string>(),
    status: new Map<string, string>(),
  };

  rows.forEach((row) => {
    if (row.option_type === "priority" || row.option_type === "status") {
      labels[row.option_type].set(row.value ?? row.label, row.label);
    }
  });

  return labels;
}

export function getOptionLabel(labels: Map<string, string>, value: string) {
  return labels.get(value) ?? value;
}
