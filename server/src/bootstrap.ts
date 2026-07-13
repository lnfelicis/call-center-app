import type { Server } from "node:http";
import { createApp } from "./app.js";
import { readAppConfig, type AppConfig } from "./config/app-config.js";
import { db, type Database } from "./db.js";
import { createLogger, type AppLogger } from "./http/logger.js";

export type RunningServer = {
  server: Server;
  shutdown: (signal?: string) => Promise<void>;
};

type StartServerOptions = {
  config?: AppConfig;
  database?: Database;
  logger?: AppLogger;
  installSignalHandlers?: boolean;
};

export function startServer(options: StartServerOptions = {}): RunningServer {
  const config = options.config ?? readAppConfig();
  const database = options.database ?? db;
  const logger = options.logger ?? createLogger(config.logLevel);
  const app = createApp({ config, logger });
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
