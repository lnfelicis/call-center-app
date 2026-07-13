import type { Response } from "express";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedRequest } from "../../../src/auth.js";
import {
  createCallController,
  type CallControllerDependencies,
} from "../../../src/modules/calls/call.controller.js";
import type { CallRepository } from "../../../src/modules/calls/call.repository.js";
import type { CallDatabase } from "../../../src/modules/calls/call.types.js";
import { createCallRequest, createCallRow } from "./call-fixtures.js";

function createResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

function createRequest(input: {
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  permissions?: string[];
}) {
  const request = createCallRequest(input.permissions ?? [], "user-1");
  request.body = input.body ?? {};
  request.params = input.params ?? {};
  request.query = {};
  request.header = vi.fn((name: string) => (
    name === "user-agent" ? "unit-agent" : undefined
  )) as unknown as AuthenticatedRequest["header"];
  return request;
}

function createDependencies(input: {
  repository: CallRepository;
  auditWriter?: CallControllerDependencies["auditWriter"];
  notificationPublisher?: CallControllerDependencies["notificationPublisher"];
  notificationSettingsReader?: CallControllerDependencies["notificationSettingsReader"];
  idGenerator?: CallControllerDependencies["idGenerator"];
}) {
  return {
    repository: input.repository,
    auditWriter: input.auditWriter ?? vi.fn(),
    notificationPublisher: input.notificationPublisher ?? vi.fn(),
    notificationSettingsReader: input.notificationSettingsReader
      ?? vi.fn().mockResolvedValue({ urgentNotificationEnabled: false }),
    clientIpReader: vi.fn(() => "127.0.0.1"),
    idGenerator: input.idGenerator ?? vi.fn(() => "generated-id"),
    clock: () => ({
      toISOString: () => "2026-07-13T06:08:07.000Z",
      toTimeString: () => "09:08:07 GMT+0300",
    }) as Date,
  } satisfies CallControllerDependencies;
}

