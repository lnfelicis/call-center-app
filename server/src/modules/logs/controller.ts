import type { Request, Response } from "express";
import type { LogService } from "./service.js";

export class LogController {
  constructor(private readonly service: LogService) {}

  list = async (_req: Request, res: Response) => {
    res.json({ logs: await this.service.listRecent() });
  };
}
