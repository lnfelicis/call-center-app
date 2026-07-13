import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import { AuditRepository } from "./modules/audit/repository.js";
import { createAuditWriter } from "./modules/audit/service.js";
import { getClientIp } from "./modules/auth/request-ip.js";

export type { AuditInput, AuditWriter } from "./modules/audit/types.js";

const auditRepository = new AuditRepository(db);

export const writeAuditLog = createAuditWriter({
  repository: auditRepository,
  idGenerator: randomUUID,
  getClientIp,
});
