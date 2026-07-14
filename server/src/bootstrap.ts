import type { Server } from "node:http";
import { createApp, type AppRouters } from "./app.js";
import { createAppRouters } from "./composition/app-routers.js";
import { readAppConfig, type AppConfig } from "./config/app-config.js";
import type { Database } from "./database/database.js";
import { createPool } from "./database/mysql.js";
import { createLogger, type AppLogger } from "./http/logger.js";

export type RunningServer = {
  server: Server;
  shutdown: (signal?: string) => Promise<void>;
};

type StartServerOptions = {
  config?: AppConfig;
  database?: Database;
  logger?: AppLogger;
  routers?: AppRouters;
  installSignalHandlers?: boolean;
};

export function startServer(options: StartServerOptions = {}): RunningServer {
  const config = options.config ?? readAppConfig();
  const database = options.database ?? createPool(config.database);
  const logger = options.logger ?? createLogger(config.logLevel);
  const routers = options.routers ?? createAppRouters({ database });
  const app = createApp({ config, logger, routers });
  const server = app.listen(config.port, config.host, () => {
    logger.info({ port: config.port }, `Server is running on http://localhost:${config.port}`);
  });
  let shutdownPromise: Promise<void> | undefined;

  const shutdown = (signal = "manual") => {
    shutdownPromise ??= new Promise<void>((resolve) => {
      logger.info({ signal }, "Server shutdown started");
      const forceCloseTimer = setTimeout(() => {
        logger.warn({ timeoutMs: config.shutdownTimeoutMs }, "Server shutdown timed out");
        server.closeAllConnections();
      }, config.shutdownTimeoutMs);
      forceCloseTimer.unref();

      server.close((serverError) => {
        void database
          .end()
          .catch((databaseError: unknown) => {
            logger.error({ error: databaseError }, "Database shutdown failed");
          })
          .finally(() => {
            clearTimeout(forceCloseTimer);
            if (serverError) {
              logger.error({ error: serverError }, "HTTP server shutdown failed");
            }
            resolve();
          });
      });
    });

    return shutdownPromise;
  };

  if (options.installSignalHandlers !== false) {
    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.once("SIGTERM", () => void shutdown("SIGTERM"));
  }

  return { server, shutdown };
}
