import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { LogController } from "../../../src/modules/logs/controller.js";
import { LogRepository, type LogDatabase } from "../../../src/modules/logs/repository.js";
import { LogService } from "../../../src/modules/logs/service.js";

describe("log layers", () => {
  it("lists the latest one hundred audit rows with existing ordering", async () => {
    const rows = [{ id: "log-1" }];
    const database = { query: vi.fn().mockResolvedValue([rows, []]) } as unknown as LogDatabase;

    await expect(new LogRepository(database).listRecent()).resolves.toBe(rows);
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining(
      "ORDER BY audit_logs.created_at DESC\n      LIMIT 100",
    ));
  });

  it("maps repository rows through the service", async () => {
    const repository = {
      listRecent: vi.fn().mockResolvedValue([{
        id: "log-1",
        actor_user_id: null,
        actor_username: null,
        action: "auth.login",
        entity_type: "user",
        entity_id: "user-1",
        metadata: {},
        ip_address: null,
        user_agent: null,
        created_at: "2026-07-13 10:00:00",
      }]),
    } as unknown as LogRepository;

    await expect(new LogService(repository).listRecent()).resolves.toStrictEqual([
      expect.objectContaining({ id: "log-1", entityType: "user" }),
    ]);
  });

  it("keeps the logs response envelope in the controller", async () => {
    const service = { listRecent: vi.fn().mockResolvedValue([{ id: "log-1" }]) } as unknown as LogService;
    const response = { json: vi.fn() } as unknown as Response;

    await new LogController(service).list({} as Request, response);

    expect(response.json).toHaveBeenCalledWith({ logs: [{ id: "log-1" }] });
  });
});
