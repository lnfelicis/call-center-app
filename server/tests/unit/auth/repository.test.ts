import { describe, expect, it, vi } from "vitest";
import { AuthRepository, type AuthDatabase } from "../../../src/modules/auth/repository.js";

function databaseWithRows(rows: unknown[]) {
  return { query: vi.fn().mockResolvedValue([rows, []]) } as unknown as AuthDatabase;
}

describe("auth repository", () => {
  it("finds and maps a login user by username or email", async () => {
    const database = databaseWithRows([{
      id: "user-1",
      password_hash: "hash",
      status: "active",
      failed_login_attempts: 2,
    }]);

    await expect(new AuthRepository(database).findLoginUser("omer")).resolves.toStrictEqual({
      id: "user-1",
      passwordHash: "hash",
      status: "active",
      failedLoginAttempts: 2,
    });
    expect(database.query).toHaveBeenCalledWith(
      "SELECT id, password_hash, status, failed_login_attempts FROM users WHERE username = ? OR email = ? LIMIT 1",
      ["omer", "omer"],
    );
  });

  it("returns null when no login user exists", async () => {
    await expect(new AuthRepository(databaseWithRows([])).findLoginUser("missing")).resolves.toBeNull();
  });

  it("uses the existing failed and successful login update SQL", async () => {
    const database = databaseWithRows([]);
    const repository = new AuthRepository(database);

    await repository.incrementFailedLoginAttempts("user-1");
    await repository.recordSuccessfulLogin("user-1");

    expect(database.query).toHaveBeenNthCalledWith(
      1,
      "UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?",
      ["user-1"],
    );
    expect(database.query).toHaveBeenNthCalledWith(
      2,
      "UPDATE users SET failed_login_attempts = 0, last_login_at = CURRENT_TIMESTAMP WHERE id = ?",
      ["user-1"],
    );
  });

  it("returns null when the active user/role join has no rows", async () => {
    await expect(
      new AuthRepository(databaseWithRows([])).getUserWithPermissions("user-1"),
    ).resolves.toBeNull();
  });

  it("maps the current user and keeps permission query order", async () => {
    const database = databaseWithRows([
      {
        id: "user-1",
        username: "omer",
        full_name: "Ömer Test",
        email: "omer@example.test",
        role_id: "role-1",
        role_name: "Yönetici",
        permission_id: "users.manage",
      },
      {
        id: "user-1",
        username: "omer",
        full_name: "Ömer Test",
        email: "omer@example.test",
        role_id: "role-1",
        role_name: "Yönetici",
        permission_id: null,
      },
      {
        id: "user-1",
        username: "omer",
        full_name: "Ömer Test",
        email: "omer@example.test",
        role_id: "role-1",
        role_name: "Yönetici",
        permission_id: "logs.view",
      },
    ]);

    await expect(
      new AuthRepository(database).getUserWithPermissions("user-1"),
    ).resolves.toStrictEqual({
      id: "user-1",
      username: "omer",
      fullName: "Ömer Test",
      email: "omer@example.test",
      roleId: "role-1",
      roleName: "Yönetici",
      permissions: ["users.manage", "logs.view"],
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining(
        "LEFT JOIN effective_user_permissions ON effective_user_permissions.user_id = users.id",
      ),
      ["user-1"],
    );
  });
});
