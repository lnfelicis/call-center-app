import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createRequestLogger, type AppLogger } from "../../../src/http/logger.js";

describe("request logger", () => {
  it("records request metadata without body, query values, or authorization", async () => {
    const info = vi.fn();
    const logger = {
      debug: vi.fn(),
      info,
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as AppLogger;
    const app = express();
    app.use(express.json());
    app.use(createRequestLogger(logger));
    app.post("/probe", (_req, res) => res.json({ ok: true }));

    await request(app)
      .post("/probe?secret=query-value")
      .set("Authorization", "Bearer sensitive-token")
      .send({ password: "secret" })
      .expect(200);

    expect(info).toHaveBeenCalledOnce();
    const entry = info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(entry).toMatchObject({ method: "POST", path: "/probe", statusCode: 200 });
    expect(entry).not.toHaveProperty("body");
    expect(entry).not.toHaveProperty("query");
    expect(JSON.stringify(entry)).not.toContain("sensitive-token");
    expect(JSON.stringify(entry)).not.toContain("query-value");
    expect(JSON.stringify(entry)).not.toContain("secret");
  });
});
