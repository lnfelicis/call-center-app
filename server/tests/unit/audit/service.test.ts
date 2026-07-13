import type { Request } from "express";
import { describe, expect, it, vi } from "vitest";
import type { AuditRepository } from "../../../src/modules/audit/repository.js";
import { createAuditWriter } from "../../../src/modules/audit/service.js";
import type { AuthenticatedRequest } from "../../../src/modules/auth/types.js";

describe("audit writer", () => {
  it("persists actor, metadata, IP and user agent with injected ID generation", async () => {
    const repository = { insert: vi.fn().mockResolvedValue(undefined) } as unknown as AuditRepository;
    const request = {
      user: { id: "actor-1" },
      header: vi.fn().mockReturnValue("test-agent"),
    } as unknown as AuthenticatedRequest;
    const writer = createAuditWriter({
      repository,
      idGenerator: () => "audit-1",
      getClientIp: () => "10.0.0.8",
    });

    await writer({
      req: request,
      action: "user.update",
      entityType: "user",
      entityId: "user-1",
      metadata: { roleId: "role-1" },
    });

    expect(repository.insert).toHaveBeenCalledWith({
      id: "audit-1",
      actorUserId: "actor-1",
      action: "user.update",
      entityType: "user",
      entityId: "user-1",
      metadata: '{"roleId":"role-1"}',
      ipAddress: "10.0.0.8",
      userAgent: "test-agent",
    });
  });

  it("keeps null/default values for unauthenticated audit events", async () => {
    const repository = { insert: vi.fn().mockResolvedValue(undefined) } as unknown as AuditRepository;
    const request = { header: vi.fn().mockReturnValue(undefined) } as unknown as Request;
    const writer = createAuditWriter({
      repository,
      idGenerator: () => "audit-1",
      getClientIp: () => null,
    });

    await writer({ req: request, action: "auth.login", entityType: "user" });

    expect(repository.insert).toHaveBeenCalledWith({
      id: "audit-1",
      actorUserId: null,
      action: "auth.login",
      entityType: "user",
      entityId: null,
      metadata: "{}",
      ipAddress: null,
      userAgent: null,
    });
  });
});
