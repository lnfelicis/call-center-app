import type { DashboardRows } from "./types.js";

export function mapDashboard(rows: DashboardRows) {
  return {
    metrics: {
      totalCalls: rows.callCounts[0]?.total ?? 0,
      openCalls: rows.openCounts[0]?.total ?? 0,
      followUpCalls: rows.followUpCounts[0]?.total ?? 0,
      totalUsers: rows.userCounts[0]?.total ?? 0,
      activeRoles: rows.roleCounts[0]?.total ?? 0,
    },
    callsByStatus: rows.statusRows.map((row) => ({
      status: row.status,
      total: row.total,
    })),
    recentCalls: rows.recentCalls.map((call) => ({
      id: call.id,
      recordNumber: call.record_number,
      status: call.status,
      priority: call.priority,
      openedByName: call.opened_by_name,
      resolvedAt: call.resolved_at,
      createdAt: call.created_at,
    })),
    recentLogs: rows.recentLogs.map((log) => ({
      id: log.id,
      actorUsername: log.actor_username,
      action: log.action,
      entityType: log.entity_type,
      createdAt: log.created_at,
    })),
  };
}
