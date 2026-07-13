import type { Request, Response } from "express";
import type { AdminService } from "./service.js";

export class AdminController {
  constructor(private readonly service: AdminService) {}

  dashboard = async (_req: Request, res: Response) => {
    res.json(await this.service.getDashboard());
  };
}
