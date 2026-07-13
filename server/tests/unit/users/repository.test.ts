import { describe, expect, it, vi } from "vitest";
import { UserRepository, type UserDatabase } from "../../../src/modules/users/repository.js";

function databaseWithResult(result: unknown) {
  return { query: vi.fn().mockResolvedValue([result, []]) } as unknown as UserDatabase;
}

describe("user repository", () => {
  it("uses active/full-name ordering for options", async () => {
    const rows = [{ id: "user-1" }];
    const database = databaseWithResult(rows);

    await expect(new UserRepository(database).listActive()).resolves.toBe(rows);
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining(
      "WHERE users.status = 'active'\n      ORDER BY users.full_name ASC",
    ));
  });

  it("uses created-at ordering for the full list", async () => {
    const rows = [{ id: "user-1" }];
    const database = databaseWithResult(rows);

    await expect(new UserRepository(database).listAll()).resolves.toBe(rows);
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining(
      "ORDER BY users.created_at ASC",
    ));
  });

  it("inserts the same fields and active status", async () => {
    const database = databaseWithResult({});
    const input = {
      username: "omer",
      fullName: "Ömer Test",
      email: "omer@example.test",
      password: "plain",
      roleId: "role-1",
    };

    await new UserRepository(database).create("user-1", input, "hash");

    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining("VALUES (?, ?, ?, ?, ?, ?, 'active')"),
      ["user-1", "omer", "Ömer Test", "omer@example.test", "hash", "role-1"],
    );
  });

  it("returns affected rows from update", async () => {
    const database = databaseWithResult({ affectedRows: 1 });

    await expect(new UserRepository(database).update({
      userId: "user-1",
      fullName: "Ömer Test",
      email: "omer@example.test",
      roleId: "role-1",
      status: "passive",
    })).resolves.toBe(1);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining("SET full_name = ?, email = ?, role_id = ?, status = ?"),
      ["Ömer Test", "omer@example.test", "role-1", "passive", "user-1"],
    );
  });
});
