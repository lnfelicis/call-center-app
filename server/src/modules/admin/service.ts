import { mapDashboard } from "./mapper.js";
import type { AdminRepository } from "./repository.js";

export class AdminService {
  constructor(private readonly repository: Pick<AdminRepository, "getDashboardRows">) {}

  async getDashboard() {
    return mapDashboard(await this.repository.getDashboardRows());
  }
}
