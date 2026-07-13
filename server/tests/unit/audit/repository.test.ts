import { describe, expect, it, vi } from "vitest";
import { AuditRepository, type AuditDatabase } from "../../../src/modules/audit/repository.js";

describe("audit repository", () => {
  it("inserts every audit column in the existing parameter order", async () => {
    const database = { query: vi.fn().mockResolvedValue([{}, []]) } as unknown as AuditDatabase;
    const record = {
      id: "audit-1",
      actorUserId: "user-1",
      action: "user.update",
      entityType: "user",
      entityId: "user-2",
      metadata: '{"status":"active"}',
      ipAddress: "10.0.0.8",
      userAgent: "test-agent",
    };

    await new AuditRepository(database).insert(record);

    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining("VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
      [
        "audit-1",
        "user-1",
        "user.update",
        "user",
        "user-2",
        '{"status":"active"}',
        "10.0.0.8",
        "test-agent",
      ],
    );
  });
});
