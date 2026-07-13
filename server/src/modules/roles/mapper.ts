import type { PermissionRow, RoleDto, RoleRow } from "./types.js";

export function mapPermissionRow(row: PermissionRow) {
  return {
    id: row.id,
    groupName: row.group_name,
    label: row.label,
    description: row.description,
  };
}

export function mapRoleRows(rows: RoleRow[]): RoleDto[] {
  const roles = new Map<string, RoleDto>();

  for (const row of rows) {
    const existing = roles.get(row.id) ?? {
      id: row.id,
      name: row.name,
      description: row.description,
      isSystem: row.is_system === 1,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      permissions: [],
    };

    if (row.permission_id) {
      existing.permissions.push(row.permission_id);
    }

    roles.set(row.id, existing);
  }

  return [...roles.values()];
}
