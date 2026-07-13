import type { PoolConnection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import { RoleRepository, type RoleDatabase } from "../../../src/modules/roles/repository.js";

function createDatabaseFake(query = vi.fn().mockResolvedValue([{}, []])) {
  const connection = {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    query,
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  } as unknown as PoolConnection;
  const database = {
    query: vi.fn(),
    getConnection: vi.fn().mockResolvedValue(connection),
  } as unknown as RoleDatabase;
  return { database, connection };
}

describe("role repository transactions", () => {
  it("lists permissions and roles with the existing sort SQL", async () => {
    const database = {
      query: vi.fn()
        .mockResolvedValueOnce([[{ id: "users.manage" }], []])
        .mockResolvedValueOnce([[{ id: "role-1" }], []]),
      getConnection: vi.fn(),
    } as unknown as RoleDatabase;
    const repository = new RoleRepository(database);

    await expect(repository.listPermissions()).resolves.toStrictEqual([{ id: "users.manage" }]);
    await expect(repository.listRoles()).resolves.toStrictEqual([{ id: "role-1" }]);
    expect(database.query).toHaveBeenNthCalledWith(1, expect.stringContaining(
      "ORDER BY group_name, label",
    ));
    expect(database.query).toHaveBeenNthCalledWith(2, expect.stringContaining(
      "ORDER BY roles.created_at ASC, roles.name ASC",
    ));
  });

  it("checks empty, valid and invalid permission sets with exact cardinality", async () => {
    const database = {
      query: vi.fn()
        .mockResolvedValueOnce([[{ id: "one" }, { id: "two" }], []])
        .mockResolvedValueOnce([[{ id: "one" }], []]),
      getConnection: vi.fn(),
    } as unknown as RoleDatabase;
    const repository = new RoleRepository(database);

    await expect(repository.permissionIdsExist([])).resolves.toBe(true);
    await expect(repository.permissionIdsExist(["one", "two"])).resolves.toBe(true);
    await expect(repository.permissionIdsExist(["one", "missing"])).resolves.toBe(false);
    expect(database.query).toHaveBeenNthCalledWith(
      1,
      "SELECT id FROM permissions WHERE id IN (?,?)",
      ["one", "two"],
    );
  });

  it("updates active state as one or zero and returns affected rows", async () => {
    const database = {
      query: vi.fn().mockResolvedValue([{ affectedRows: 1 }, []]),
      getConnection: vi.fn(),
    } as unknown as RoleDatabase;

    await expect(new RoleRepository(database).update({
      roleId: "role-1",
      name: "Rol",
      description: null,
      isActive: true,
    })).resolves.toBe(1);
    expect(database.query).toHaveBeenCalledWith(
      "UPDATE roles SET name = ?, description = ?, is_active = ? WHERE id = ?",
      ["Rol", null, 1, "role-1"],
    );

    await new RoleRepository(database).update({
      roleId: "role-1",
      name: "Rol",
      description: null,
      isActive: false,
    });
    expect(database.query).toHaveBeenLastCalledWith(
      "UPDATE roles SET name = ?, description = ?, is_active = ? WHERE id = ?",
      ["Rol", null, 0, "role-1"],
    );
  });

  it("creates the role and permissions before commit, then releases", async () => {
    const { database, connection } = createDatabaseFake();
    const repository = new RoleRepository(database);

    await repository.create("role-1", {
      name: "Takım Lideri",
      description: null,
      permissionIds: ["calls.view.all", "users.manage"],
    });

    expect(connection.query).toHaveBeenCalledTimes(3);
    expect(connection.query).toHaveBeenNthCalledWith(
      1,
      "INSERT INTO roles (id, name, description, is_system, is_active) VALUES (?, ?, ?, 0, 1)",
      ["role-1", "Takım Lideri", null],
    );
    expect(connection.query).toHaveBeenNthCalledWith(
      2,
      "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
      ["role-1", "calls.view.all"],
    );
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();
    expect(vi.mocked(connection.query).mock.invocationCallOrder[2]).toBeLessThan(
      vi.mocked(connection.commit).mock.invocationCallOrder[0]!,
    );
  });

  it("rolls back and releases when role creation fails", async () => {
    const failure = new Error("insert failed");
    const { database, connection } = createDatabaseFake(vi.fn().mockRejectedValue(failure));

    await expect(
      new RoleRepository(database).create("role-1", {
        name: "Takım Lideri",
        description: null,
        permissionIds: ["users.manage"],
      }),
    ).rejects.toBe(failure);

    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("commits role creation without permission inserts for an empty permission set", async () => {
    const { database, connection } = createDatabaseFake();

    await new RoleRepository(database).create("role-1", {
      name: "Boş Rol",
      description: null,
      permissionIds: [],
    });

    expect(connection.query).toHaveBeenCalledOnce();
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("replaces permissions in delete/insert/commit order", async () => {
    const { database, connection } = createDatabaseFake();

    await new RoleRepository(database).replacePermissions("role-1", ["users.manage"]);

    expect(connection.query).toHaveBeenNthCalledWith(
      1,
      "DELETE FROM role_permissions WHERE role_id = ?",
      ["role-1"],
    );
    expect(connection.query).toHaveBeenNthCalledWith(
      2,
      "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
      ["role-1", "users.manage"],
    );
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("rolls back and releases when permission replacement fails", async () => {
    const failure = new Error("delete failed");
    const { database, connection } = createDatabaseFake(vi.fn().mockRejectedValue(failure));

    await expect(
      new RoleRepository(database).replacePermissions("role-1", ["users.manage"]),
    ).rejects.toBe(failure);

    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("replaces permissions with an empty set using only delete and commit", async () => {
    const { database, connection } = createDatabaseFake();

    await new RoleRepository(database).replacePermissions("role-1", []);

    expect(connection.query).toHaveBeenCalledOnce();
    expect(connection.query).toHaveBeenCalledWith(
      "DELETE FROM role_permissions WHERE role_id = ?",
      ["role-1"],
    );
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
  });
});
