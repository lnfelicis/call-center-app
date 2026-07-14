import type { Request } from "express";
import type { RowDataPacket } from "mysql2";
import type { Database } from "../../database/database.js";
import type { AuthUser } from "../auth/types.js";

export type ReportDatabase = Pick<Database, "query">;

export type ReportQuery = Record<string, unknown>;

export type ReportRequestContext = {
  query: ReportQuery;
  request: Request;
  user: AuthUser | undefined;
};

export type CallSearchRow = RowDataPacket & {
  id: string;
  record_number: string;
  phone_number: string;
  student_tc: string | null;
  student_name: string | null;
  interaction_type: string;
  category: string;
  priority: string;
  status: string;
  needs_follow_up: 0 | 1;
  follow_up_at: string | null;
  opened_by_user_id: string;
  opened_by_name: string;
  assigned_to_user_id: string | null;
  assigned_to_name: string | null;
  resolved_by_user_id: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SummaryRow = RowDataPacket & {
  total: number;
  open_total: number;
  resolved_total: number;
  follow_up_total: number;
  urgent_total: number;
};

export type BreakdownRow = RowDataPacket & {
  label: string;
  total: number;
};

export type ReportFilterOptionRow = RowDataPacket & {
  id: string;
  option_type: "issue_category" | "status" | "priority";
  label: string;
  value: string | null;
  color: string | null;
  sort_order: number;
};

export type StaffRow = RowDataPacket & {
  user_id: string;
  full_name: string;
  opened_total: number;
  resolved_total: number;
};

export type CategoryRow = RowDataPacket & {
  category: string;
  total: number;
  open_total: number;
  resolved_total: number;
};

export type SearchQuery = {
  params: Array<string | number>;
  whereClause: string;
};

export type ReportCall = {
  id: string;
  recordNumber: string;
  phoneNumber: string;
  studentTc: string | null;
  studentName: string | null;
  interactionType: string;
  category: string;
  priority: string;
  status: string;
  needsFollowUp: boolean;
  followUpAt: string | null;
  openedByUserId: string;
  openedByName: string;
  assignedToUserId: string | null;
  assignedToName: string | null;
  resolvedByUserId: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReportOptionLabelMap = {
  priority: Map<string, string>;
  status: Map<string, string>;
};

export type ExportSummary = {
  title: string;
  createdAt: Date;
  rowCount: number;
  filters: string[];
};

export type ReportExporter = (
  rows: ReportCall[],
  summary: ExportSummary,
  labels: ReportOptionLabelMap,
) => Promise<Buffer>;

export type AuditWriter = (input: {
  req: Request;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) => Promise<void>;

export type Clock = () => Date;
