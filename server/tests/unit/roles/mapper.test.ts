import { describe, expect, it } from "vitest";
import { mapPermissionRow, mapRoleRows } from "../../../src/modules/roles/mapper.js";
import type { PermissionRow, RoleRow } from "../../../src/modules/roles/types.js";

describe("role mappers", () => {
  it("maps permission snake_case fields without changing nulls", () => {
    expect(mapPermissionRow({
      id: "users.manage",
      group_name: "Kullanıcılar",
      label: "Kullanıcı yönetimi",
      description: null,
    } as PermissionRow)).toStrictEqual({
      id: "users.manage",
      groupName: "Kullanıcılar",
      label: "Kullanıcı yönetimi",
      description: null,
    });
  });

  it("groups joined role rows and preserves permission order and boolean coercion", () => {
    const base = {
      id: "role-1",
      name: "Yönetici",
      description: null,
      is_system: 1 as const,
      is_active: 0 as const,
      created_at: "2026-07-13 10:00:00",
    };

    const result = mapRoleRows([
      { ...base, permission_id: "users.manage" } as RoleRow,
      { ...base, permission_id: "logs.view" } as RoleRow,
      {
        ...base,
        id: "role-2",
        name: "Temsilci",
        is_system: 0,
        is_active: 1,
        permission_id: null,
      } as RoleRow,
    ]);

    expect(result).toStrictEqual([
      {
        id: "role-1",
        name: "Yönetici",
        description: null,
        isSystem: true,
        isActive: false,
        createdAt: "2026-07-13 10:00:00",
        permissions: ["users.manage", "logs.view"],
      },
      {
        id: "role-2",
        name: "Temsilci",
        description: null,
        isSystem: false,
        isActive: true,
        createdAt: "2026-07-13 10:00:00",
        permissions: [],
      },
    ]);
  });
});
