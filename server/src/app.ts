import cors from "cors";
import express from "express";
import type { AppRouters } from "./composition/app-routers.js";
import type { AppConfig } from "./config/app-config.js";
import { HttpError } from "./http/errors.js";
import { createRequestLogger, type AppLogger } from "./http/logger.js";

export type { AppRouters } from "./composition/app-routers.js";

export type AppDependencies = {
  config: AppConfig;
  logger: AppLogger;
  routers: AppRouters;
};

export function createApp({ config, logger, routers }: AppDependencies) {
  const app = express();

  if (config.trustProxy) {
    app.set("trust proxy", true);
  }

  app.use(createRequestLogger(logger));
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", routers.auth);
  app.use(routers.admin);
  app.use(routers.reports);
  app.use(routers.calls);
  app.use(routers.roles);
  app.use(routers.settings);
  app.use(routers.users);
  app.use(routers.logs);
  app.use(routers.notifications);

  app.use(
    (
      error: unknown,
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof HttpError) {
        res.status(error.status).json(error.body);
        return;
      }

      logger.error({
        error,
        method: req.method,
        path: req.path,
      });
      res.status(500).json({ message: "Beklenmeyen bir hata oluştu." });
    },
  );

  return app;
}
