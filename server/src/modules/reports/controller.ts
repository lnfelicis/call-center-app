import type { Response } from "express";
import type { AuthenticatedRequest } from "../../auth.js";
import type { ReportService } from "./service.js";
import type { ReportQuery } from "./types.js";

export type ReportController = ReturnType<typeof createReportController>;

export function createReportController(service: ReportService) {
  const createContext = (req: AuthenticatedRequest) => ({
    query: req.query as ReportQuery,
    request: req,
    user: req.user,
  });

  return {
    getFilters: async (_req: AuthenticatedRequest, res: Response) => {
      res.json(await service.getFilters());
    },

    searchCalls: async (req: AuthenticatedRequest, res: Response) => {
      res.json(await service.searchCalls(createContext(req)));
    },

    getSummary: async (_req: AuthenticatedRequest, res: Response) => {
      res.json(await service.getSummary());
    },

    getStaff: async (_req: AuthenticatedRequest, res: Response) => {
      res.json(await service.getStaff());
    },

    getCategories: async (_req: AuthenticatedRequest, res: Response) => {
      res.json(await service.getCategories());
    },

    exportReport: async (req: AuthenticatedRequest, res: Response) => {
      res.json(await service.exportReport(createContext(req)));
    },
  };
}
