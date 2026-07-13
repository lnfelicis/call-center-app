import cors from "cors";
import express, { type Router } from "express";
import type { AppConfig } from "./config/app-config.js";
import { readAppConfig } from "./config/app-config.js";
import { HttpError } from "./http/errors.js";
import { createLogger, createRequestLogger, type AppLogger } from "./http/logger.js";
import { adminRoutes } from "./routes/adminRoutes.js";
import { authRoutes } from "./routes/authRoutes.js";
import { callRoutes } from "./routes/callRoutes.js";
import { logRoutes } from "./routes/logRoutes.js";
import { notificationRoutes } from "./routes/notificationRoutes.js";
import { reportRoutes } from "./routes/reportRoutes.js";
import { roleRoutes } from "./routes/roleRoutes.js";
import { settingRoutes } from "./routes/settingRoutes.js";
import { userRoutes } from "./routes/userRoutes.js";

export type AppRouters = {
  auth: Router;
  admin: Router;
  reports: Router;
  calls: Router;
  roles: Router;
  settings: Router;
  users: Router;
  logs: Router;
  notifications: Router;
};

export type AppDependencies = {
  config: AppConfig;
  logger: AppLogger;
  routers: AppRouters;
};

const defaultRouters: AppRouters = {
  auth: authRoutes,
  admin: adminRoutes,
  reports: reportRoutes,
  calls: callRoutes,
  roles: roleRoutes,
  settings: settingRoutes,
  users: userRoutes,
  logs: logRoutes,
  notifications: notificationRoutes,
};

export function createApp(overrides: Partial<AppDependencies> = {}) {
  const config = overrides.config ?? readAppConfig();
  const logger = overrides.logger ?? createLogger(config.logLevel);
  const routers = overrides.routers ?? defaultRouters;
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
