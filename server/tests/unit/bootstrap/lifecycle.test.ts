import { once } from "node:events";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { readAppConfig } from "../../../src/config/app-config.js";
import type { Database } from "../../../src/database/database.js";
import type { AppLogger } from "../../../src/http/logger.js";
import { startServer } from "../../../src/bootstrap.js";

function createLoggerFake() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as AppLogger;
}

describe("server lifecycle", () => {
  it("listens independently from app creation and closes HTTP before the pool", async () => {
    const end = vi.fn().mockResolvedValue(undefined);
    const database = { end } as unknown as Database;
    const running = startServer({
      config: {
        ...readAppConfig({ NODE_ENV: "test" }),
        port: 0,
        shutdownTimeoutMs: 500,
      },
      database,
      logger: createLoggerFake(),
      installSignalHandlers: false,
    });

    if (!running.server.listening) {
      await once(running.server, "listening");
    }

    expect((running.server.address() as AddressInfo).port).toBeGreaterThan(0);
    await request(running.server).get("/health").expect(200, { status: "ok" });

    await running.shutdown("test");
    await running.shutdown("test-again");

    expect(running.server.listening).toBe(false);
    expect(end).toHaveBeenCalledOnce();
  });
});
