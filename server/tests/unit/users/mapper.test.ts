import { describe, expect, it } from "vitest";
import { mapUserRow } from "../../../src/modules/users/mapper.js";
import type { UserRow } from "../../../src/modules/users/types.js";

describe("user mapper", () => {
  it("keeps the existing user response shape and key order", () => {
    const result = mapUserRow({
      id: "user-1",
      username: "omer",
      full_name: "Ömer Test",
      email: "omer@example.test",
      status: "active",
      role_id: "role-1",
      role_name: "Yönetici",
      created_at: "2026-07-13 10:00:00",
      last_login_at: null,
      archived_at: null,
      permission_overrides: JSON.stringify([
        { permissionId: "logs.view", effect: "deny" },
      ]),
      permissions: ["calls.view.own"],
    } as UserRow);

    expect(result).toStrictEqual({
      id: "user-1",
      username: "omer",
      fullName: "Ömer Test",
      email: "omer@example.test",
      status: "active",
      roleId: "role-1",
      roleName: "Yönetici",
      createdAt: "2026-07-13 10:00:00",
      lastLoginAt: null,
      archivedAt: null,
      permissionOverrides: [{ permissionId: "logs.view", effect: "deny" }],
      permissions: ["calls.view.own"],
    });
    expect(Object.keys(result)).toStrictEqual([
      "id",
      "username",
      "fullName",
      "email",
      "status",
      "roleId",
      "roleName",
      "createdAt",
      "lastLoginAt",
      "archivedAt",
      "permissionOverrides",
      "permissions",
    ]);
  });
});
