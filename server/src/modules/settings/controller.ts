import type { Request, Response } from "express";
import type { SettingsService } from "./service.js";

function sendResult(res: Response, result: { status?: number; body: unknown }) {
  if (result.status) {
    res.status(result.status).json(result.body);
    return;
  }
  res.json(result.body);
}

export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  getSettings = async (_req: Request, res: Response) => {
    res.json(await this.service.readSettings());
  };

  getSecurity = async (_req: Request, res: Response) => {
    res.json(await this.service.readSecuritySettings());
  };

  updateSecurity = async (req: Request, res: Response) => {
    res.json(await this.service.updateSecuritySettings(req));
  };

  updateSettings = async (req: Request, res: Response) => {
    sendResult(res, await this.service.updateSettings(req));
  };

  getOptions = async (req: Request, res: Response) => {
    sendResult(res, await this.service.getOptions(req.params.type));
  };

  createOption = async (req: Request, res: Response) => {
    sendResult(res, await this.service.createOption(req));
  };

  updateOption = async (req: Request, res: Response) => {
    sendResult(res, await this.service.updateOption(req));
  };
}