describe("call controller orchestration", () => {
  it("creates urgent calls in insert, event, audit, notification and reload order", async () => {
    const order: string[] = [];
    const insertedParams: unknown[][] = [];
    const database = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("created_at >= DATE_SUB")) {
          order.push("duplicate-phone");
          return [[], []];
        }
        if (sql.includes("INSERT INTO call_records")) {
          order.push("insert");
          insertedParams.push(params ?? []);
          return [{}, []];
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      }),
      getConnection: vi.fn(),
    } as unknown as CallDatabase;
    const createdCall = createCallRow({
      id: "call-id",
      record_number: "CAG-20260713-090807-ABCDEF",
      phone_number: "05551234567",
      student_tc: null,
      student_name: null,
      interaction_type: "phone",
      category: "registration",
      issue: "Issue",
      initial_note: null,
      priority: "urgent",
      opened_by_user_id: "user-1",
      opened_by_name: "Agent One",
      assigned_to_user_id: null,
      assigned_to_name: null,
    });
    const repository = {
      database,
      getActiveOptionValues: vi.fn(async () => {
        order.push("options");
        return ["normal", "urgent"];
      }),
      getFieldSettings: vi.fn(async () => {
        order.push("fields");
        return [];
      }),
      writeCallEvent: vi.fn(async () => {
        order.push("event");
      }),
      getCallById: vi.fn(async () => {
        order.push("reload");
        return createdCall;
      }),
    } as unknown as CallRepository;
    const auditWriter = vi.fn(async () => {
      order.push("audit");
    });
    const notificationSettingsReader = vi.fn(async () => {
      order.push("settings");
      return { urgentNotificationEnabled: true };
    });
    const notificationPublisher = vi.fn(async () => {
      order.push("notification");
    });
    const idGenerator = vi.fn()
      .mockReturnValueOnce("call-id")
      .mockReturnValueOnce("abcdef12-0000-0000-0000-000000000000");
    const controller = createCallController(createDependencies({
      repository,
      auditWriter,
      notificationSettingsReader,
      notificationPublisher,
      idGenerator,
    }));
    const response = createResponse();

    await controller.createCall(createRequest({
      body: {
        phoneNumber: " 05551234567 ",
        interactionType: " phone ",
        category: " registration ",
        issue: " Issue ",
        priority: "urgent",
        needsFollowUp: false,
      },
      permissions: ["calls.create", "calls.view.own"],
    }), response);

    expect(order).toStrictEqual([
      "options",
      "fields",
      "duplicate-phone",
      "insert",
      "event",
      "audit",
      "settings",
      "notification",
      "reload",
    ]);
    expect(insertedParams[0]).toStrictEqual([
      "call-id",
      "CAG-20260713-090807-ABCDEF",
      "05551234567",
      null,
      null,
      "phone",
      "registration",
      null,
      "Issue",
      null,
      "urgent",
      0,
      null,
      "user-1",
      null,
      "127.0.0.1",
      "unit-agent",
    ]);
    expect(notificationPublisher).toHaveBeenCalledWith(
      ["calls.view.all", "calls.resolve"],
      expect.objectContaining({
        type: "call.urgent",
        entityId: "call-id",
        dedupeKey: "urgent-call:call-id",
      }),
    );
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      warnings: [],
      call: expect.objectContaining({ id: "call-id", priority: "urgent" }),
    }));
  });

  it("keeps bulk-option Boolean coercion and transaction/audit order", async () => {
    const order: string[] = [];
    const updateQuery = vi.fn(async () => {
      order.push("update");
      return [{}, []];
    });
    const connection = {
      beginTransaction: vi.fn(async () => { order.push("begin"); }),
      query: updateQuery,
      commit: vi.fn(async () => { order.push("commit"); }),
      rollback: vi.fn(async () => { order.push("rollback"); }),
      release: vi.fn(() => { order.push("release"); }),
    };
    const repository = {
      database: {
        query: vi.fn(),
        getConnection: vi.fn(async () => connection),
      },
      getFieldSettings: vi.fn(),
      getCallById: vi.fn(),
      getActiveOptionValues: vi.fn(),
      writeCallEvent: vi.fn(),
    } as unknown as CallRepository;
    const auditWriter = vi.fn(async () => { order.push("audit"); });
    const controller = createCallController(createDependencies({ repository, auditWriter }));
    const response = createResponse();

    await controller.bulkUpdateCallOptions(createRequest({
      body: {
        options: [{
          id: "option-1",
          type: "status",
          label: "Open",
          color: "#ABCDEF",
          isActive: "false",
          sortOrder: "0",
        }],
      },
    }), response);

    expect(order).toStrictEqual(["begin", "update", "commit", "release", "audit"]);
    expect(updateQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ? AND option_type = ?"),
      ["Open", "open", "#abcdef", 1, 0, "option-1", "status"],
    );
    expect(response.json).toHaveBeenCalledWith({ ok: true });
  });

  it("keeps resolve as non-transactional update, note, event and audit writes", async () => {
    const order: string[] = [];
    const query = vi.fn(async (sql: string) => {
      order.push(sql.includes("UPDATE call_records") ? "update" : "note");
      return [{}, []];
    });
    const repository = {
      database: { query, getConnection: vi.fn() } as unknown as CallDatabase,
      getCallById: vi.fn(async () => {
        order.push("load");
        return createCallRow({
          opened_by_user_id: "user-1",
          is_locked: 1,
        });
      }),
      writeCallEvent: vi.fn(async () => { order.push("event"); }),
      getFieldSettings: vi.fn(),
      getActiveOptionValues: vi.fn(),
    } as unknown as CallRepository;
    const auditWriter = vi.fn(async () => { order.push("audit"); });
    const controller = createCallController(createDependencies({
      repository,
      auditWriter,
      idGenerator: () => "note-id",
    }));
    const response = createResponse();

    await controller.resolveCall(createRequest({
      params: { id: "call-1" },
      body: {
        resolutionDescription: " Resolved ",
        resolutionCategory: " solved ",
      },
      permissions: ["calls.view.own", "calls.resolve"],
    }), response);

    expect(order).toStrictEqual(["load", "update", "note", "event", "audit"]);
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("SET status = 'resolved'"),
      ["user-1", "Resolved", "solved", "call-1"],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("VALUES (?, ?, ?, 'resolution', ?)"),
      ["note-id", "call-1", "user-1", "Resolved"],
    );
    expect(response.json).toHaveBeenCalledWith({ ok: true });
  });
});
