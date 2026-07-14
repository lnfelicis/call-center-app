import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../../../src/config/app-config.js";
import type { Database } from "../../../src/database/database.js";
import type { AppLogger } from "../../../src/http/logger.js";

const mocks = vi.hoisted(() => {
  const closeCallbacks: Array<(error?: Error) => void> = [];
  const server = {
    close: vi.fn((callback: (error?: Error) => void) => {
      closeCallbacks.push(callback);
      return server;
    }),
    closeAllConnections: vi.fn(),
  };
  const listen = vi.fn((_port: number, _host: string, callback: () => void) => {
    callback();
    return server;
  });
  const createApp = vi.fn(() => ({ listen }));
  const defaultConfig = {
    port: 3000,
    host: "0.0.0.0",
    logLevel: "silent",
    shutdownTimeoutMs: 100,
    database: { marker: "default-database-config" },
  };
  const readAppConfig = vi.fn(() => defaultConfig);
  const defaultDatabase = { end: vi.fn().mockResolvedValue(undefined) };
  const defaultLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const createLogger = vi.fn(() => defaultLogger);
  const defaultRouters = { marker: "default-routers" };
  const createPool = vi.fn(() => defaultDatabase);
  const createAppRouters = vi.fn(() => defaultRouters);

  return {
    closeCallbacks,
    server,
    listen,
    createApp,
    defaultConfig,
    readAppConfig,
    defaultDatabase,
    defaultLogger,
    createLogger,
    defaultRouters,
    createPool,
    createAppRouters,
  };
});

vi.mock("../../../src/app.js", () => ({ createApp: mocks.createApp }));
vi.mock("../../../src/composition/app-routers.js", () => ({
  createAppRouters: mocks.createAppRouters,
}));
vi.mock("../../../src/config/app-config.js", () => ({ readAppConfig: mocks.readAppConfig }));
vi.mock("../../../src/database/mysql.js", () => ({ createPool: mocks.createPool }));
vi.mock("../../../src/http/logger.js", () => ({ createLogger: mocks.createLogger }));

import { startServer } from "../../../src/bootstrap.js";

function createLoggerFake() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as AppLogger;
}

function createConfig(overrides: Partial<AppConfig> = {}) {
  return {
    ...mocks.defaultConfig,
    ...overrides,
  } as AppConfig;
}

describe("bootstrap branches", () => {
  beforeEach(() => {
    mocks.closeCallbacks.length = 0;
    mocks.defaultDatabase.end.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses defaults and wires both signal callbacks to one shutdown", async () => {
    const handlers = new Map<string, () => void>();
    const once = vi.spyOn(process, "once").mockImplementation((event, listener) => {
      handlers.set(String(event), listener as () => void);
      return process;
    });

    const running = startServer();

    expect(mocks.readAppConfig).toHaveBeenCalledOnce();
    expect(mocks.createLogger).toHaveBeenCalledWith("silent");
    expect(mocks.createPool).toHaveBeenCalledWith(mocks.defaultConfig.database);
    expect(mocks.createAppRouters).toHaveBeenCalledWith({
      database: mocks.defaultDatabase,
    });
    expect(mocks.createApp).toHaveBeenCalledWith({
      config: mocks.defaultConfig,
      logger: mocks.defaultLogger,
      routers: mocks.defaultRouters,
    });
    expect(mocks.listen).toHaveBeenCalledWith(3000, "0.0.0.0", expect.any(Function));
    expect(mocks.defaultLogger.info).toHaveBeenCalledWith(
      { port: 3000 },
      "Server is running on http://localhost:3000",
    );
    expect(once).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(once).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    expect(running.server).toBe(mocks.server);

    handlers.get("SIGINT")?.();
    handlers.get("SIGTERM")?.();
    expect(mocks.server.close).toHaveBeenCalledOnce();
    mocks.closeCallbacks[0]?.();
    await running.shutdown();
    expect(mocks.defaultDatabase.end).toHaveBeenCalledOnce();
  });

  it("uses injected dependencies, skips signal handlers and shares one shutdown promise", async () => {
    const once = vi.spyOn(process, "once").mockImplementation(() => process);
    const logger = createLoggerFake();
    const database = { end: vi.fn().mockResolvedValue(undefined) } as unknown as Database;
    const config = createConfig({ port: 4321, shutdownTimeoutMs: 250 });
    const running = startServer({
      config,
      database,
      logger,
      installSignalHandlers: false,
    });

    const first = running.shutdown();
    const second = running.shutdown("ignored-second-signal");
    expect(first).toBe(second);
    expect(once).not.toHaveBeenCalled();
    expect(mocks.server.close).toHaveBeenCalledOnce();

    mocks.closeCallbacks[0]?.();
    await first;

    expect(logger.info).toHaveBeenCalledWith({ signal: "manual" }, "Server shutdown started");
    expect(mocks.createPool).not.toHaveBeenCalled();
    expect(mocks.createAppRouters).toHaveBeenCalledWith({ database });
    expect(database.end).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("uses explicitly supplied routers without running default composition", async () => {
    const logger = createLoggerFake();
    const database = { end: vi.fn().mockResolvedValue(undefined) } as unknown as Database;
    const routers = { marker: "injected-routers" } as never;
    const running = startServer({
      config: createConfig(),
      database,
      logger,
      routers,
      installSignalHandlers: false,
    });

    expect(mocks.createAppRouters).not.toHaveBeenCalled();
    expect(mocks.createApp).toHaveBeenCalledWith({
      config: expect.any(Object),
      logger,
      routers,
    });

    const shutdown = running.shutdown("test");
    mocks.closeCallbacks[0]?.();
    await shutdown;
    expect(database.end).toHaveBeenCalledOnce();
  });

  it("force-closes timed-out connections and logs database and HTTP close failures", async () => {
    vi.useFakeTimers();
    const logger = createLoggerFake();
    const databaseError = new Error("database close failed");
    const serverError = new Error("server close failed");
    const database = { end: vi.fn().mockRejectedValue(databaseError) } as unknown as Database;
    const config = createConfig({ shutdownTimeoutMs: 50 });
    const running = startServer({
      config,
      database,
      logger,
      installSignalHandlers: false,
    });

    const shutdown = running.shutdown("SIGTERM");
    vi.advanceTimersByTime(50);

    expect(logger.warn).toHaveBeenCalledWith(
      { timeoutMs: 50 },
      "Server shutdown timed out",
    );
    expect(mocks.server.closeAllConnections).toHaveBeenCalledOnce();

    mocks.closeCallbacks[0]?.(serverError);
    await shutdown;

    expect(logger.error).toHaveBeenCalledWith(
      { error: databaseError },
      "Database shutdown failed",
    );
    expect(logger.error).toHaveBeenCalledWith(
      { error: serverError },
      "HTTP server shutdown failed",
    );
  });
});
