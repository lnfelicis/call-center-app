import type { PoolConnection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../../src/database/database.js";
import { persistSettingsUpdate } from "../../../src/modules/settings/settings.service.js";

function createDatabaseFake(query = vi.fn().mockResolvedValue([{}, []])) {
  const connection = {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    query,
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  } as unknown as PoolConnection;
  const database = {
    getConnection: vi.fn().mockResolvedValue(connection),
  } as unknown as Database;

  return { database, connection };
}

const update = {
  fields: [
    {
      key: "phone",
      label: "Telefon",
      isActive: 1 as const,
      isRequired: 1 as const,
      isVisible: 1 as const,
      isEditable: 1 as const,
      isMasked: 0 as const,
      sortOrder: 1,
    },
  ],
  options: [
    {
      id: "option-id",
      type: "status" as const,
      label: "Açık",
      value: "open",
      color: "#2563eb",
      isActive: 1 as const,
      sortOrder: 1,
    },
  ],
};

describe("persistSettingsUpdate", () => {
  it("commits field and option updates in their existing order", async () => {
    const { database, connection } = createDatabaseFake();

    await persistSettingsUpdate(database, update);

    expect(connection.beginTransaction).toHaveBeenCalledOnce();
    expect(connection.query).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(connection.query).mock.calls[0]?.[0]).replace(/\s+/g, " ").trim()).toBe(
      "UPDATE call_form_fields SET label = ?, is_active = ?, is_required = ?, is_visible = ?, is_editable = ?, is_masked = ?, sort_order = ? WHERE field_key = ?",
    );
    expect(vi.mocked(connection.query).mock.calls[0]?.[1]).toStrictEqual([
      "Telefon",
      1,
      1,
      1,
      1,
      0,
      1,
      "phone",
    ]);
    expect(String(vi.mocked(connection.query).mock.calls[1]?.[0]).replace(/\s+/g, " ").trim()).toBe(
      "UPDATE call_form_options SET label = ?, value = ?, color = ?, is_active = ?, sort_order = ? WHERE id = ? AND option_type = ?",
    );
    expect(vi.mocked(connection.query).mock.calls[1]?.[1]).toStrictEqual([
      "Açık",
      "open",
      "#2563eb",
      1,
      1,
      "option-id",
      "status",
    ]);
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();
    expect(vi.mocked(connection.beginTransaction).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(connection.query).mock.invocationCallOrder[0]!,
    );
    expect(vi.mocked(connection.query).mock.invocationCallOrder[1]).toBeLessThan(
      vi.mocked(connection.commit).mock.invocationCallOrder[0]!,
    );
  });

  it("rolls back and releases when a query fails", async () => {
    const failure = new Error("query failed");
    const { database, connection } = createDatabaseFake(vi.fn().mockRejectedValue(failure));

    await expect(persistSettingsUpdate(database, update)).rejects.toBe(failure);

    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
  });
});
