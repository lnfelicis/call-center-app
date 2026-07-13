import type { UserDto, UserRow } from "./types.js";

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
  };
}
