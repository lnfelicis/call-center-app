import express, { type Router } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp, type AppRouters } from "../../../src/app.js";
import { readAppConfig } from "../../../src/config/app-config.js";
import { HttpError } from "../../../src/http/errors.js";
import type { AppLogger } from "../../../src/http/logger.js";

function createLoggerFake() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as AppLogger;
}

function createRouters(auth: Router = express.Router()): AppRouters {
  return {
    auth,
    admin: express.Router(),
    reports: express.Router(),
    calls: express.Router(),
    roles: express.Router(),
    settings: express.Router(),
    users: express.Router(),
    logs: express.Router(),
    notifications: express.Router(),
  };
}

describe("createApp", () => {
  it("creates the health route from explicit dependencies", async () => {
    const config = readAppConfig({ NODE_ENV: "test" });
    const app = createApp({
      config,
      logger: createLoggerFake(),
      routers: createRouters(),
    });

    await request(app).get("/health").expect(200, { status: "ok" });
  });

  it("uses injected routers and logs unexpected route errors before the exact 500", async () => {
    const failure = new Error("route failed");
    const auth = express.Router();
    auth.get("/boom", () => {
      throw failure;
    });
    const logger = createLoggerFake();
    const config = {
      ...readAppConfig({ NODE_ENV: "test" }),
      trustProxy: false,
      logLevel: "silent" as const,
    };
    const app = createApp({ config, logger, routers: createRouters(auth) });

    const response = await request(app).get("/auth/boom").expect(500);

    expect(response.body).toStrictEqual({ message: "Beklenmeyen bir hata oluştu." });
    expect(logger.error).toHaveBeenCalledWith({
      error: failure,
      method: "GET",
      path: "/auth/boom",
    });
  });

  it("enables trust proxy and returns known HttpError bodies without runtime logging", async () => {
    const auth = express.Router();
    auth.get("/known", () => {
      throw new HttpError(409, { message: "Bilinen hata." });
    });
    const logger = createLoggerFake();
    const config = {
      ...readAppConfig({ NODE_ENV: "test" }),
      trustProxy: true,
      logLevel: "silent" as const,
    };
    const app = createApp({ config, logger, routers: createRouters(auth) });

    expect(app.get("trust proxy")).toBe(true);
    const response = await request(app).get("/auth/known").expect(409);

    expect(response.body).toStrictEqual({ message: "Bilinen hata." });
    expect(logger.error).not.toHaveBeenCalled();
  });
});
