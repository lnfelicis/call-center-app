import request from "supertest";
import { Router } from "express";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createAppRouters } from "../../src/composition/app-routers.js";
import { readAppConfig } from "../../src/config/app-config.js";
import type { Database } from "../../src/database/database.js";
import { createLogger } from "../../src/http/logger.js";
import { HttpError } from "../../src/http/errors.js";
import { apiRouteManifest, protectedApiEndpoints } from "./api-manifest.js";

const contractRouters = createAppRouters({
  database: {} as Database,
  idGenerator: () => "contract-id",
  clock: () => new Date("2026-01-01T00:00:00.000Z"),
});

function createTestApp(trustProxy = false) {
  const config = {
    ...readAppConfig({ NODE_ENV: "test" }),
    trustProxy,
    logLevel: "silent",
  };

  return createApp({ config, logger: createLogger("silent"), routers: contractRouters });
}

describe("HTTP contract", () => {
  it("locks all 44 registered method/path pairs in mount order", () => {
    type RouteLayer = {
      route?: {
        path: string;
        methods: Record<string, boolean>;
      };
    };
    const routers = [
      { prefix: "/auth", router: contractRouters.auth },
      { prefix: "", router: contractRouters.admin },
      { prefix: "", router: contractRouters.reports },
      { prefix: "", router: contractRouters.calls },
      { prefix: "", router: contractRouters.roles },
      { prefix: "", router: contractRouters.settings },
      { prefix: "", router: contractRouters.users },
      { prefix: "", router: contractRouters.logs },
      { prefix: "", router: contractRouters.notifications },
    ];
    const actual = routers.flatMap(({ prefix, router }) =>
      ((router as unknown as { stack: RouteLayer[] }).stack ?? []).flatMap((layer) => {
        if (!layer.route) {
          return [];
        }

        return Object.entries(layer.route.methods)
          .filter(([, enabled]) => enabled)
          .map(([method]) => ({
            method: method.toUpperCase(),
            path: `${prefix}${layer.route!.path}`,
          }));
      }),
    );

    expect(actual).toStrictEqual(apiRouteManifest);
    expect(actual).toHaveLength(44);
  });

  it("keeps health response status, body, and key order", async () => {
    const response = await request(createTestApp()).get("/health").expect(200);

    expect(response.body).toStrictEqual({ status: "ok" });
    expect(Object.keys(response.body)).toStrictEqual(["status"]);
  });

  it("keeps CORS wildcard behavior", async () => {
    const response = await request(createTestApp())
      .options("/health")
      .set("Origin", "https://example.test")
      .expect(204);

    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });

  it("only enables trust proxy for the Render flag equivalent", () => {
    expect(createTestApp(false).get("trust proxy")).toBe(false);
    expect(createTestApp(true).get("trust proxy")).toBe(true);
  });

  it("keeps the existing root-mounted auth interception for unknown paths", async () => {
    const response = await request(createTestApp()).get("/does-not-exist").expect(401);

    expect(response.body).toStrictEqual({ message: "Oturum gerekli." });
  });

  it("maps malformed JSON to the existing generic 500 body", async () => {
    const response = await request(createTestApp())
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send('{"username":')
      .expect(500);

    expect(response.body).toStrictEqual({ message: "Beklenmeyen bir hata oluştu." });
    expect(Object.keys(response.body)).toStrictEqual(["message"]);
  });

  it("maps the default JSON body size error to the existing generic 500 body", async () => {
    const response = await request(createTestApp())
      .post("/auth/login")
      .send({ username: "x".repeat(110_000), password: "x" })
      .expect(500);

    expect(response.body).toStrictEqual({ message: "Beklenmeyen bir hata oluştu." });
  });

  it("preserves an explicitly supplied known HTTP error body without an envelope", async () => {
    const probe = Router();
    probe.get("/http-error-probe", () => {
      throw new HttpError(403, { code: "IP_NOT_ALLOWED", message: "Reddedildi." });
    });
    const empty = Router();
    const config = {
      ...readAppConfig({ NODE_ENV: "test" }),
      logLevel: "silent",
    };
    const app = createApp({
      config,
      logger: createLogger("silent"),
      routers: {
        auth: probe,
        admin: empty,
        reports: empty,
        calls: empty,
        roles: empty,
        settings: empty,
        users: empty,
        logs: empty,
        notifications: empty,
      },
    });

    const response = await request(app).get("/auth/http-error-probe").expect(403);
    expect(response.body).toStrictEqual({
      code: "IP_NOT_ALLOWED",
      message: "Reddedildi.",
    });
  });

  it("keeps login validation ahead of database access", async () => {
    const response = await request(createTestApp()).post("/auth/login").send({}).expect(400);

    expect(response.body).toStrictEqual({
      message: "Kullanıcı adı ve şifre zorunludur.",
    });
  });

  it.each(protectedApiEndpoints)(
    "keeps $method $path protected and mounted",
    async ({ method, path }) => {
      const response = await request(createTestApp())[method](path).expect(401);

      expect(response.body).toStrictEqual({ message: "Oturum gerekli." });
      expect(Object.keys(response.body)).toStrictEqual(["message"]);
    },
  );

  it("locks all 43 protected API endpoints in the request matrix", () => {
    expect(protectedApiEndpoints).toHaveLength(43);
  });
});
