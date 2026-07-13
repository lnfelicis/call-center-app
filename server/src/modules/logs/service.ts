import { mapAuditLogRow } from "./mapper.js";
import type { LogRepository } from "./repository.js";

export class LogService {
  constructor(private readonly repository: Pick<LogRepository, "listRecent">) {}

  async listRecent() {
    return (await this.repository.listRecent()).map(mapAuditLogRow);
  }
}
