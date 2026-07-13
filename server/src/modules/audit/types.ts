import type { Request } from "express";

export type AuditInput = {
  req: Request;
  action: string;
  entityType: string;
  entityId?: string | null | undefined;
  metadata?: Record<string, unknown> | undefined;
};

export type AuditWriter = (input: AuditInput) => Promise<void>;

export type AuditRecord = {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: string;
  ipAddress: string | null;
  userAgent: string | null;
};
