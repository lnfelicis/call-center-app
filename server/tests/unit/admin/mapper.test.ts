import { describe, expect, it } from "vitest";
import { mapDashboard } from "../../../src/modules/admin/mapper.js";
import type { DashboardRows } from "../../../src/modules/admin/types.js";

describe("admin dashboard mapper", () => {
  it("keeps metrics, recent data shapes, defaults and key order", () => {
    const result = mapDashboard({
      callCounts: [{ total: 12 }],
      userCounts: [],
      roleCounts: [{ total: 3 }],
      openCounts: [{ total: 5 }],
      followUpCounts: [{ total: 2 }],
      statusRows: [{ status: "open", total: 5 }],
      recentCalls: [{
        id: "call-1",
        record_number: "C-1",
        status: "open",
        priority: "urgent",
        opened_by_name: "Ömer Test",
        resolved_at: null,
        created_at: "2026-07-13 10:00:00",
      }],
      recentLogs: [{
        id: "log-1",
        actor_username: null,
        action: "auth.login",
        entity_type: "user",
        created_at: "2026-07-13 10:00:00",
      }],
    } as DashboardRows);

    expect(result).toStrictEqual({
      metrics: {
        totalCalls: 12,
        openCalls: 5,
        followUpCalls: 2,
        totalUsers: 0,
        activeRoles: 3,
      },
      callsByStatus: [{ status: "open", total: 5 }],
      recentCalls: [{
        id: "call-1",
        recordNumber: "C-1",
        status: "open",
        priority: "urgent",
        openedByName: "Ömer Test",
        resolvedAt: null,
        createdAt: "2026-07-13 10:00:00",
      }],
      recentLogs: [{
        id: "log-1",
        actorUsername: null,
        action: "auth.login",
        entityType: "user",
        createdAt: "2026-07-13 10:00:00",
      }],
    });
    expect(Object.keys(result)).toStrictEqual([
      "metrics",
      "callsByStatus",
      "recentCalls",
      "recentLogs",
    ]);
  });

  it("defaults every missing metric count to zero", () => {
    const result = mapDashboard({
      callCounts: [],
      userCounts: [],
      roleCounts: [],
      openCounts: [],
      followUpCounts: [],
      statusRows: [],
      recentCalls: [],
      recentLogs: [],
    });

    expect(result.metrics).toStrictEqual({
      totalCalls: 0,
      openCalls: 0,
      followUpCalls: 0,
      totalUsers: 0,
      activeRoles: 0,
    });
  });
});
