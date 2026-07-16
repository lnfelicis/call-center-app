import type { UserDto, UserRow } from "./types.js";

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function mapUserRow(row: UserRow): UserDto {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    email: row.email,
    status: row.status,
    roleId: row.role_id,
    roleName: row.role_name,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    permissionOverrides: parseJsonArray(row.permission_overrides),
    permissions: parseJsonArray(row.permissions),
  };
}
