import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../../src/database/database.js";
import { SettingsRepository } from "../../../src/modules/settings/repository.js";
import type { FieldRow, OptionRow } from "../../../src/modules/settings/types.js";

function compactSql(value: unknown) {
  return String(value).replace(/\s+/g, " ").trim();
}

function createRepository(...queryResults: unknown[]) {
  const query = vi.fn();
  for (const result of queryResults) {
    query.mockResolvedValueOnce(result);
  }
  const database = { query } as unknown as Database;
  return { database, query, repository: new SettingsRepository(database) };
}

const optionRow = {
  id: "option-id",
  option_type: "status",
  label: "Açık",
  value: "open",
  color: "#2563eb",
  is_active: 1,
  sort_order: 10,
} as OptionRow;

const fieldRow = {
  field_key: "phone",
  label: "Telefon",
  is_active: 1,
  is_required: 1,
  is_visible: 1,
  is_editable: 1,
  is_masked: 0,
  sort_order: 10,
} as FieldRow;

describe("SettingsRepository", () => {
  it("reads settings rows with the preserved filters and ordering", async () => {
    const { query, repository } = createRepository([[optionRow], []], [[fieldRow], []]);

    await expect(repository.readOptions()).resolves.toStrictEqual([optionRow]);
    await expect(repository.readFields()).resolves.toStrictEqual([fieldRow]);

    expect(compactSql(query.mock.calls[0]?.[0])).toBe(
      "SELECT id, option_type, label, value, color, is_active, sort_order FROM call_form_options WHERE option_type <> 'issue_sub_category' ORDER BY option_type ASC, sort_order ASC, label ASC",
    );
    expect(compactSql(query.mock.calls[1]?.[0])).toBe(
      "SELECT field_key, label, is_active, is_required, is_visible, is_editable, is_masked, sort_order FROM call_form_fields ORDER BY sort_order ASC, field_key ASC",
    );
  });

  it("reads one option type with the exact SQL parameter", async () => {
    const { query, repository } = createRepository([[optionRow], []]);

    await expect(repository.readOptionsByType("status")).resolves.toStrictEqual([optionRow]);

    expect(compactSql(query.mock.calls[0]?.[0])).toBe(
      "SELECT id, option_type, label, value, color, is_active, sort_order FROM call_form_options WHERE option_type = ? ORDER BY sort_order ASC, label ASC",
    );
    expect(query.mock.calls[0]?.[1]).toStrictEqual(["status"]);
  });

  it("creates and updates options with stable SQL parameter order", async () => {
    const updateResult = { affectedRows: 2 } as ResultSetHeader;
    const { query, repository } = createRepository([{} as ResultSetHeader, []], [updateResult, []]);
    const baseInput = {
      id: "option-id",
      type: "priority" as const,
      label: "Yüksek",
      value: "high",
      color: "#ea580c",
      sortOrder: 30,
    };

    await repository.createOption(baseInput);
    await expect(
      repository.updateOption({ ...baseInput, isActive: 0 }),
    ).resolves.toBe(2);

    expect(compactSql(query.mock.calls[0]?.[0])).toBe(
      "INSERT INTO call_form_options (id, option_type, label, value, color, is_active, sort_order) VALUES (?, ?, ?, ?, ?, 1, ?)",
    );
    expect(query.mock.calls[0]?.[1]).toStrictEqual([
      "option-id",
      "priority",
      "Yüksek",
      "high",
      "#ea580c",
      30,
    ]);
    expect(compactSql(query.mock.calls[1]?.[0])).toBe(
      "UPDATE call_form_options SET label = ?, value = ?, color = ?, is_active = ?, sort_order = ? WHERE id = ? AND option_type = ?",
    );
    expect(query.mock.calls[1]?.[1]).toStrictEqual([
      "Yüksek",
      "high",
      "#ea580c",
      0,
      30,
      "option-id",
      "priority",
    ]);
  });

  it("delegates persisted updates to the transaction helper", async () => {
    const connection = {
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([{} as RowDataPacket, []]),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    } as unknown as PoolConnection;
    const database = {
      query: vi.fn(),
      getConnection: vi.fn().mockResolvedValue(connection),
    } as unknown as Database;
    const repository = new SettingsRepository(database);

    await repository.persist({ fields: [], options: [] });

    expect(database.getConnection).toHaveBeenCalledOnce();
    expect(connection.beginTransaction).toHaveBeenCalledOnce();
    expect(connection.query).not.toHaveBeenCalled();
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
  });
});
