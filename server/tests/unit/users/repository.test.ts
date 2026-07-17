import { describe, expect, it, vi } from "vitest";
import { UserRepository, type UserDatabase } from "../../../src/modules/users/repository.js";

function databaseWithResult(result: unknown) {
  return {
    query: vi.fn().mockResolvedValue([result, []]),
  } as unknown as UserDatabase;
}

function transactionalDatabase(...queryResults: unknown[]) {
  const query = vi.fn();
  for (const result of queryResults) {
    query.mockResolvedValueOnce(result);
  }
  const connection = {
    query,
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  };
  const database = {
    query: vi.fn(),
    getConnection: vi.fn().mockResolvedValue(connection),
  } as unknown as UserDatabase;
  return { database, connection };
}

describe("user repository", () => {
  it("uses active/full-name ordering and returns effective permission fields", async () => {
    const rows = [{ id: "user-1" }];
    const database = databaseWithResult(rows);

    await expect(new UserRepository(database).listActive()).resolves.toBe(rows);
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining(
      "WHERE users.status = 'active' AND users.archived_at IS NULL\n      ORDER BY users.full_name ASC",
    ));
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining(
      "FROM effective_user_permissions",
    ));
  });

  it("uses created-at ordering for the full list", async () => {
    const rows = [{ id: "user-1" }];
    const database = databaseWithResult(rows);

    await expect(new UserRepository(database).listAll("all")).resolves.toBe(rows);
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining(
      "ORDER BY users.created_at ASC",
    ));
  });

  it("archives and restores only users in the expected state", async () => {
    const database = {
      query: vi.fn()
        .mockResolvedValueOnce([{ affectedRows: 1 }, []])
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]),
    } as unknown as UserDatabase;
    const repository = new UserRepository(database);

    await expect(repository.archive("user-1")).resolves.toBe(1);
    await expect(repository.restore("user-1")).resolves.toBe(1);
    expect(database.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("archived_at IS NULL"),
      ["user-1"],
    );
    expect(database.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("archived_at IS NOT NULL"),
      ["user-1"],
    );
  });

  it("creates the user and overrides in one transaction", async () => {
    const { database, connection } = transactionalDatabase([{}, []], [{}, []], [{}, []]);
    const input = {
      username: "omer",
      fullName: "Ömer Test",
      email: "omer@example.test",
      password: "plain",
      roleId: "role-1",
      permissionOverrides: [{ permissionId: "logs.view", effect: "deny" as const }],
    };

    await new UserRepository(database).create("user-1", input, "hash");

    expect(connection.beginTransaction).toHaveBeenCalledOnce();
    expect(connection.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("VALUES (?, ?, ?, ?, ?, ?, 'active')"),
      ["user-1", "omer", "Ömer Test", "omer@example.test", "hash", "role-1"],
    );
    expect(connection.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("INSERT INTO user_permission_overrides"),
      ["user-1", "logs.view", "deny"],
    );
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("clears old overrides when an old client changes roles", async () => {
    const { database, connection } = transactionalDatabase(
      [[{ role_id: "role-old" }], []],
      [{ affectedRows: 1 }, []],
      [{}, []],
    );

    await expect(new UserRepository(database).update({
      userId: "user-1",
      fullName: "Ömer Test",
      email: "omer@example.test",
      roleId: "role-new",
      status: "passive",
    })).resolves.toStrictEqual({ affectedRows: 1, roleChanged: true });

    expect(connection.query).toHaveBeenNthCalledWith(
      3,
      "DELETE FROM user_permission_overrides WHERE user_id = ?",
      ["user-1"],
    );
    expect(connection.commit).toHaveBeenCalledOnce();
  });

  it("rolls back when replacing an override fails", async () => {
    const { database, connection } = transactionalDatabase();
    connection.query
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []])
      .mockRejectedValueOnce(new Error("insert failed"));

    await expect(new UserRepository(database).create("user-1", {
      username: "omer",
      fullName: "Ömer",
      email: "omer@example.test",
      password: "plain",
      roleId: "role-1",
      permissionOverrides: [{ permissionId: "logs.view", effect: "deny" }],
    }, "hash")).rejects.toThrow("insert failed");
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
  });
});
