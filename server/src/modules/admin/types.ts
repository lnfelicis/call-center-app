import type { RowDataPacket } from "mysql2";

export type CountRow = RowDataPacket & { total: number };
export type StatusRow = RowDataPacket & { status: string; total: number };

export type RecentCallRow = RowDataPacket & {
  id: string;
  record_number: string;
  status: string;
  priority: string;
  opened_by_name: string;
  resolved_at: string | null;
  created_at: string;
};

export type RecentLogRow = RowDataPacket & {
  id: string;
  actor_username: string | null;
  action: string;
  entity_type: string;
  created_at: string;
};

export type DashboardRows = {
  callCounts: CountRow[];
  userCounts: CountRow[];
  roleCounts: CountRow[];
  openCounts: CountRow[];
  followUpCounts: CountRow[];
  statusRows: StatusRow[];
  recentCalls: RecentCallRow[];
  recentLogs: RecentLogRow[];
};
