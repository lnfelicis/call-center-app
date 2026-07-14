import type { Response } from "express";
import { expect, vi } from "vitest";
import type { AuthenticatedRequest } from "../../../src/modules/auth/types.js";
import {
  createCallController,
  type CallControllerDependencies,
} from "../../../src/modules/calls/call.controller.js";
import type { CallRepository } from "../../../src/modules/calls/call.repository.js";
import type {
  CallDatabase,
  CallFormFieldRow,
  CallRow,
} from "../../../src/modules/calls/call.types.js";
import { createCallRequest, createCallRow } from "./call-fixtures.js";

export function createControllerResponse() {
  const status = vi.fn<(code: number) => Response>();
  const json = vi.fn<(body?: unknown) => Response>();
  const response = { status, json };
  status.mockReturnValue(response as unknown as Response);
  json.mockReturnValue(response as unknown as Response);

  return response as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

export function createControllerRequest(input: {
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  permissions?: string[];
  userId?: string;
  userAgent?: string | null;
} = {}) {
  const request = createCallRequest(input.permissions ?? [], input.userId ?? "user-1");
  request.body = input.body ?? {};
  request.params = input.params ?? {};
  request.query = (input.query ?? {}) as AuthenticatedRequest["query"];
  const userAgent = input.userAgent === null
    ? undefined
    : (input.userAgent ?? "unit-agent");
  request.header = vi.fn((name: string) => (
    name === "user-agent" ? userAgent : undefined
  )) as unknown as AuthenticatedRequest["header"];
  return request;
}

export function expectControllerResponse(
  response: ReturnType<typeof createControllerResponse>,
  status: number,
  body: unknown,
) {
  expect(response.status).toHaveBeenCalledWith(status);
  expect(response.json).toHaveBeenCalledWith(body);
}

export function createControllerHarness() {
  const query = vi.fn<(
    sql: string,
    params?: unknown[],
  ) => Promise<[unknown, unknown]>>(async () => [[], []]);
  const connection = {
    beginTransaction: vi.fn(async () => undefined),
    query: vi.fn<(
      sql: string,
      params?: unknown[],
    ) => Promise<[unknown, unknown]>>(async () => [{ affectedRows: 1 }, []]),
    commit: vi.fn(async () => undefined),
    rollback: vi.fn(async () => undefined),
    release: vi.fn(() => undefined),
  };
  const database = {
    query,
    getConnection: vi.fn(async () => connection),
  } as unknown as CallDatabase;
  const repositoryMocks = {
    database,
    getFieldSettings: vi.fn<() => Promise<CallFormFieldRow[]>>(async () => []),
    getCallById: vi.fn<(callId: string) => Promise<CallRow | null>>(async () => createCallRow({
      opened_by_user_id: "user-1",
      assigned_to_user_id: "user-1",
    })),
    getActiveOptionValues: vi.fn<(
      type: "priority" | "status",
    ) => Promise<string[]>>(async () => ["normal", "urgent", "open", "in_progress"]),
    writeCallEvent: vi.fn<CallRepository["writeCallEvent"]>(async () => undefined),
  };
  const repository = repositoryMocks as unknown as CallRepository;
  const dependencyMocks = {
    auditWriter: vi.fn(async () => undefined),
    notificationPublisher: vi.fn(async () => undefined),
    notificationSettingsReader: vi.fn(async () => ({ urgentNotificationEnabled: false })),
    clientIpReader: vi.fn(() => "127.0.0.1"),
    idGenerator: vi.fn(() => "generated-id"),
    clock: vi.fn(() => ({
      toISOString: () => "2026-07-13T06:08:07.000Z",
      toTimeString: () => "09:08:07 GMT+0300",
    }) as Date),
  } satisfies Omit<CallControllerDependencies, "repository">;
  const controller = createCallController({
    repository,
    ...dependencyMocks,
  });

  return {
    controller,
    repository,
    repositoryMocks,
    database,
    query,
    connection,
    ...dependencyMocks,
  };
}
