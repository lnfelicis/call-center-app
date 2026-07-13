import { describe, expect, it, vi } from "vitest";
import { createMySqlCallRepository } from "../../../src/modules/calls/call.repository.js";
import type {
  CallDatabase,
  CallFormFieldRow,
  CallRow,
} from "../../../src/modules/calls/call.types.js";
import { createCallRequest, createCallRow, createField } from "./call-fixtures.js";

function createDatabase(query: ReturnType<typeof vi.fn>) {
  return {
    query,
    getConnection: vi.fn(),
  } as unknown as CallDatabase;
}

describe("MySQL call repository", () => {
  it("loads field settings with the preserved sort order", async () => {
    const fields = [createField("phoneNumber")];
    const query = vi.fn().mockResolvedValue([fields, []]);
    const repository = createMySqlCallRepository(createDatabase(query), () => "id-1");

    await expect(repository.getFieldSettings()).resolves.toBe(fields);
    expect(query).toHaveBeenCalledWith(expect.stringContaining(
      "ORDER BY sort_order ASC, field_key ASC",
    ));
  });

  it("returns the first matching call and keeps the id parameter position", async () => {
    const call = createCallRow();
    const query = vi.fn().mockResolvedValue([[call], []]);
    const repository = createMySqlCallRepository(createDatabase(query), () => "id-1");

    await expect(repository.getCallById("call-1")).resolves.toBe(call);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE call_records.id = ?\n        LIMIT 1"),
      ["call-1"],
    );
  });

  it("falls back from null option values to labels in database order", async () => {
    const query = vi.fn().mockResolvedValue([[
      { value: "urgent", label: "Urgent" },
      { value: null, label: "Normal" },
    ], []]);
    const repository = createMySqlCallRepository(createDatabase(query), () => "id-1");

    await expect(repository.getActiveOptionValues("priority"))
      .resolves.toStrictEqual(["urgent", "Normal"]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE option_type = ? AND is_active = 1"),
      ["priority"],
    );
  });

  it("writes event id, actor and serialized metadata in the legacy parameter order", async () => {
    const query = vi.fn().mockResolvedValue([{}, []]);
    const repository = createMySqlCallRepository(
      createDatabase(query),
      () => "event-id",
    );

    await repository.writeCallEvent(
      createCallRequest([], "actor-1"),
      "call-1",
      "call.updated",
      "Updated",
      { updatedFields: ["priority"] },
    );

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO call_events"),
      [
        "event-id",
        "call-1",
        "actor-1",
        "call.updated",
        "Updated",
        JSON.stringify({ updatedFields: ["priority"] }),
      ],
    );
  });
});
