import { describe, expect, it } from "vitest";
import { mapAuditLogRow } from "../../../src/modules/logs/mapper.js";
import type { AuditLogRow } from "../../../src/modules/logs/types.js";

describe("audit log mapper", () => {
  it("keeps metadata untouched and maps the existing response shape", () => {
    const metadata = { status: "open" };
    const result = mapAuditLogRow({
      id: "log-1",
      actor_user_id: null,
      actor_username: null,
      action: "call.create",
      entity_type: "call",
      entity_id: "call-1",
      metadata,
      ip_address: "10.0.0.8",
      user_agent: "test-agent",
      created_at: "2026-07-13 10:00:00",
    } as AuditLogRow);

    expect(result).toStrictEqual({
      id: "log-1",
      actorUserId: null,
      actorUsername: null,
      action: "call.create",
      entityType: "call",
      entityId: "call-1",
      metadata,
      ipAddress: "10.0.0.8",
      userAgent: "test-agent",
      createdAt: "2026-07-13 10:00:00",
    });
    expect(result.metadata).toBe(metadata);
  });
});
